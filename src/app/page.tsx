import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Expense Entry</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Track and manage your expenses efficiently
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/expenses"
            className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2">View Expenses →</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Browse and manage your expense records
            </p>
          </Link>

          <Link
            href="/expenses/new"
            className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2">Add Expense →</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create a new expense entry
            </p>
          </Link>
        </div>
      </div>
    </main>
  )
}
