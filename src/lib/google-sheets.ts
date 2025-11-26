import { google } from 'googleapis';
import { formatDate } from './utils';
import { retry } from './retry';
import { logger } from './logger';

// Type definitions
export interface SheetExpense {
  id: string;
  date: Date;
  description: string;
  amount: number;
  category: string;
}

export interface MonthlyTotal {
  month: string;
  total: number;
}

// Initialize Google Sheets API
function getGoogleSheetsClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;

  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable is not set');
  }

  let parsedCredentials;
  try {
    parsedCredentials = JSON.parse(credentials);
  } catch (error) {
    throw new Error(
      `Failed to parse GOOGLE_SERVICE_ACCOUNT_CREDENTIALS. ` +
      `Ensure it contains valid JSON. Error: ${(error as Error).message}`
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: parsedCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// Get spreadsheet ID from environment
function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable is not set');
  }

  return spreadsheetId;
}

// Format month name from date (e.g., "June 2025")
function getMonthSheetName(date: Date): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${year}`;
}

// Get or create a sheet for a specific month
async function ensureMonthSheetExists(date: Date): Promise<string> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getMonthSheetName(date);

  try {
    // Get all sheets
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheet = spreadsheet.data.sheets?.find(
      sheet => sheet.properties?.title === sheetName
    );

    if (existingSheet) {
      return sheetName;
    }

    // Create the sheet if it doesn't exist
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });

    // Add headers to the new sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:E1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['ID', 'Date', 'Description', 'Amount', 'Category']],
      },
    });

    // Add a Total row formula in columns G and H
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!G2:H2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['TOTAL:', '=SUM(D3:D)']],
      },
    });

    // Format the header row (bold)
    const sheetId = (await sheets.spreadsheets.get({ spreadsheetId }))
      .data.sheets?.find(s => s.properties?.title === sheetName)?.properties?.sheetId;

    if (sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                  },
                },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            },
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: 2,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                  },
                },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            },
          ],
        },
      });
    }

    return sheetName;
  } catch (error) {
    logger.error('Error ensuring month sheet exists', error);
    throw new Error(`Failed to create/access sheet for ${sheetName}`);
  }
}

// Insert a new expense into Google Sheets (creates month sheet if needed)
export async function insertExpenseToSheet(expense: {
  id: string;
  date: Date;
  description: string;
  amount: number;
  categoryName: string;
}): Promise<void> {
  await retry(
    async () => {
      const sheets = getGoogleSheetsClient();
      const spreadsheetId = getSpreadsheetId();

      // Ensure the month sheet exists
      const sheetName = await ensureMonthSheetExists(expense.date);

      const row = [
        expense.id,
        formatDate(expense.date),
        expense.description,
        expense.amount,
        expense.categoryName,
      ];

      // Append to the month sheet (after the header and total rows)
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A3:E`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });
    },
    {
      maxAttempts: 3,
      delayMs: 1000,
      onRetry: (attempt, error) => {
        logger.debug(`Insert attempt ${attempt} failed: ${error.message}`);
      },
    }
  );
}

// Extended type that includes sheet location information
export interface SheetExpenseWithLocation extends SheetExpense {
  _sheetName?: string;
  _rowIndex?: number; // 0-based index within the data (not including header/total rows)
}

// Fetch all expenses from Google Sheets (reads from all month sheets)
export async function getExpensesFromSheet(options?: {
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  includeLocation?: boolean;
}): Promise<SheetExpense[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // Get all sheets in the spreadsheet
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const allSheets = spreadsheet.data.sheets || [];

  // Filter to only month sheets (format: "Month YYYY")
  const monthSheetPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
  const monthSheets = allSheets
    .filter(sheet => monthSheetPattern.test(sheet.properties?.title || ''))
    .map(sheet => sheet.properties!.title!);

  // Fetch expenses from all month sheets
  let expenses: SheetExpense[] = [];

  for (const sheetName of monthSheets) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A3:E`, // Skip header row (row 1) and total row (row 2)
      });

      const rows = response.data.values || [];

      const sheetExpenses = rows
        .filter(row => row.length >= 5) // Ensure row has all columns
        .map((row, index) => {
          const expense: SheetExpenseWithLocation = {
            id: row[0] || '', // ID might be empty for manually added rows
            date: new Date(row[1]),
            description: row[2],
            amount: parseFloat(row[3]),
            category: row[4],
          };

          // Include location info if requested (for sync operations)
          if (options?.includeLocation) {
            expense._sheetName = sheetName;
            expense._rowIndex = index;
          }

          return expense;
        });

      expenses.push(...sheetExpenses);
    } catch (error) {
      logger.error(`Error reading sheet ${sheetName}`, error);
      // Continue with other sheets
    }
  }

  // Apply filters
  if (options?.categoryId) {
    expenses = expenses.filter(e => e.category === options.categoryId);
  }

  if (options?.startDate) {
    expenses = expenses.filter(e => e.date >= options.startDate!);
  }

  if (options?.endDate) {
    expenses = expenses.filter(e => e.date <= options.endDate!);
  }

  // Sort by date descending
  expenses.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Apply limit
  if (options?.limit) {
    expenses = expenses.slice(0, options.limit);
  }

  return expenses;
}

// Get a single expense by ID from Google Sheets
export async function getExpenseFromSheetById(id: string): Promise<SheetExpense | null> {
  const expenses = await getExpensesFromSheet();
  return expenses.find(e => e.id === id) || null;
}

// Calculate monthly totals from Google Sheets (reads from TOTAL row in each month sheet)
export async function getMonthlyTotalsFromSheet(): Promise<MonthlyTotal[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // Get all sheets in the spreadsheet
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const allSheets = spreadsheet.data.sheets || [];

  // Filter to only month sheets
  const monthSheetPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
  const monthSheets = allSheets
    .filter(sheet => monthSheetPattern.test(sheet.properties?.title || ''))
    .map(sheet => sheet.properties!.title!);

  const totals: MonthlyTotal[] = [];

  for (const sheetName of monthSheets) {
    try {
      // Read the TOTAL cell (D2) from each sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!D2`,
      });

      const totalValue = response.data.values?.[0]?.[0];
      const total = totalValue ? parseFloat(totalValue.toString()) : 0;

      // Convert sheet name to YYYY-MM format for sorting
      const [monthName, year] = sheetName.split(' ');
      const monthIndex = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ].indexOf(monthName);
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      totals.push({ month: monthKey, total });
    } catch (error) {
      logger.error(`Error reading total from sheet ${sheetName}`, error);
    }
  }

  // Sort by month descending
  totals.sort((a, b) => b.month.localeCompare(a.month));

  return totals;
}

// Update an expense in Google Sheets (searches across all month sheets)
export async function updateExpenseInSheet(
  id: string,
  updates: {
    date?: Date;
    description?: string;
    amount?: number;
    categoryName?: string;
  }
): Promise<void> {
  await retry(
    async () => {
      const sheets = getGoogleSheetsClient();
      const spreadsheetId = getSpreadsheetId();

      // Get all month sheets
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const allSheets = spreadsheet.data.sheets || [];
      const monthSheetPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
      const monthSheets = allSheets
        .filter(sheet => monthSheetPattern.test(sheet.properties?.title || ''))
        .map(sheet => sheet.properties!.title!);

      // Search for the expense across all month sheets
      for (const sheetName of monthSheets) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetName}'!A3:E`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);

        if (rowIndex !== -1) {
          // Found the expense - update it
          const currentRow = rows[rowIndex];
          const updatedRow = [
            currentRow[0], // ID stays the same
            updates.date ? formatDate(updates.date) : currentRow[1],
            updates.description ?? currentRow[2],
            updates.amount ?? currentRow[3],
            updates.categoryName ?? currentRow[4],
          ];

          // If date changed and month changed, need to move to different sheet
          if (updates.date) {
            const newSheetName = getMonthSheetName(updates.date);

            if (newSheetName !== sheetName) {
              // Delete from current sheet and insert into new sheet
              await deleteExpenseFromSheet(id);
              await insertExpenseToSheet({
                id: currentRow[0],
                date: updates.date,
                description: updates.description ?? currentRow[2],
                amount: updates.amount ?? parseFloat(currentRow[3]),
                categoryName: updates.categoryName ?? currentRow[4],
              });
              return;
            }
          }

          // Update in the same sheet (rowIndex is 0-based, row 3 is index 0, so add 3)
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetName}'!A${rowIndex + 3}:E${rowIndex + 3}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [updatedRow],
            },
          });
          return;
        }
      }

      throw new Error(`Expense with ID ${id} not found in Google Sheets`);
    },
    {
      maxAttempts: 3,
      delayMs: 1000,
      onRetry: (attempt, error) => {
        logger.debug(`Update attempt ${attempt} failed: ${error.message}`);
      },
    }
  );
}

// Update the ID of a specific row in Google Sheets
export async function updateExpenseIdInSheet(
  sheetName: string,
  rowIndex: number,
  newId: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // rowIndex is 0-based within the data, but row 3 is the first data row
  const actualRowNumber = rowIndex + 3;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A${actualRowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[newId]],
    },
  });

  logger.info(`Updated ID for row ${actualRowNumber} in sheet "${sheetName}" to: ${newId}`);
}

// Delete an expense from Google Sheets (searches across all month sheets)
export async function deleteExpenseFromSheet(id: string): Promise<void> {
  await retry(
    async () => {
      const sheets = getGoogleSheetsClient();
      const spreadsheetId = getSpreadsheetId();

      // Get all month sheets
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const allSheets = spreadsheet.data.sheets || [];
      const monthSheetPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
      const monthSheets = allSheets.filter(sheet => monthSheetPattern.test(sheet.properties?.title || ''));

      // Search for the expense across all month sheets
      for (const sheet of monthSheets) {
        const sheetName = sheet.properties!.title!;
        const sheetId = sheet.properties!.sheetId!;

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetName}'!A3:A`,
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);

        if (rowIndex !== -1) {
          // Found the expense - delete it (row 3 is index 0, so add 3)
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId,
                      dimension: 'ROWS',
                      startIndex: rowIndex + 2, // +2 because rows 0 and 1 are header and total
                      endIndex: rowIndex + 3,
                    },
                  },
                },
              ],
            },
          });
          return;
        }
      }

      throw new Error(`Expense with ID ${id} not found in Google Sheets`);
    },
    {
      maxAttempts: 3,
      delayMs: 1000,
      onRetry: (attempt, error) => {
        logger.debug(`Delete attempt ${attempt} failed: ${error.message}`);
      },
    }
  );
}
