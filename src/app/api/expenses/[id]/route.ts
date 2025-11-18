import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateExpenseSchema } from '@/lib/validations/expense'

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

    // Update in PostgreSQL for consistency
    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        category: true,
      },
    })

    // Update in Google Sheets (primary data store)
    const { updateExpenseInSheet } = await import('@/lib/google-sheets')
    await updateExpenseInSheet(params.id, {
      date: expense.date,
      description: expense.description,
      amount: expense.amount,
      categoryName: expense.category.name,
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error updating expense:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
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
    // Delete from PostgreSQL
    await prisma.expense.delete({
      where: { id: params.id },
    })

    // Delete from Google Sheets (primary data store)
    const { deleteExpenseFromSheet } = await import('@/lib/google-sheets')
    await deleteExpenseFromSheet(params.id)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    )
  }
}
