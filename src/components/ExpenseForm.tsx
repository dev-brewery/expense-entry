'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CreatableSelect from 'react-select/creatable'
import { LoadingModal } from './LoadingModal'
import { ErrorModal } from './ErrorModal'

interface Category {
  id: string
  name: string
  color: string | null
}

interface ExpenseFormProps {
  defaultDate: string
}

export function ExpenseForm({ defaultDate }: ExpenseFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<{
    value: string
    label: string
  } | null>(null)

  // Fetch categories on mount and when needed
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleCreateCategory = async (inputValue: string) => {
    // For simplicity, we'll assign a random color.
    // In a real app, you might want a color picker.
    const newCategory = {
      name: inputValue,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    }

    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newCategory),
    })

    if (response.ok) {
      const createdCategory = await response.json()
      // Refresh categories list after creating
      await fetchCategories()
      setSelectedCategory({
        value: createdCategory.id,
        label: createdCategory.name,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setShowError(false)

    if (!selectedCategory) {
      setErrorMessage('Please select or create a category.')
      setShowError(true)
      return
    }

    const formData = new FormData(e.currentTarget);

    // Handle date timezone correctly
    // Create a date object that represents midnight in the local timezone
    const dateStr = formData.get('date') as string;
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    const data = {
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: dateObj.toISOString(),
      categoryId: selectedCategory.value,
      notes: formData.get('notes') as string || null,
    };

    const maxRetries = 3
    let lastError: any = null
    let showModalTimeout: NodeJS.Timeout | null = null
    let modalVisible = false

    showModalTimeout = setTimeout(() => {
      setIsSubmitting(true)
      setRetryAttempt(1)
      modalVisible = true
    }, 2000)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (modalVisible) {
        setRetryAttempt(attempt)
      }

      try {
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })

        if (response.ok) {
          if (showModalTimeout) {
            clearTimeout(showModalTimeout)
          }
          const expense = await response.json()
          const expenseDate = new Date(expense.date)
          const month = expenseDate.getMonth() + 1
          const year = expenseDate.getFullYear()
          router.push(
            `/expenses/new/success?categoryId=${expense.categoryId}&month=${month}&year=${year}`
          )
          return
        }

        const errorData = await response.json()
        lastError = errorData

        if (response.status === 503 && attempt < maxRetries) {
          if (!modalVisible) {
            if (showModalTimeout) {
              clearTimeout(showModalTimeout)
            }
            setIsSubmitting(true)
            setRetryAttempt(attempt)
            modalVisible = true
          }
          console.log(`Attempt ${attempt} failed, retrying...`)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          )
          continue
        }

        break
      } catch (error) {
        console.error('Error submitting expense:', error)
        lastError = {
          message: 'Network error. Please check your connection.',
        }

        if (attempt < maxRetries) {
          if (!modalVisible) {
            if (showModalTimeout) {
              clearTimeout(showModalTimeout)
            }
            setIsSubmitting(true)
            setRetryAttempt(attempt)
            modalVisible = true
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          )
          continue
        }
      }
    }

    if (showModalTimeout) {
      clearTimeout(showModalTimeout)
    }
    setIsSubmitting(false)
    setErrorMessage(
      lastError?.message ||
      'Google Sheets is temporarily unavailable. Please try again later and/or verify your security settings.'
    )
    setShowError(true)
  }

  const selectOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: 'rgb(255, 255, 255)',
      borderColor: state.isFocused ? 'rgb(59, 130, 246)' : 'rgb(209, 213, 219)',
      borderRadius: '0.5rem',
      padding: '0.25rem',
      '&:hover': {
        borderColor: 'rgb(59, 130, 246)',
      },
      boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
      '@media (prefers-color-scheme: dark)': {
        backgroundColor: 'rgb(55, 65, 81)',
        borderColor: state.isFocused ? 'rgb(59, 130, 246)' : 'rgb(75, 85, 99)',
      },
    }),
    input: (provided: any) => ({
      ...provided,
      color: 'rgb(17, 24, 39)',
      '@media (prefers-color-scheme: dark)': {
        color: 'rgb(243, 244, 246)',
      },
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'rgb(255, 255, 255)',
      '@media (prefers-color-scheme: dark)': {
        backgroundColor: 'rgb(55, 65, 81)',
      },
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isFocused ? 'rgb(59, 130, 246)' : 'transparent',
      color: state.isFocused ? 'white' : 'rgb(17, 24, 39)',
      cursor: 'pointer',
      '@media (prefers-color-scheme: dark)': {
        color: state.isFocused ? 'white' : 'rgb(243, 244, 246)',
      },
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: 'rgb(17, 24, 39)',
      '@media (prefers-color-scheme: dark)': {
        color: 'rgb(243, 244, 246)',
      },
    }),
  }


  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-2"
          >
            Description *
          </label>
          <input
            type="text"
            id="description"
            name="description"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
            placeholder="e.g., Groceries at Whole Foods"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-2">
            Amount * ($)
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            required
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
            placeholder="0.00"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium mb-2">
            Date *
          </label>
          <input
            type="date"
            id="date"
            name="date"
            required
            defaultValue={defaultDate}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
          />
        </div>

        <div>
          <label
            htmlFor="categoryId"
            className="block text-sm font-medium mb-2"
          >
            Category *
          </label>
          <CreatableSelect
            isClearable
            options={selectOptions}
            onChange={(newValue) =>
              setSelectedCategory(newValue as { value: string; label: string })
            }
            onCreateOption={handleCreateCategory}
            value={selectedCategory}
            styles={customStyles}
            required
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-2">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
            placeholder="Additional details..."
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Add Expense'}
          </button>
          <a
            href="/expenses"
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors text-center"
          >
            Cancel
          </a>
        </div>
      </form>

      <LoadingModal
        isOpen={isSubmitting}
        message="Retrying Write to Google Sheets"
        retryAttempt={retryAttempt}
        maxRetries={3}
      />

      <ErrorModal
        isOpen={showError}
        title="Unable to Save Expense"
        message={errorMessage}
        onClose={() => setShowError(false)}
      />
    </>
  )
}
