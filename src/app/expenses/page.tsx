import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DeleteExpenseButton } from '@/components/DeleteExpenseButton'

export const dynamic = 'force-dynamic'

async function getExpenses() {
  return await prisma.expense.findMany({
    include: {
      category: true,
    },
    orderBy: {
      date: 'desc',
    },
    take: 50,
  })
}

export default async function ExpensesPage() {
  const expenses = await getExpenses()

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Expenses</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Total: {formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/categories"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Manage Categories
            </Link>
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Add Expense
            </Link>
          </div>
        </div>


        {expenses.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No expenses yet
            </p>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Create your first expense
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {expense.description}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: expense.category.color
                              ? `${expense.category.color}20`
                              : '#E5E7EB',
                            color: expense.category.color || '#374151',
                          }}
                        >
                          {expense.category.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <DeleteExpenseButton expenseId={expense.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
