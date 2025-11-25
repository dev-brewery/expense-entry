# Delete Feature Testing Guide

This document provides a comprehensive testing checklist for the delete expense feature with audit logging and automatic restoration.

## Prerequisites

Before testing:
1. Ensure PostgreSQL is running: `npm run docker:up`
2. Ensure database schema is up to date: `npm run db:push`
3. Start the development server: `npm run dev`
4. Open http://localhost:3000 in your browser

## Test Suite

### 1. Delete Flow (Happy Path)

**Steps:**
1. Navigate to `/expenses` page
2. Verify you see the "Actions" column with three-dot menu on each expense
3. Click the three-dot menu on any expense
4. Verify dropdown appears with "Delete" button in red
5. Click "Delete"
6. Verify confirmation dialog appears: "Delete this expense? It can be restored by re-adding to the spreadsheet."
7. Click "OK" to confirm
8. Verify:
   - Button shows "Deleting..." during operation
   - Expense disappears from the list
   - Page total updates correctly

**Backend Verification:**
1. Open Prisma Studio: `npm run db:studio`
2. Navigate to `ExpenseAuditRecords` table
3. Verify a new record exists with:
   - `expenseId`: The deleted expense's ID
   - `amount`, `description`, `date`: Match the deleted expense
   - `categoryId`, `categoryName`, `categoryColor`: Match the category
   - `sheetName`: Correct month sheet (e.g., "November 2025")
   - `deletedAt`: Current timestamp
   - `restoredAt`: NULL

**Google Sheets Verification:**
1. Open your Google Sheets spreadsheet
2. Navigate to the appropriate month sheet
3. Verify the expense row is deleted
4. Verify the TOTAL formula still works correctly

### 2. Restoration Flow (Audit Log Recovery)

**Steps:**
1. Delete an expense (follow Test 1)
2. Note the expense ID from the audit record
3. Manually re-add the expense to Google Sheets:
   - Open the month sheet where it was deleted
   - Add a new row with the SAME expense ID
   - Fill in Date, Description, Amount, Category (can be different values)
4. Reload the `/expenses` page in your browser (this triggers sync)
5. Verify:
   - Expense appears in the expenses list
   - Values match what you entered in Google Sheets
   - No duplicate entries created

**Backend Verification:**
1. Open Prisma Studio
2. Check `Expense` table:
   - Expense exists with the original ID
   - Values match Google Sheets
3. Check `ExpenseAuditRecords` table:
   - The audit record now has `restoredAt` timestamp set
   - Record is no longer "unrestored"

**Console Logs:**
Look for these messages in the browser console or terminal:
```
[Sync] Found X unrestored audit records
[Sync] Restoring expense {id} from audit log
[Sync] Successfully restored expense {id}
```

### 3. New Expense Flow (UUID Replacement)

**Steps:**
1. Manually add an expense to Google Sheets with:
   - ID: Leave blank or use a random string like "test-123"
   - Date: Any valid date
   - Description: "Test manual entry"
   - Amount: 50.00
   - Category: Any existing category
2. Reload the `/expenses` page (triggers sync)
3. Verify:
   - Expense appears in the list
   - Google Sheets now has a proper UUID in the ID column
   - No duplicate entries

**Backend Verification:**
1. Open Prisma Studio
2. Check `Expense` table:
   - New expense exists with generated UUID
3. Check `ExpenseAuditRecords` table:
   - NO audit record for this expense (it's new, not restored)

### 4. Edge Case: Delete and Restore Multiple Times

**Steps:**
1. Delete an expense (Test 1)
2. Restore it by re-adding to Google Sheets (Test 2)
3. Delete the same expense again
4. Verify:
   - New audit record created with `deletedAt` = current time
   - Previous audit record still has `restoredAt` set (not reused)
5. Restore it again by re-adding to Google Sheets
6. Verify:
   - Second audit record now has `restoredAt` set
   - Expense restored successfully

### 5. Edge Case: Sheets API Failure During Delete

**Steps:**
1. Stop your internet connection OR modify `.env` to use invalid Google credentials
2. Try to delete an expense
3. Verify:
   - Expense disappears from UI (PostgreSQL delete succeeds)
   - Audit record created
   - Console shows error: `[DELETE] Sheets deletion failed for {id}`
4. Restore internet/credentials
5. Reload page
6. Verify:
   - Expense is gone from PostgreSQL but might still be in Sheets
   - Next sync will NOT restore it (audit record exists)

### 6. Edge Case: Duplicate Detection

**Steps:**
1. Manually add two expenses to Google Sheets with:
   - SAME date (within 1 second)
   - SAME amount (within 1 cent)
   - SAME category name
   - DIFFERENT IDs (or both blank)
2. Reload `/expenses` page
3. Verify:
   - Only ONE expense appears
   - Console shows: `[Sync] Skipping duplicate expense: {description}`

### 7. UI Behavior Tests

**Dropdown Menu:**
1. Click three-dot menu
2. Verify dropdown appears
3. Click outside the dropdown (backdrop)
4. Verify dropdown closes
5. Click three-dot menu again
6. Click "Delete" button while holding mouse down
7. Verify button shows "Deleting..." and is disabled

**Cancel Deletion:**
1. Click three-dot menu
2. Click "Delete"
3. Click "Cancel" in confirmation dialog
4. Verify:
   - Expense remains in list
   - No audit record created
   - Dropdown closes

### 8. Performance Test

**Steps:**
1. Delete 10 expenses in quick succession
2. Verify:
   - All deletions complete successfully
   - Audit records created for all
   - UI updates correctly after each deletion
3. Open PostgreSQL query tool or Prisma Studio
4. Check query performance on `ExpenseAuditRecords`:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM "ExpenseAuditRecords"
   WHERE "expenseId" = 'some-id' AND "restoredAt" IS NULL;
   ```
5. Verify indexes are being used (should be fast even with many records)

### 9. Data Integrity Tests

**Audit Record Completeness:**
1. Delete an expense
2. Check audit record has ALL required fields:
   - expenseId (matches deleted expense)
   - amount, description, date (match original)
   - categoryId, categoryName, categoryColor (match category)
   - sheetName (correct month format)
   - rowIndex (numeric, >= 0)
   - deletedAt (current timestamp)
   - restoredAt (NULL)

**Category Reference:**
1. Delete an expense
2. Delete the category it belonged to
3. Try to restore the expense from Google Sheets
4. Verify:
   - Restoration fails gracefully (category doesn't exist)
   - Error logged in console
   - Expense doesn't appear in UI

### 10. Rollback Test

**Simulate PostgreSQL Failure:**
This requires code modification for testing purposes.

1. Temporarily modify `src/app/api/expenses/[id]/route.ts`:
   ```typescript
   // After creating audit record, before deleting expense:
   if (expense.description === "TEST_ROLLBACK") {
     throw new Error("Simulated PostgreSQL failure");
   }
   ```
2. Create an expense with description "TEST_ROLLBACK"
3. Try to delete it
4. Verify:
   - Deletion fails with error message
   - Expense remains in PostgreSQL
   - NO audit record created (rollback successful)
5. Remove the test code

## Expected Console Logs

### During Sync (with restoration):
```
[Sync] Starting sync from Google Sheets to PostgreSQL...
[Sync] Found 15 expenses in Google Sheets
[Sync] Found 14 expenses in PostgreSQL
[Sync] Found 1 unrestored audit records
[Sync] Restoring expense abc123 from audit log
[Sync] Successfully restored expense abc123
[Sync] Sync complete. Synced 1 expenses, 0 errors
```

### During Delete:
```
[DELETE] Sheets deletion failed for abc123: [error message]
```
(This is expected if Sheets API fails, should not break the app)

## Success Criteria

- [ ] All delete operations create audit records
- [ ] Deleted expenses removed from both PostgreSQL and Google Sheets
- [ ] Restored expenses appear with original UUID
- [ ] UI updates correctly after deletions
- [ ] No duplicate expenses created
- [ ] Rollback works if PostgreSQL delete fails
- [ ] Indexes improve query performance
- [ ] Dark mode works for dropdown menu
- [ ] Confirmation dialog prevents accidental deletions

## Known Limitations

1. **Category must exist for restoration**: If a category is deleted, expenses in that category cannot be restored automatically. They will remain in Google Sheets but won't sync to PostgreSQL.

2. **Audit retention**: Audit records older than `AUDIT_RETENTION_DAYS` (default 180 days) can be cleaned up manually (cleanup job not yet implemented).

3. **No undo within grace period**: Once deleted, the only way to restore is by manually re-adding to Google Sheets.

## Troubleshooting

**Issue: Expense deleted but still in Google Sheets**
- Check console for Sheets API errors
- Verify Google credentials in `.env`
- Check Google Sheets API quota limits

**Issue: Restored expense not appearing**
- Check if category still exists in PostgreSQL
- Verify audit record has `restoredAt = NULL`
- Check sync logs for errors

**Issue: Audit table growing too large**
- Run manual cleanup query (cleanup job implementation pending):
  ```sql
  DELETE FROM "ExpenseAuditRecords"
  WHERE "deletedAt" < NOW() - INTERVAL '180 days';
  ```

**Issue: Type errors in TypeScript**
- Run `npm run db:generate` to regenerate Prisma client
- Restart TypeScript server in VS Code
