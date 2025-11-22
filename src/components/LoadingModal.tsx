'use client'

interface LoadingModalProps {
  isOpen: boolean;
  message: string;
  retryAttempt?: number;
  maxRetries?: number;
}

export function LoadingModal({
  isOpen,
  message,
  retryAttempt,
  maxRetries = 3,
}: LoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="flex flex-col items-center">
          {/* Spinning loader */}
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
          </div>

          {/* Message */}
          <h3 className="text-lg font-semibold mb-2 text-center text-gray-900 dark:text-gray-100">
            {message}
          </h3>

          {/* Retry counter */}
          {retryAttempt !== undefined && retryAttempt > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Attempt {retryAttempt} of {maxRetries}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
