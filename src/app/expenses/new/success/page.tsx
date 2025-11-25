import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';

interface PageProps {
  searchParams: { categoryId?: string; month?: string; year?: string };
}

async function getCategoryMonthTotal(
  categoryId: string,
  month: number,
  year: number
): Promise<{ categoryName: string; total: number }> {
  // Get the start and end of the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const expenses = await prisma.expense.findMany({
    where: {
      categoryId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: true,
    },
  });

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryName = expenses[0]?.category.name || 'Unknown';

  return { categoryName, total };
}

export default async function ExpenseSuccessPage({ searchParams }: PageProps) {
  const { categoryId, month, year } = searchParams;

  if (!categoryId || !month || !year) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Expense Added</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your expense has been successfully saved!
          </p>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-block"
          >
            Add Another Expense
          </Link>
        </div>
      </div>
    );
  }

  const { categoryName, total } = await getCategoryMonthTotal(
    categoryId,
    parseInt(month),
    parseInt(year)
  );

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthName = monthNames[parseInt(month) - 1];

  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 mb-6">
          <div className="text-green-600 dark:text-green-400 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">Expense Added Successfully!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your expense has been saved to both the database and Google Sheets.
          </p>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Total for {categoryName} in {monthName} {year}
            </p>
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors text-center"
            >
              Add Another
            </Link>
            <Link
              href="/expenses"
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 px-6 py-3 rounded-lg font-medium transition-colors text-center"
            >
              Expenses
            </Link>
          </div>
          <Link
            href="/expenses/confirmed"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors text-center"
          >
            Done
          </Link>
        </div>
      </div>
    </div>
  );
}
