import type { Metadata } from 'next'
import './globals.css'
import { SyncChecker } from '@/components/SyncChecker'
import { validateEnvironment } from '@/lib/env-validation'

// Validate environment variables in production
if (process.env.NODE_ENV === 'production') {
  validateEnvironment()
}

export const metadata: Metadata = {
  title: 'Expense Entry - Track Your Expenses',
  description: 'Simple and efficient expense tracking application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <SyncChecker />
      </body>
    </html>
  )
}
