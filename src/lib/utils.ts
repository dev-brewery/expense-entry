import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Get sheet name from date (e.g., "June 2025")
 */
export function getSheetNameFromDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Calculate estimated row index based on date ordering
 * Used when creating audit records
 */
export function calculateSheetRowIndex(
  date: Date,
  allExpensesInSheet: Array<{ date: Date }>
): number {
  // Sort expenses by date descending (same as sheet order)
  const sortedExpenses = [...allExpensesInSheet].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )

  // Find index of expense with this date
  const index = sortedExpenses.findIndex(
    exp => exp.date.getTime() === date.getTime()
  )

  return index >= 0 ? index : 0
}
