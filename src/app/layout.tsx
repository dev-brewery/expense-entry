import type { Metadata } from 'next'
import './globals.css'
import { SyncChecker } from '@/components/SyncChecker'

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
