# Expense Delete with Audit Log & Restoration Implementation Plan

## Overview
This plan implements a delete feature for expenses with audit logging and automatic restoration capabilities. When a user deletes an expense, it's removed from both the PostgreSQL cache and Google Sheets, but retained in an audit log. If the expense is manually restored to Google Sheets, the sync process will automatically restore it from the audit log.

## Key Design Decisions

1. **Two-phase deletion**: Delete from PostgreSQL first (creating audit record), then delete from Sheets asynchronously
2. **Audit storage**: PostgreSQL table `ExpenseAuditRecords` (Google Sheets has native version history)
3. **No restoration UI**: Edge case handled automatically during sync
4. **UUID replacement**: Generate new UUID for expenses not in PostgreSQL or audit log
5. **Audit retention**: Configurable via environment variable (default 6 months)
6. **Performance**: Audit checks only during sync, with optimized database indexes

---

## 1. Database Schema Changes

**File:** `prisma/schema.prisma`

Add new model:

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

**Post-change steps:**
- Run `npm run db:generate` to regenerate Prisma client
- Run `npm run db:push` to apply schema to database

---

## 2. Environment Configuration

**Files:** `.env` and `.env.example`

Add new environment variable:

```bash
# Audit log retention period in days (default: 180 = 6 months)
AUDIT_RETENTION_DAYS=180
```

---

## 3. Validation Schema

**File:** `src/lib/validations/audit.ts` (new file)

Create Zod schema for audit record creation:

```typescript
import { z } from 'zod';

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
});

export type CreateAuditRecord = z.infer<typeof createAuditRecordSchema>;
```

---

## 4. Utility Functions

**File:** `src/lib/utils.ts` (add to existing file)

Add helper functions:

```typescript
/**
 * Get sheet name from date (e.g., "June 2025")
 */
export function getSheetNameFromDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Calculate estimated row index based on date ordering
 * Used when creating audit records
 */
export function calculateSheetRowIndex(
  date: Date,
  allExpensesInSheet: Array<{ date: Date }>
): number {
  // Sort expenses by date descending (same as sheet order)
  const sortedExpenses = [...allExpensesInSheet].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  // Find index of expense with this date
  const index = sortedExpenses.findIndex(
    exp => exp.date.getTime() === date.getTime()
  );

  return index >= 0 ? index : 0;
}
```

---

## 5. Sync Service Modifications

**File:** `src/lib/sync-sheets.ts`

### 5.1 Add Restoration Logic

Modify the main `syncExpensesFromSheets()` function:

**Current behavior:**
- For each expense from Sheets with an ID, check if exists in PostgreSQL
- If not found, generate new UUID and update sheet

**Enhanced behavior:**
- For each expense from Sheets with an ID:
  1. Check if exists in PostgreSQL (existing)
  2. **NEW:** If not in PostgreSQL, check audit log for matching `expenseId` where `restoredAt IS NULL`
  3. **NEW:** If found in audit: Restore expense to PostgreSQL using audit data, mark as restored
  4. If NOT in audit: Generate new UUID and update sheet (existing behavior)

**Code changes:**

```typescript
// Add to imports
import { ExpenseAuditRecords } from '@prisma/client';

// Add new function
async function restoreExpenseFromAudit(
  expenseId: string,
  auditRecord: ExpenseAuditRecords
): Promise<void> {
  console.log(`Restoring expense ${expenseId} from audit log`);

  try {
    // Recreate expense in PostgreSQL with original UUID
    await prisma.expense.create({
      data: {
        id: auditRecord.expenseId,
        amount: auditRecord.amount,
        description: auditRecord.description,
        date: auditRecord.date,
        categoryId: auditRecord.categoryId,
      },
    });

    // Mark audit record as restored
    await prisma.expenseAuditRecords.update({
      where: { id: auditRecord.id },
      data: { restoredAt: new Date() },
    });

    console.log(`Successfully restored expense ${expenseId}`);
  } catch (error) {
    console.error(`Failed to restore expense ${expenseId}:`, error);
    throw error;
  }
}

// Modify existing loop in syncExpensesFromSheets()
// Find the section that processes each sheet expense
// Replace the "if (!existingExpenseIds.has(id))" block with:

if (!existingExpenseIds.has(id)) {
  // Check if this expense is in the audit log (was deleted)
  const auditRecord = await prisma.expenseAuditRecords.findFirst({
    where: {
      expenseId: id,
      restoredAt: null, // Only unrestored deletions
    },
  });

  if (auditRecord) {
    // Restore from audit log
    await restoreExpenseFromAudit(id, auditRecord);
    continue; // Move to next expense
  }

  // Not in PostgreSQL and not in audit log
  // This is a truly new expense (or manually changed UUID in Sheets)
  // Keep existing behavior: check for duplicates, generate new UUID if needed

  // ... existing duplicate check code ...

  if (duplicate) {
    console.log(`Skipping duplicate expense: ${description} on ${date}`);
    continue;
  }

  // ... existing UUID generation and sheet update code ...
}
```

### 5.2 Performance Optimization

To avoid N+1 queries, batch the audit log lookups:

```typescript
// Before the loop, fetch all relevant audit records
const sheetExpenseIds = allSheetExpenses.map(e => e.id).filter(Boolean);
const auditRecords = await prisma.expenseAuditRecords.findMany({
  where: {
    expenseId: { in: sheetExpenseIds },
    restoredAt: null,
  },
});

// Create a Map for O(1) lookup
const auditMap = new Map(
  auditRecords.map(record => [record.expenseId, record])
);

// In the loop, use the Map
const auditRecord = auditMap.get(id);
if (auditRecord) {
  await restoreExpenseFromAudit(id, auditRecord);
  continue;
}
```

---

## 6. DELETE API Enhancement

**File:** `src/app/api/expenses/[id]/route.ts`

### 6.1 Modify DELETE Handler

**Current flow:**
1. Fetch expense from PostgreSQL
2. Delete from PostgreSQL
3. Delete from Google Sheets
4. Return 204

**Enhanced flow:**
1. Fetch expense with category data
2. **NEW:** Create audit record in `ExpenseAuditRecords`
3. Delete from PostgreSQL
4. Delete from Google Sheets (async, don't block response)
5. Return 204

**Implementation:**

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // 1. Fetch expense with category for audit record
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    // 2. Create audit record BEFORE deletion
    const sheetName = getSheetNameFromDate(expense.date);

    await prisma.expenseAuditRecords.create({
      data: {
        expenseId: expense.id,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        categoryId: expense.categoryId,
        categoryName: expense.category.name,
        categoryColor: expense.category.color,
        sheetName: sheetName,
        rowIndex: 0, // Exact row index not critical for restoration
      },
    });

    // 3. Delete from PostgreSQL
    await prisma.expense.delete({
      where: { id },
    });

    // 4. Delete from Google Sheets (async, don't wait)
    // Wrap in try-catch to prevent blocking
    const sheetsService = new GoogleSheetsService();
    sheetsService.deleteExpenseFromSheet(id).catch(error => {
      console.error(`Failed to delete expense ${id} from Sheets:`, error);
      // Log error but don't rollback PostgreSQL deletion
      // Audit record allows recovery if needed
    });

    // 5. Return success immediately
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
```

### 6.2 Error Handling & Rollback

**Rollback strategy:**
- If audit creation fails: Abort, don't delete
- If PostgreSQL delete fails after audit: Delete audit record, return error
- If Sheets delete fails: Log error but don't rollback (audit allows restoration)

**Enhanced implementation with rollback:**

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  let auditRecordId: string | null = null;

  try {
    // 1. Fetch expense
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    // 2. Create audit record
    const sheetName = getSheetNameFromDate(expense.date);
    const auditRecord = await prisma.expenseAuditRecords.create({
      data: {
        expenseId: expense.id,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        categoryId: expense.categoryId,
        categoryName: expense.category.name,
        categoryColor: expense.category.color,
        sheetName: sheetName,
        rowIndex: 0,
      },
    });
    auditRecordId = auditRecord.id;

    // 3. Delete from PostgreSQL
    try {
      await prisma.expense.delete({
        where: { id },
      });
    } catch (deleteError) {
      // Rollback: Delete audit record
      if (auditRecordId) {
        await prisma.expenseAuditRecords.delete({
          where: { id: auditRecordId },
        });
      }
      throw deleteError;
    }

    // 4. Delete from Sheets (async, best effort)
    const sheetsService = new GoogleSheetsService();
    sheetsService.deleteExpenseFromSheet(id).catch(error => {
      console.error(`Sheets deletion failed for ${id}:`, error);
      // Don't rollback - audit log allows recovery
    });

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
```

---

## 7. UI Changes - Expenses Table

**File:** `src/app/expenses/page.tsx`

### 7.1 Add Actions Column

Convert the table to support client-side interactions while keeping server-side rendering for data:

**Option A: Server Actions (Recommended)**

Keep as server component, use server actions for deletion:

```typescript
// Add server action at top of file
'use server'

import { revalidatePath } from 'next/cache';

async function deleteExpense(formData: FormData) {
  'use server';

  const id = formData.get('id') as string;

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/expenses/${id}`, {
    method: 'DELETE',
  });

  if (response.ok) {
    revalidatePath('/expenses');
  }
}

// In the table, add Actions column header:
<thead>
  <tr>
    <th>Date</th>
    <th>Description</th>
    <th>Category</th>
    <th className="text-right">Amount</th>
    <th className="text-right">Actions</th> {/* NEW */}
  </tr>
</thead>

// In the table body, add Actions cell:
<tbody>
  {expenses.map((expense) => (
    <tr key={expense.id}>
      <td>{formatDate(expense.date)}</td>
      <td>
        <Link href={`/expenses/${expense.id}`}>
          {expense.description}
        </Link>
      </td>
      <td>
        <span className="badge" style={{ backgroundColor: expense.category.color }}>
          {expense.category.name}
        </span>
      </td>
      <td className="text-right">{formatCurrency(expense.amount)}</td>
      <td className="text-right">
        <DeleteButton expenseId={expense.id} /> {/* NEW */}
      </td>
    </tr>
  ))}
</tbody>
```

**Option B: Client Component for Actions Column**

Create a separate client component for the delete button:

**File:** `src/components/DeleteExpenseButton.tsx` (new file)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteExpenseButtonProps {
  expenseId: string;
}

export function DeleteExpenseButton({ expenseId }: DeleteExpenseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('Delete this expense? It can be restored by re-adding to the spreadsheet.')) {
      setIsOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.refresh(); // Reload server component data
      } else {
        alert('Failed to delete expense');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete expense');
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* Vertical ellipsis button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
        aria-label="Actions"
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 z-20 mt-2 w-32 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Update:** `src/app/expenses/page.tsx`

```typescript
import { DeleteExpenseButton } from '@/components/DeleteExpenseButton';

// In table:
<td className="text-right">
  <DeleteExpenseButton expenseId={expense.id} />
</td>
```

### 7.2 Styling Details

**Colors (Tailwind classes):**
- Ellipsis button: `text-gray-400` (#9CA3AF)
- Ellipsis hover: `text-gray-600` (#4B5563)
- Delete text: `text-red-600` (red)
- Delete hover background: `bg-red-50` (light red)

**Dark mode variants:**
- Ellipsis hover: `dark:text-gray-300`
- Menu background: `dark:bg-gray-800`
- Delete hover: `dark:bg-red-900/20`

---

## 8. Audit Cleanup Job (Optional - Future Enhancement)

**File:** `src/lib/cleanup-audit.ts` (new file)

Create a utility to clean up old audit records:

```typescript
import { prisma } from './prisma';

export async function cleanupOldAuditRecords(): Promise<number> {
  const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '180', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.expenseAuditRecords.deleteMany({
    where: {
      deletedAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`Cleaned up ${result.count} audit records older than ${retentionDays} days`);
  return result.count;
}
```

**File:** `src/app/api/admin/cleanup-audit/route.ts` (new file)

Create an API endpoint to trigger cleanup:

```typescript
import { NextResponse } from 'next/server';
import { cleanupOldAuditRecords } from '@/lib/cleanup-audit';

export async function POST() {
  try {
    const deletedCount = await cleanupOldAuditRecords();
    return NextResponse.json({ deletedCount });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup audit records' },
      { status: 500 }
    );
  }
}
```

**Future:** Set up a cron job (Vercel Cron, GitHub Actions, etc.) to call this endpoint weekly or monthly.

---

## 9. Testing Strategy

### 9.1 Manual Testing Checklist

**Delete Flow:**
- [ ] Delete an expense via UI
- [ ] Verify audit record created in PostgreSQL
- [ ] Verify expense removed from PostgreSQL
- [ ] Verify expense removed from Google Sheets
- [ ] Verify UI updates (expense disappears)

**Restoration Flow:**
- [ ] Manually re-add deleted expense to Google Sheets (same UUID)
- [ ] Trigger sync (reload expenses page)
- [ ] Verify expense restored to PostgreSQL
- [ ] Verify audit record marked as restored (`restoredAt` not null)
- [ ] Verify expense appears in UI

**New Expense Flow (UUID replacement):**
- [ ] Manually add expense to Google Sheets with random/invalid UUID
- [ ] Trigger sync
- [ ] Verify new UUID generated and updated in Sheets
- [ ] Verify expense created in PostgreSQL with new UUID

**Edge Cases:**
- [ ] Delete and restore same expense multiple times
- [ ] Delete expense, manually add with different UUID (should create new)
- [ ] Delete expense, wait beyond retention period, try to restore
- [ ] Delete expense while Sheets API is down (should succeed in PostgreSQL)

### 9.2 Automated Testing (Future)

**Integration tests:**
```typescript
describe('DELETE /api/expenses/[id]', () => {
  it('should create audit record and delete expense', async () => {
    // Create test expense
    // DELETE request
    // Verify audit record exists
    // Verify expense deleted
  });

  it('should rollback if PostgreSQL delete fails', async () => {
    // Mock PostgreSQL error
    // Verify audit record deleted
  });
});

describe('syncExpensesFromSheets', () => {
  it('should restore expense from audit log', async () => {
    // Create audit record
    // Add expense to mock Sheets data
    // Run sync
    // Verify expense restored
    // Verify audit record marked as restored
  });

  it('should generate new UUID for unknown expenses', async () => {
    // Add expense with unknown UUID to Sheets
    // Run sync
    // Verify new UUID generated
    // Verify Sheets updated
  });
});
```

---

## 10. Implementation Order

Follow this sequence to minimize risk:

1. **Database schema** (Section 1)
   - Add `ExpenseAuditRecords` model
   - Run `db:generate` and `db:push`
   - Verify table created

2. **Environment configuration** (Section 2)
   - Add `AUDIT_RETENTION_DAYS` to `.env` and `.env.example`

3. **Validation schema** (Section 3)
   - Create `src/lib/validations/audit.ts`

4. **Utility functions** (Section 4)
   - Add helpers to `src/lib/utils.ts`

5. **DELETE API enhancement** (Section 6)
   - Modify DELETE handler to create audit records
   - Test deletion creates audit records correctly

6. **Sync service modifications** (Section 5)
   - Add restoration logic
   - Add batch audit lookup optimization
   - Test restoration from audit log

7. **UI changes** (Section 7)
   - Create `DeleteExpenseButton` component
   - Add to expenses table
   - Test delete flow in browser

8. **Testing** (Section 9)
   - Run through manual test checklist
   - Fix any issues found

9. **Cleanup job** (Section 8) - Optional, can be added later
   - Create cleanup utility
   - Create API endpoint
   - Set up cron job

---

## 11. Performance Considerations

### Database Performance
- **Indexes:** Three indexes on `ExpenseAuditRecords` ensure fast lookups
  - `expenseId` - O(log n) lookup during sync
  - `deletedAt` - Fast cleanup queries
  - Composite `(expenseId, restoredAt)` - Optimized for "find unrestored" queries

- **Batch queries:** Audit lookups batched using `WHERE IN (...)` to avoid N+1 queries

### Sync Performance
- Audit checks only during sync (not on page load)
- Skip restored records with `restoredAt IS NULL` filter
- No additional Sheets API calls (restoration uses existing data)

### UI Performance
- Delete operation returns immediately after PostgreSQL deletion
- Sheets deletion happens asynchronously
- No blocking on Sheets API response time

### Google Sheets API Quota
- Delete = 1 write request (delete row)
- UUID update = 1 write request (for new expenses)
- Well within quota limits (100 requests/100 seconds)

---

## 12. Monitoring & Observability

### Key Metrics to Track

1. **Audit log size:**
   - Monitor `ExpenseAuditRecords` table row count
   - Alert if growing faster than expected
   - Set up automated cleanup before it becomes an issue

2. **Restoration rate:**
   - Track how often `restoredAt` is updated
   - If high, may indicate user confusion or workflow issues

3. **Failed deletions:**
   - Log when Sheets deletion fails
   - Monitor for patterns (API downtime, quota issues)

4. **Sync duration:**
   - Track time to complete sync
   - Alert if audit lookups slow down sync significantly

### Logging Recommendations

Add structured logging:
```typescript
console.log({
  action: 'expense_deleted',
  expenseId: id,
  amount: expense.amount,
  auditRecordId: auditRecord.id,
  timestamp: new Date().toISOString(),
});

console.log({
  action: 'expense_restored',
  expenseId: id,
  auditRecordId: auditRecord.id,
  timestamp: new Date().toISOString(),
});
```

---

## 13. Rollout Plan

### Pre-deployment
1. Review all code changes
2. Test locally with Docker PostgreSQL
3. Test against production Google Sheets (in dev mode)
4. Verify environment variable set in deployment platform

### Deployment
1. Deploy database schema changes first
2. Verify `ExpenseAuditRecords` table exists in production
3. Deploy application code
4. Monitor logs for first few deletions
5. Manually test delete + restore flow

### Post-deployment
1. Monitor audit log growth over first week
2. Verify sync performance hasn't degraded
3. Check Google Sheets API quota usage
4. Set up automated cleanup job (if not done in initial release)

---

## 14. Future Enhancements

### Nice-to-have features (not in initial scope):
1. **Deleted expenses UI** - View/restore deleted expenses manually
2. **Bulk restore** - Restore multiple expenses at once
3. **Audit log export** - Download audit logs as CSV
4. **Soft delete option** - Flag as deleted instead of hard delete
5. **Undo within X seconds** - Grace period to undo deletion
6. **Deletion reason** - Capture why expense was deleted
7. **User attribution** - Track who deleted (when auth is added)

---

## Summary

This implementation adds a complete delete workflow with:
- ✅ Audit logging of all deletions
- ✅ Automatic restoration from audit log when expense re-added to Sheets
- ✅ UUID replacement for truly new expenses
- ✅ Minimal performance impact (audit checks only during sync, optimized queries)
- ✅ Clean UI with dropdown menu
- ✅ Configurable retention period
- ✅ Robust error handling and rollback

The design prioritizes simplicity, performance, and resilience while handling the edge case of manual Sheet restorations automatically.
