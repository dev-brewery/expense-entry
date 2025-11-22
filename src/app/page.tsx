import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ExpenseForm } from '@/components/ExpenseForm'

async function getCategories() {
  return await prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  })
}

export default async function Home() {
  const categories = await getCategories()
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Add New Expense</h1>
          <Link
            href="/expenses"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Expenses →
          </Link>
        </div>

        <ExpenseForm categories={categories} defaultDate={today} />
      </div>
    </div>
  )
}
