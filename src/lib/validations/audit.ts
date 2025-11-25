import { z } from 'zod'

export const createAuditRecordSchema = z.object({
  expenseId: z.string().min(1),
  amount: z.number(),
  description: z.string(),
  date: z.date(),
  categoryId: z.string(),
  categoryName: z.string(),
  categoryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sheetName: z.string(),
  rowIndex: z.number().int().nonnegative(),
})

export type CreateAuditRecord = z.infer<typeof createAuditRecordSchema>
