'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteExpenseButtonProps {
  expenseId: string
}

export function DeleteExpenseButton({ expenseId }: DeleteExpenseButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom

      // Position menu below button if space, otherwise above
      const top = spaceBelow >= 150
        ? rect.bottom + 8
        : rect.top - 8 - 48 // 48px is approximate menu height

      setMenuPosition({
        top,
        right: window.innerWidth - rect.right
      })
    }
  }, [isOpen])

  const handleDelete = async () => {
    if (!confirm('Delete this expense? It can be restored by re-adding to the spreadsheet.')) {
      setIsOpen(false)
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.refresh() // Reload server component data
      } else {
        alert('Failed to delete expense')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete expense')
    } finally {
      setIsDeleting(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative inline-block text-left">
      {/* Vertical ellipsis button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
        aria-label="Actions"
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu - Fixed positioning to float above container */}
          <div
            className="fixed z-20 w-32 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`
            }}
          >
            <div className="py-1">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
