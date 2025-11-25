import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateExpenseSchema } from '@/lib/validations/expense'
import { RetryableError } from '@/lib/retry'
import { getSheetNameFromDate } from '@/lib/utils'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch from PostgreSQL (fast)
    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        category: true,
      },
    })

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    // Convert date string to Date object if provided
    const data = {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
    }

    const validatedData = updateExpenseSchema.parse(data)

    // Get the old expense data BEFORE updating (for rollback)
    const oldExpense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        category: true,
      },
    })

    if (!oldExpense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    // Update in PostgreSQL for consistency
    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        category: true,
      },
    })

    // Update in Google Sheets (primary data store)
    // If this fails, rollback the PostgreSQL entry to maintain consistency
    try {
      const { updateExpenseInSheet } = await import('@/lib/google-sheets')
      await updateExpenseInSheet(params.id, {
        date: expense.date,
        description: expense.description,
        amount: expense.amount,
        categoryName: expense.category.name,
      })
    } catch (sheetsError) {
      console.error('Failed to update in Google Sheets, rolling back PostgreSQL entry:', sheetsError)

      // Rollback: Restore the old expense data in PostgreSQL
      try {
        await prisma.expense.update({
          where: { id: params.id },
          data: {
            date: oldExpense.date,
            description: oldExpense.description,
            amount: oldExpense.amount,
            categoryId: oldExpense.categoryId,
            notes: oldExpense.notes,
          },
        })
        console.log(`Rollback successful: Restored expense ${params.id} in PostgreSQL`)
      } catch (rollbackError) {
        console.error('CRITICAL: Rollback failed! Data inconsistency detected:', rollbackError)
      }

      // Re-throw the original error
      throw sheetsError
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error updating expense:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }

    if (error instanceof RetryableError) {
      return NextResponse.json(
        {
          error: 'Google Sheets unavailable',
          message: 'Google Sheets is temporarily unavailable. Please try again later and/or verify your security settings.',
          attempts: error.attempts,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  let auditRecordId: string | null = null

  try {
    // 1. Fetch expense with category for audit record
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { category: true },
    })

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    // 2. Create audit record BEFORE deletion
    // This provides recovery mechanism if expense is manually restored to Sheets
    const sheetName = getSheetNameFromDate(expense.date)
    const auditRecord = await prisma.expenseAuditRecords.create({
      data: {
        expenseId: expense.id,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        categoryId: expense.categoryId,
        categoryName: expense.category.name,
        categoryColor: expense.category.color || '#6B7280',
        sheetName: sheetName,
        rowIndex: 0, // Exact row index not critical for restoration
      },
    })
    auditRecordId = auditRecord.id

    // 3. Delete from PostgreSQL
    try {
      await prisma.expense.delete({
        where: { id },
      })
    } catch (deleteError) {
      // Rollback: Delete audit record if PostgreSQL delete fails
      if (auditRecordId) {
        await prisma.expenseAuditRecords.delete({
          where: { id: auditRecordId },
        })
      }
      throw deleteError
    }

    // 4. Delete from Google Sheets (async, best effort)
    // We don't rollback on Sheets failure because:
    // - Audit log provides recovery mechanism
    // - If expense remains in Sheets, next sync will restore it from audit
    // - This prevents data inconsistency (PostgreSQL having data Sheets doesn't)
    const { deleteExpenseFromSheet } = await import('@/lib/google-sheets')
    deleteExpenseFromSheet(id).catch(error => {
      console.error(`[DELETE] Sheets deletion failed for ${id}:`, error)
      // Don't rollback - audit log allows recovery
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting expense:', error)

    // Add RetryableError handling from dev branch
    if (error instanceof RetryableError) {
      return NextResponse.json(
        {
          error: 'Google Sheets unavailable',
          message: 'Google Sheets is temporarily unavailable. Please try again later and/or verify your security settings.',
          attempts: error.attempts,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    )
  }
}
