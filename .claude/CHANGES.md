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
