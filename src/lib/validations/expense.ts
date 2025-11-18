import { z } from 'zod'

export const expenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(255),
  date: z.date(),
  categoryId: z.string().min(1, 'Category is required'),
  receipt: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const createExpenseSchema = expenseSchema

export const updateExpenseSchema = expenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
