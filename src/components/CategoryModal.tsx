'use client'

import { useState, useEffect, useRef } from 'react'
import { LoadingModal } from './LoadingModal'
import { ErrorModal } from './ErrorModal'

interface Category {
  id: string
  name: string
  color: string | null
}

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (category?: Category) => void
  category?: Category | null
  initialName?: string
}

export function CategoryModal({
  isOpen,
  onClose,
  onSuccess,
  category,
  initialName = '',
}: CategoryModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showError, setShowError] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (category) {
      setName(category.name)
      setColor(category.color || '#000000')
    } else {
      setName(initialName)
      setColor('#000000')
    }
  }, [category, isOpen, initialName])

  // Focus the name input when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowError(false)

    const url = category
      ? `/api/categories/${category.id}`
      : '/api/categories'
    const method = category ? 'PUT' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save category')
      }

      const savedCategory = await response.json()

      onSuccess(savedCategory)
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message)
      setShowError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6">
            {category ? 'Edit Category' : 'Create Category'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="color" className="block text-sm font-medium mb-2">
                  Color
                </label>
                <input
                  type="color"
                  id="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  required
                  className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <LoadingModal isOpen={isSubmitting} message="Saving category..." />
      <ErrorModal
        isOpen={showError}
        title="Error"
        message={errorMessage}
        onClose={() => setShowError(false)}
      />
    </>
  )
}
