'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingModal } from './LoadingModal';
import { ErrorModal } from './ErrorModal';

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface ExpenseFormProps {
  categories: Category[];
  defaultDate: string;
}

export function ExpenseForm({ categories, defaultDate }: ExpenseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowError(false);

    const formData = new FormData(e.currentTarget);
    const data = {
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: formData.get('date') as string,
      categoryId: formData.get('categoryId') as string,
      notes: formData.get('notes') as string || null,
    };

    const maxRetries = 3;
    let lastError: any = null;
    let showModalTimeout: NodeJS.Timeout | null = null;
    let modalVisible = false;

    // Set a timeout to show the modal after 2 seconds if request hasn't completed
    showModalTimeout = setTimeout(() => {
      setIsSubmitting(true);
      setRetryAttempt(1);
      modalVisible = true;
    }, 2000);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Only update retry attempt if modal is already visible
      if (modalVisible) {
        setRetryAttempt(attempt);
      }

      try {
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          // Cancel the modal timeout if it hasn't fired yet
          if (showModalTimeout) {
            clearTimeout(showModalTimeout);
          }
          const expense = await response.json();
          // Extract month and year for success page
          const expenseDate = new Date(expense.date);
          const month = expenseDate.getMonth() + 1;
          const year = expenseDate.getFullYear();
          router.push(
            `/expenses/new/success?categoryId=${expense.categoryId}&month=${month}&year=${year}`
          );
          return;
        }

        // Handle error responses
        const errorData = await response.json();
        lastError = errorData;

        // If it's a 503 (Service Unavailable) and we have retries left, retry
        if (response.status === 503 && attempt < maxRetries) {
          // Ensure modal is visible before retrying
          if (!modalVisible) {
            if (showModalTimeout) {
              clearTimeout(showModalTimeout);
            }
            setIsSubmitting(true);
            setRetryAttempt(attempt);
            modalVisible = true;
          }
          console.log(`Attempt ${attempt} failed, retrying...`);
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }

        // If we get a different error or ran out of retries, stop
        break;
      } catch (error) {
        console.error('Error submitting expense:', error);
        lastError = { message: 'Network error. Please check your connection.' };

        // Retry on network errors
        if (attempt < maxRetries) {
          // Ensure modal is visible before retrying
          if (!modalVisible) {
            if (showModalTimeout) {
              clearTimeout(showModalTimeout);
            }
            setIsSubmitting(true);
            setRetryAttempt(attempt);
            modalVisible = true;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
      }
    }

    // All retries failed
    if (showModalTimeout) {
      clearTimeout(showModalTimeout);
    }
    setIsSubmitting(false);
    setErrorMessage(
      lastError?.message || 'Google Sheets is temporarily unavailable. Please try again later and/or verify your security settings.'
    );
    setShowError(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
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
          <label htmlFor="categoryId" className="block text-sm font-medium mb-2">
            Category *
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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
  );
}
