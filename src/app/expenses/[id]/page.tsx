import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'

async function getExpense(id: string) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
    },
  })

  if (!expense) {
    notFound()
  }

  return expense
}

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const expense = await getExpense(params.id)

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Expense Details</h1>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Description
            </h2>
            <p className="text-lg">{expense.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Amount
              </h3>
              <p className="text-2xl font-bold">
                {formatCurrency(expense.amount)}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Date
              </h3>
              <p className="text-lg">{formatDate(expense.date)}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Category
            </h3>
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: expense.category.color
                  ? `${expense.category.color}20`
                  : '#E5E7EB',
                color: expense.category.color || '#374151',
              }}
            >
              {expense.category.name}
            </span>
          </div>

          {expense.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Notes
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {expense.notes}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Created: {formatDate(expense.createdAt)}
            </p>
            {expense.updatedAt !== expense.createdAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Updated: {formatDate(expense.updatedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <Link
            href="/expenses"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Expenses
          </Link>
        </div>
      </div>
    </div>
  )
}
