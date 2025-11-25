# Task 1: Add ExpenseAuditRecords Model to Prisma Schema

## Objective
Add a new Prisma model `ExpenseAuditRecords` to track deleted expenses for audit logging and restoration.

## File to Modify
`c:\home\repos\expense-entry\prisma\schema.prisma`

## Changes Required

Add the following model after the existing Expense model:

```prisma
model ExpenseAuditRecords {
  id            String   @id @default(cuid())
  expenseId     String   // Original expense UUID from Sheets
  amount        Float
  description   String
  date          DateTime
  categoryId    String
  categoryName  String   // Denormalized for restoration
  categoryColor String   // Denormalized for restoration
  sheetName     String   // e.g., "June 2025"
  rowIndex      Int      // 0-based row index in sheet
  deletedAt     DateTime @default(now())
  restoredAt    DateTime?

  @@index([expenseId])
  @@index([deletedAt])
  @@index([expenseId, restoredAt]) // Fast lookup for unrestored items
}
```

## Post-Implementation Steps

After modifying the schema file:
1. Run `npm run db:generate` to regenerate Prisma client
2. Run `npm run db:push` to apply schema to database
3. Verify the table was created successfully

## Success Criteria
- [ ] ExpenseAuditRecords model added to schema.prisma
- [ ] Prisma client regenerated successfully
- [ ] Database schema updated successfully
- [ ] All three indexes created
