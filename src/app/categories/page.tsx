'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { CategoryManager } from '@/components/CategoryManager'

export default function CategoriesPage() {
    const categoryManagerRef = useRef<{ triggerCreate: () => void }>(null)

    const handleCreateClick = () => {
        categoryManagerRef.current?.triggerCreate()
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Manage Categories</h1>
                    <div className="flex gap-4">
                        <button
                            onClick={handleCreateClick}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Create Category
                        </button>
                        <Link
                            href="/expenses"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            View Expenses
                        </Link>
                    </div>
                </div>

                <CategoryManager ref={categoryManagerRef} showHeader={false} />

                <div className="mt-8">
                    <Link
                        href="/"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    )
}
