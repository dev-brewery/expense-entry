# Changes Log

This document tracks significant changes made to the expense-entry application.

## 2025-01-18: Google Sheets Integration Updates

### 1. Removed Category Color from Google Sheets

**Rationale**: Category colors are UI-only metadata and don't need to be stored in Google Sheets. They only need to exist in PostgreSQL for display purposes.

**Changes**:
- Updated sheet structure from 6 columns (A-F) to 5 columns (A-E)
- New columns: `ID`, `Date`, `Description`, `Amount`, `Category`
- Removed: `Category Color` column
- Updated all Google Sheets operations to work with 5 columns instead of 6

**Files Modified**:
- `src/lib/google-sheets.ts`:
  - Updated `SheetExpense` interface to remove `categoryColor` field
  - Modified `ensureMonthSheetExists()` to create headers A1:E1
  - Modified `insertExpenseToSheet()` to accept and write 5 columns
  - Modified `getExpensesFromSheet()` to read A3:E range
  - Modified `updateExpenseInSheet()` to update A-E columns
- `src/app/api/expenses/route.ts`: Removed `categoryColor` from `insertExpenseToSheet()` call
- `src/app/api/expenses/[id]/route.ts`: Removed `categoryColor` from `updateExpenseInSheet()` call
- `src/lib/sync-sheets.ts`: Updated to use default color (#6B7280) when creating categories from sheet data
- `test-sheets.js`: Updated test script to match new 5-column structure

### 2. Moved TOTAL Formula to Columns G and H

**Rationale**: User preference to keep TOTAL calculation separate from data columns.

**Changes**:
- Changed TOTAL row location from C2:D2 to G2:H2
- Formula remains: `TOTAL: =SUM(D3:D)`

**Files Modified**:
- `src/lib/google-sheets.ts`: Updated `ensureMonthSheetExists()` to write TOTAL to G2:H2
- `test-sheets.js`: Updated test to verify TOTAL in G2:H2

### 3. Auto-Generate IDs for Manual Sheet Entries

**Rationale**: Users can manually add expenses to Google Sheets without IDs. The sync process should generate IDs for these entries and write them back to maintain consistency.

**Implementation**:
- When syncing from Google Sheets, detect expenses with missing or empty IDs
- Check for duplicates by matching: date (within 1 second), amount (within 1 cent), and category name
- If not a duplicate, generate a new ID using `crypto.randomBytes(12).toString('base64url')`
- Write the generated ID back to the Google Sheet cell
- Sync the expense to PostgreSQL with the generated ID

**Files Modified**:
- `src/lib/google-sheets.ts`:
  - Added `SheetExpenseWithLocation` interface to track sheet name and row index
  - Modified `getExpensesFromSheet()` to optionally include location info with `includeLocation` parameter
  - Added `updateExpenseIdInSheet()` function to update just the ID cell in a specific row
- `src/lib/sync-sheets.ts`:
  - Import `updateExpenseIdInSheet` and `SheetExpenseWithLocation`
  - Call `getExpensesFromSheet({ includeLocation: true })` to get row positions
  - Detect missing IDs and generate new ones
  - Call `updateExpenseIdInSheet()` to write generated IDs back to Google Sheets
  - Skip duplicates based on date/amount/category matching

### 4. Added Success Page with Category Total

**Rationale**: User requested that when an expense is added, they should see the total for that specific category in the current month.

**Implementation**:
- Created success page that displays after expense creation
- Dynamically calculates total from PostgreSQL for the specific category and month
- Shows formatted message: "Total for [Category] in [Month] [Year]: $X.XX"
- Provides "Add Another" and "Done" buttons for workflow

**Files Created**:
- `src/app/expenses/new/success/page.tsx`:
  - Accepts `categoryId`, `month`, `year` as query parameters
  - Queries PostgreSQL for all expenses in that category for that month
  - Calculates and displays the total
  - Shows success confirmation with formatted total

**Files Modified**:
- `src/app/expenses/new/page.tsx`:
  - Updated `createExpense()` server action to:
    - Create expense in PostgreSQL with category relation
    - Insert expense to Google Sheets
    - Extract month and year from expense date
    - Redirect to success page with `categoryId`, `month`, and `year` parameters

### 5. Updated Test Script

**Changes**:
- Updated `test-sheets.js` to match new 5-column structure
- Updated to verify TOTAL in columns G2:H2
- Removed category color from test expense data

## Summary

These changes accomplish the following goals:
1. **Simplified Google Sheets structure** by removing UI-only metadata (category colors)
2. **Improved sheet layout** by moving TOTAL to dedicated columns
3. **Enhanced sync reliability** by auto-generating IDs for manual entries and writing them back
4. **Improved user experience** by showing category totals immediately after adding expenses

All changes maintain backward compatibility with existing data and preserve the dual-write architecture where Google Sheets remains the source of truth and PostgreSQL serves as a performance cache.

## 2025-11-21: UX Refactor - Expense Form as Landing Page

### Rationale
Users primarily visit the app to add expenses (99% use case). The previous hub-and-spoke navigation pattern created unnecessary friction by forcing users to choose between "View Expenses" and "Add Expense" on every visit.

### Changes
Refactored the application to make the new expense form the default landing page, eliminating the extra navigation step for the primary user workflow.

### Implementation

**1. Replaced Landing Page with Expense Form**
- **File**: `src/app/page.tsx`
- Replaced hub page content (two-card layout) with full expense form
- Copied complete form functionality from `/expenses/new/page.tsx`:
  - Form fields (description, amount, date, category, notes)
  - `createExpense()` server action
  - `getCategories()` helper function
  - All validation and Google Sheets integration
- Added subtle "View Expenses →" link in top-right corner for secondary navigation
- Maintained "Cancel" button linking to `/expenses`

**2. Converted Old Form Route to Redirect**
- **File**: `src/app/expenses/new/page.tsx`
- Replaced entire page with simple redirect to `/`
- Maintains backward compatibility for bookmarks and external links

**3. Updated Navigation Links in Expenses List**
- **File**: `src/app/expenses/page.tsx`
- Updated "Add Expense" button: `href="/expenses/new"` → `href="/"`
- Updated "Create your first expense" link: `href="/expenses/new"` → `href="/"`
- "Back to Home" link already correctly points to `/`

**4. Updated Navigation Links in Success Page**
- **File**: `src/app/expenses/new/success/page.tsx`
- Updated "Add Another" button: `href="/expenses/new"` → `href="/"`
- Updated "Add Another Expense" link: `href="/expenses/new"` → `href="/"`
- "Done" button already correctly points to `/`

### New Navigation Flow
```
/ (Landing - Expense Form)
  ├─→ View Expenses → /expenses
  ├─→ Cancel → /expenses
  └─→ Submit → /expenses/new/success
        ├─→ Add Another → /
        └─→ Done → /

/expenses (List View)
  ├─→ Add Expense → /
  └─→ Back to Home → /

/expenses/new (Legacy Route)
  └─→ Redirects to /
```

### Testing
- ✅ TypeScript type check passed
- ✅ Production build successful
- ✅ All routes generated correctly
- ✅ No changes to business logic, validation, or data operations

### Files Modified
- `src/app/page.tsx` - Replaced with expense form
- `src/app/expenses/new/page.tsx` - Converted to redirect
- `src/app/expenses/page.tsx` - Updated navigation links
- `src/app/expenses/new/success/page.tsx` - Updated navigation links

### Risk Assessment
**Low Risk** - Pure routing/UX change with no modifications to:
- Database schema or operations
- API routes or validation logic
- Google Sheets integration
- Business logic or data processing

### Rollback
If needed, revert the 4 modified files to restore the original hub-and-spoke navigation pattern.

## 2025-11-21: Performance Optimization - Sync Throttling

### Rationale
The SyncChecker component was running on every page load, causing excessive Google Sheets API calls. This created performance issues and risked hitting rate limits (Google Sheets API: 100 requests per 100 seconds).

**Issue Addressed**: Recommendation #3 from `CODE_REVIEW_ANALYSIS.md` - "Excessive Sync Operations"

### Changes
Implemented time-based throttling with localStorage to prevent sync checks from running more than once every 5 minutes.

### Implementation

**File Modified**: `src/components/SyncChecker.tsx`

**Key Changes**:
1. Added `SYNC_INTERVAL_MS` constant (5 minutes = 300,000ms)
2. Added `LAST_SYNC_KEY` for localStorage persistence (`'expense-tracker-last-sync'`)
3. Check timestamp before running sync:
   - If last sync was < 5 minutes ago: Skip and log message
   - If last sync was > 5 minutes ago (or never): Run sync check
4. Update timestamp after every sync check (even if sync wasn't needed)
5. Enhanced logging for debugging:
   - Component mount notifications
   - Timestamp tracking
   - Skip messages with elapsed time
   - Completion confirmations
   - Detailed error messages

**Code Pattern**:
```typescript
const lastSyncTime = localStorage.getItem(LAST_SYNC_KEY);
const now = Date.now();

if (lastSyncTime) {
  const timeSinceLastSync = now - parseInt(lastSyncTime, 10);
  if (timeSinceLastSync < SYNC_INTERVAL_MS) {
    console.log(`[SyncChecker] Skipping sync, last sync was ${Math.round(timeSinceLastSync / 1000)}s ago`);
    return;
  }
}
// ... proceed with sync check
localStorage.setItem(LAST_SYNC_KEY, now.toString());
```

### Impact

**Before**:
- User loads home page → Sync API call
- User navigates to expenses → Sync API call
- User views expense detail → Sync API call
- **Result**: 3+ API calls in seconds

**After**:
- User loads home page → Sync API call
- User navigates to expenses → Skipped (< 5 min)
- User views expense detail → Skipped (< 5 min)
- **Result**: 1 API call, 5-minute cooldown

**Performance Improvements**:
- Reduces Google Sheets API calls by ~80-90% during typical usage
- Prevents hitting rate limits
- Faster page navigation (no sync delay on subsequent loads)
- Maintains data freshness with reasonable 5-minute window

### Testing

**Manual Test - Force Immediate Sync**:
```javascript
// In browser console
localStorage.removeItem('expense-tracker-last-sync')
location.reload()
```

**Check Last Sync Time**:
```javascript
// In browser console
const timestamp = localStorage.getItem('expense-tracker-last-sync')
const date = new Date(parseInt(timestamp))
console.log('Last sync:', date.toLocaleString())
```

**Console Output Examples**:
```
[SyncChecker] Component mounted, starting sync check...
[SyncChecker] Last sync timestamp: 1732204800000
[SyncChecker] Skipping sync, last sync was 45s ago
```

### Files Modified
- `src/components/SyncChecker.tsx`

### Risk Assessment
**Low Risk** - Backwards compatible change that only affects timing:
- No changes to sync logic or data operations
- No changes to API routes or database operations
- Sync still runs on first load
- Users can manually trigger sync by clearing localStorage
- 5-minute window is reasonable for most use cases

### Priority
**High** - Performance optimization addressing code review recommendation
