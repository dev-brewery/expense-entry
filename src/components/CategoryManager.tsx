'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { CategoryModal } from './CategoryModal'
import { ErrorModal } from './ErrorModal'

interface CategoryManagerProps {
  showHeader?: boolean;
}

interface Category {
  id: string
  name: string
  color: string | null
  _count: {
    expenses: number
  }
}

export const CategoryManager = forwardRef<{ triggerCreate: () => void }, CategoryManagerProps>(
  function CategoryManager({ showHeader = true }, ref) {
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
    const [showErrorModal, setShowErrorModal] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')


    const fetchCategories = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/categories')
        if (!response.ok) {
          throw new Error('Failed to fetch categories')
        }
        const data = await response.json()
        setCategories(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    useEffect(() => {
      fetchCategories()
    }, [])

    const handleCreate = () => {
      setSelectedCategory(null)
      setIsModalOpen(true)
    }

    useImperativeHandle(ref, () => ({
      triggerCreate: handleCreate
    }))

    const handleEdit = (category: Category) => {
      setSelectedCategory(category)
      setIsModalOpen(true)
    }

    const handleDelete = async (categoryId: string) => {
      if (window.confirm('Are you sure you want to delete this category?')) {
        try {
          const response = await fetch(`/api/categories/${categoryId}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to delete category')
          }

          fetchCategories()
        } catch (err: any) {
          setErrorMessage(err.message)
          setShowErrorModal(true)
        }
      }
    }

    const onSuccess = () => {
      fetchCategories()
      setIsModalOpen(false)
    }


    return (
      <div className="mb-8">
        {showHeader && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Categories</h2>
            <button
              onClick={handleCreate}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Create Category
            </button>
          </div>
        )}
        {isLoading && <p>Loading categories...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!isLoading && !error && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <span
                      className="w-4 h-4 rounded-full mr-4"
                      style={{
                        backgroundColor: category.color || '#E5E7EB',
                      }}
                    ></span>
                    <span className="font-medium">{category.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                      ({category._count.expenses} expenses)
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleEdit(category)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={onSuccess}
          category={selectedCategory}
        />
        <ErrorModal
          isOpen={showErrorModal}
          title="Error"
          message={errorMessage}
          onClose={() => setShowErrorModal(false)}
        />
      </div>
    )
  }
)
