import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createExpenseSchema } from '@/lib/validations/expense'
import { syncExpensesFromSheets } from '@/lib/sync-sheets'
import { RetryableError } from '@/lib/retry'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const categoryId = searchParams.get('categoryId')
    const sync = searchParams.get('sync') === 'true'

    // Optionally sync from Google Sheets first
    if (sync) {
      await syncExpensesFromSheets()
    }

    const where: any = {}

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    // Fetch from PostgreSQL (fast)
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Convert date string to Date object
    const data = {
      ...body,
      date: body.date ? new Date(body.date) : new Date(),
    }

    const validatedData = createExpenseSchema.parse(data)

    // Create in PostgreSQL to get the ID and full record
    const expense = await prisma.expense.create({
      data: validatedData,
      include: {
        category: true,
      },
    })

    // Insert into Google Sheets (primary data store)
    // If this fails, rollback the PostgreSQL entry to maintain consistency
    try {
      const { insertExpenseToSheet } = await import('@/lib/google-sheets')
      await insertExpenseToSheet({
        id: expense.id,
        date: expense.date,
        description: expense.description,
        amount: expense.amount,
        categoryName: expense.category.name,
      })
    } catch (sheetsError) {
      console.error('Failed to insert to Google Sheets, rolling back PostgreSQL entry:', sheetsError)

      // Rollback: Delete the expense from PostgreSQL
      try {
        await prisma.expense.delete({
          where: { id: expense.id },
        })
        console.log(`Rollback successful: Deleted expense ${expense.id} from PostgreSQL`)
      } catch (rollbackError) {
        console.error('CRITICAL: Rollback failed! Data inconsistency detected:', rollbackError)
      }

      // Re-throw the original error
      throw sheetsError
    }

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)

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
        { status: 503 } // Service Unavailable
      )
    }

    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    )
  }
}
