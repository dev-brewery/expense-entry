import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateCategorySchema } from '@/lib/validations/category'

interface RouteContext {
  params: {
    id: string
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error(`Error fetching category ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json()
    const validatedData = updateCategorySchema.parse(body)

    const category = await prisma.category.update({
      where: { id: params.id },
      data: validatedData,
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error(`Error updating category ${params.id}:`, error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return PUT(request, context)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    // Check if there are any expenses associated with this category
    const expenseCount = await prisma.expense.count({
      where: { categoryId: params.id },
    })

    if (expenseCount > 0) {
      return NextResponse.json(
        {
          error:
            'This category cannot be deleted because it is associated with existing expenses.',
        },
        { status: 409 } // 409 Conflict
      )
    }

    await prisma.category.delete({
      where: { id: params.id },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error(`Error deleting category ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
