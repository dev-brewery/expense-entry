import { prisma } from './prisma';
import { getExpensesFromSheet, updateExpenseIdInSheet, SheetExpenseWithLocation } from './google-sheets';
import { randomBytes } from 'crypto';
import { ExpenseAuditRecords } from '@prisma/client';
import { logger } from './logger';

/**
 * Restores an expense from the audit log
 * Called when an expense is found in Google Sheets but not in PostgreSQL,
 * and a matching unrestored audit record exists
 */
async function restoreExpenseFromAudit(
  expenseId: string,
  auditRecord: ExpenseAuditRecords
): Promise<void> {
  logger.debug(`Restoring expense ${expenseId} from audit log`);

  try {
    // Recreate expense in PostgreSQL with original UUID
    await prisma.expense.create({
      data: {
        id: auditRecord.expenseId,
        amount: auditRecord.amount,
        description: auditRecord.description,
        date: auditRecord.date,
        categoryId: auditRecord.categoryId,
      },
    });

    // Mark audit record as restored
    await prisma.expenseAuditRecords.update({
      where: { id: auditRecord.id },
      data: { restoredAt: new Date() },
    });

    logger.info(`Successfully restored expense ${expenseId}`);
  } catch (error) {
    logger.error(`Failed to restore expense ${expenseId}`, error);
    throw error;
  }
}

/**
 * Syncs expenses from Google Sheets to PostgreSQL
 * Pulls any expenses that exist in Google Sheets but not in PostgreSQL
 * This ensures Google Sheets remains the source of truth
 */
export async function syncExpensesFromSheets(): Promise<{
  synced: number;
  errors: string[];
}> {
  try {
    logger.info('Starting sync from Google Sheets to PostgreSQL...');

    // Get all expenses from Google Sheets with location info
    const sheetExpenses = await getExpensesFromSheet({ includeLocation: true }) as SheetExpenseWithLocation[];
    logger.info(`Found ${sheetExpenses.length} expenses in Google Sheets`);

    // Get all expenses from PostgreSQL for duplicate checking
    const existingExpenses = await prisma.expense.findMany({
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        category: { select: { name: true } }
      },
    });
    const existingIds = new Set(existingExpenses.map((e) => e.id));
    logger.info(`Found ${existingIds.size} expenses in PostgreSQL`);

    // Batch fetch audit records for performance optimization
    const sheetExpenseIds = sheetExpenses
      .map(e => e.id)
      .filter(id => id && id.trim() !== '');

    const auditRecords = await prisma.expenseAuditRecords.findMany({
      where: {
        expenseId: { in: sheetExpenseIds },
        restoredAt: null, // Only unrestored deletions
      },
    });

    // Create a Map for O(1) lookup
    const auditMap = new Map(
      auditRecords.map(record => [record.expenseId, record])
    );
    logger.info(`Found ${auditRecords.length} unrestored audit records`);

    let synced = 0;
    const errors: string[] = [];

    for (const expense of sheetExpenses) {
      try {
        // If expense has no ID or empty ID, check for duplicates and generate new ID
        let expenseId = expense.id;
        let needsIdUpdate = false;

        if (!expenseId || expenseId.trim() === '') {
          // Check if this expense already exists by matching date, amount, and category
          const duplicate = existingExpenses.find(
            (e: { date: Date; amount: number; category: { name: string } }) =>
              Math.abs(e.date.getTime() - expense.date.getTime()) < 1000 && // Same date (within 1 second)
              Math.abs(e.amount - expense.amount) < 0.01 && // Same amount (within 1 cent)
              e.category.name === expense.category
          );

          if (duplicate) {
            logger.debug(`Skipping duplicate expense: ${expense.description}`);
            continue;
          }

          // Generate new ID for this expense
          expenseId = randomBytes(12).toString('base64url');
          needsIdUpdate = true;
          logger.info(`Generated new ID for expense without ID: ${expenseId}`);
        } else if (existingIds.has(expenseId)) {
          // Expense already exists in PostgreSQL
          continue;
        } else {
          // Expense has an ID but not in PostgreSQL - check audit log
          const auditRecord = auditMap.get(expenseId);
          if (auditRecord) {
            // Restore from audit log
            await restoreExpenseFromAudit(expenseId, auditRecord);
            synced++;
            continue;
          }
          // Not in PostgreSQL and not in audit log - will create as new below
        }

        // First, ensure the category exists
        const categoryName = expense.category;

        let category = await prisma.category.findFirst({
          where: { name: categoryName },
        });

        if (!category) {
          // Create the category with a default color
          category = await prisma.category.create({
            data: {
              name: categoryName,
              color: '#6B7280', // Default gray color
            },
          });
          logger.info(`Created new category: ${categoryName}`);
        }

        // Create the expense in PostgreSQL
        await prisma.expense.create({
          data: {
            id: expenseId,
            date: expense.date,
            description: expense.description,
            amount: expense.amount,
            categoryId: category.id,
          },
        });

        // If we generated a new ID, write it back to Google Sheets
        if (needsIdUpdate && expense._sheetName && expense._rowIndex !== undefined) {
          await updateExpenseIdInSheet(expense._sheetName, expense._rowIndex, expenseId);
          logger.info(`Updated Google Sheet with new ID: ${expenseId}`);
        }

        synced++;
        logger.info(`Synced expense ${expenseId}: ${expense.description}`);
      } catch (error) {
        const errorMsg = `Failed to sync expense ${expense.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    logger.info(`Sync complete. Synced ${synced} expenses, ${errors.length} errors`);

    return { synced, errors };
  } catch (error) {
    logger.error('Failed to sync expenses from Google Sheets', error);
    throw error;
  }
}

/**
 * Checks if sync is needed by comparing counts
 * Returns true if Google Sheets has more expenses than PostgreSQL
 */
export async function isSyncNeeded(): Promise<boolean> {
  try {
    const [sheetExpenses, dbCount] = await Promise.all([
      getExpensesFromSheet(),
      prisma.expense.count(),
    ]);

    return sheetExpenses.length > dbCount;
  } catch (error) {
    logger.error('Error checking if sync is needed', error);
    return false;
  }
}
