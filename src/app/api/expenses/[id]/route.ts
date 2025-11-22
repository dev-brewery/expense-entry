import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateExpenseSchema } from '@/lib/validations/expense'
import { RetryableError } from '@/lib/retry'

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
  try {
    // Get the expense data BEFORE deleting (for rollback)
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

    // Delete from PostgreSQL
    await prisma.expense.delete({
      where: { id: params.id },
    })

    // Delete from Google Sheets (primary data store)
    // If this fails, rollback by recreating the expense in PostgreSQL
    try {
      const { deleteExpenseFromSheet } = await import('@/lib/google-sheets')
      await deleteExpenseFromSheet(params.id)
    } catch (sheetsError) {
      console.error('Failed to delete from Google Sheets, rolling back PostgreSQL entry:', sheetsError)

      // Rollback: Recreate the expense in PostgreSQL
      try {
        await prisma.expense.create({
          data: {
            id: oldExpense.id,
            date: oldExpense.date,
            description: oldExpense.description,
            amount: oldExpense.amount,
            categoryId: oldExpense.categoryId,
            notes: oldExpense.notes,
          },
        })
        console.log(`Rollback successful: Recreated expense ${params.id} in PostgreSQL`)
      } catch (rollbackError) {
        console.error('CRITICAL: Rollback failed! Data inconsistency detected:', rollbackError)
      }

      // Re-throw the original error
      throw sheetsError
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting expense:', error)

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
