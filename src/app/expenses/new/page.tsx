import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createExpenseSchema } from '@/lib/validations/expense'

async function getCategories() {
  return await prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  })
}

async function createExpense(formData: FormData) {
  'use server'

  // Parse date as local midnight to avoid timezone shifts
  // Form date format: "YYYY-MM-DD" (e.g., "2025-12-01")
  // Using Date constructor with components ensures user's intended date is preserved
  const dateString = formData.get('date') as string
  const [dateYear, dateMonth, dateDay] = dateString.split('-').map(Number)
  const localDate = new Date(dateYear, dateMonth - 1, dateDay) // month is 0-indexed

  const data = {
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') as string,
    date: localDate,
    categoryId: formData.get('categoryId') as string,
    notes: formData.get('notes') as string || null,
  }

  const validatedData = createExpenseSchema.parse(data)

  const expense = await prisma.expense.create({
    data: validatedData,
    include: {
      category: true,
    },
  })

  // Insert into Google Sheets
  const { insertExpenseToSheet } = await import('@/lib/google-sheets')
  await insertExpenseToSheet({
    id: expense.id,
    date: expense.date,
    description: expense.description,
    amount: expense.amount,
    categoryName: expense.category.name,
  })

  // Extract month and year from the expense date
  const month = expense.date.getMonth() + 1 // 1-12
  const year = expense.date.getFullYear()

  // Redirect to success page with category and month info
  redirect(`/expenses/new/success?categoryId=${expense.categoryId}&month=${month}&year=${year}`)
}

export default async function NewExpensePage() {
  const categories = await getCategories()
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Add New Expense</h1>

        <form action={createExpense} className="space-y-6">
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-2"
            >
              Description *
            </label>
            <input
              type="text"
              id="description"
              name="description"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900"
              placeholder="e.g., Lunch at restaurant"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium mb-2">
                Amount *
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                step="0.01"
                min="0"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-2">
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                defaultValue={today}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="categoryId"
              className="block text-sm font-medium mb-2"
            >
              Category *
            </label>
            <select
              id="categoryId"
              name="categoryId"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900"
            >
              <option value="">Select a category</option>
              {categories.map((category: { id: string; name: string }) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900"
              placeholder="Additional notes (optional)"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Create Expense
            </button>
            <Link
              href="/expenses"
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 px-6 py-3 rounded-lg font-medium transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
