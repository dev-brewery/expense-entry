# Rollback Logic Test Suite

This test suite validates the dual-write rollback mechanisms implemented to maintain data consistency between PostgreSQL and Google Sheets.

## What It Tests

The test suite validates that when Google Sheets write operations fail, the corresponding PostgreSQL operations are properly rolled back:

1. **CREATE Rollback (POST /api/expenses)**
   - Creates expense in PostgreSQL
   - Attempts to write to Google Sheets (forced to fail)
   - Verifies expense is deleted from PostgreSQL (rollback)

2. **UPDATE Rollback (PATCH /api/expenses/[id])**
   - Updates expense in PostgreSQL
   - Attempts to update in Google Sheets (forced to fail)
   - Verifies expense is restored to original values in PostgreSQL (rollback)

3. **DELETE Rollback (DELETE /api/expenses/[id])**
   - Deletes expense from PostgreSQL
   - Attempts to delete from Google Sheets (forced to fail)
   - Verifies expense is recreated in PostgreSQL (rollback)

## How It Works

The test script:
1. **Backs up** your `.env.local` file
2. **Temporarily breaks** the Google Sheets credentials to force API errors
3. **Makes API calls** and verifies rollback behavior
4. **Restores** the original credentials
5. **Reports** test results

## Prerequisites

1. Development server must be running:
   ```bash
   npm run dev
   ```

2. Database must be seeded with at least one category:
   ```bash
   npm run db:seed
   ```

3. `.env.local` file must exist with valid credentials (will be temporarily modified)

## Running the Test

```bash
# Run the test suite
node test-rollback.js
```

## Expected Output

```
==================================================================
🧪 DUAL-WRITE ROLLBACK TEST SUITE
==================================================================

ℹ️  This script tests the rollback mechanisms for dual-write operations.
ℹ️  It will temporarily break Google Sheets credentials to force failures.

✅ Development server is running ✓
✅ Backed up .env.local to .env.local.backup
⚠️  Temporarily broke Google Sheets credentials
⚠️  ⏳ Waiting 2 seconds for Next.js to reload with broken credentials...

==================================================================
TEST 1: CREATE Operation Rollback
==================================================================

ℹ️  Creating a test expense (should fail at Sheets write)...
ℹ️  Test expense: TEST ROLLBACK - CREATE - $99.99
⚠️  API call failed as expected: 500 Internal Server Error
ℹ️  Checking if expense was rolled back from PostgreSQL...
✅ ✨ ROLLBACK SUCCESSFUL: Expense was NOT persisted to PostgreSQL

==================================================================
TEST 2: UPDATE Operation Rollback
==================================================================

ℹ️  Creating a test expense directly in PostgreSQL...
✅ Created expense abc123 with amount: $50.00
ℹ️  Attempting to update the expense (should fail at Sheets write)...
⚠️  API call failed as expected: 500 Internal Server Error
ℹ️  Checking if expense was rolled back to original values...
✅ ✨ ROLLBACK SUCCESSFUL: Expense restored to original values
✅   Description: TEST ROLLBACK - UPDATE ORIGINAL
✅   Amount: $50.00
✅   Notes: Original value
ℹ️  Cleaned up test expense

==================================================================
TEST 3: DELETE Operation Rollback
==================================================================

ℹ️  Creating a test expense directly in PostgreSQL...
✅ Created expense xyz789 with amount: $75.50
ℹ️  Attempting to delete the expense (should fail at Sheets and recreate)...
⚠️  API call failed as expected: 500 Internal Server Error
ℹ️  Checking if expense was recreated in PostgreSQL...
✅ ✨ ROLLBACK SUCCESSFUL: Expense was recreated after failed delete
✅   ID: xyz789
✅   Description: TEST ROLLBACK - DELETE
✅   Amount: $75.50
ℹ️  Cleaned up test expense

==================================================================
🔄 CLEANUP
==================================================================

✅ Restored Google Sheets credentials from backup
ℹ️  ⏳ Waiting 2 seconds for Next.js to reload with correct credentials...

==================================================================
📊 TEST SUMMARY
==================================================================

CREATE Rollback:  ✅ PASS
UPDATE Rollback:  ✅ PASS
DELETE Rollback:  ✅ PASS

✅ 🎉 ALL TESTS PASSED! Rollback logic is working correctly.
```

## What to Look For

### Success Indicators

1. **CREATE Test**: PostgreSQL should NOT contain the test expense after rollback
2. **UPDATE Test**: PostgreSQL should restore the original values after rollback
3. **DELETE Test**: PostgreSQL should recreate the deleted expense after rollback

### Failure Indicators

- "ROLLBACK FAILED" messages
- Test expenses remaining in database after test completion
- Modified values persisting after UPDATE rollback
- Missing expenses after DELETE rollback

## Server Logs

Check your dev server console for detailed rollback logs:

```
Failed to insert to Google Sheets, rolling back PostgreSQL entry: [error details]
Rollback successful: Deleted expense abc123 from PostgreSQL
```

Or if rollback itself fails (critical):

```
CRITICAL: Rollback failed! Data inconsistency detected: [error details]
```

## Manual Testing Alternative

You can also manually test by:

1. Temporarily renaming `.env.local`:
   ```bash
   mv .env.local .env.local.temp
   ```

2. Creating a new `.env.local` with invalid credentials:
   ```env
   GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"invalid": "credentials"}'
   ```

3. Trying to create/update/delete expenses through the UI

4. Checking PostgreSQL to verify rollback:
   ```bash
   npm run db:studio
   ```

5. Restoring credentials:
   ```bash
   mv .env.local.temp .env.local
   ```

## Troubleshooting

### "Development server is not running"
Start the dev server first:
```bash
npm run dev
```

### "No categories found in database"
Seed the database:
```bash
npm run db:seed
```

### "Backup file not found"
If the script crashes and doesn't restore credentials, manually restore from `.env.local.backup`:
```bash
cp .env.local.backup .env.local
```

### Tests Pass But You See Critical Errors in Logs
This indicates the rollback itself failed. Check:
- Database connection is stable
- No concurrent operations interfering
- PostgreSQL has sufficient permissions

## Cleanup

The script automatically:
- Restores original credentials
- Deletes test expenses from PostgreSQL
- Removes backup file

If the script crashes, you may need to manually:
1. Restore `.env.local` from `.env.local.backup`
2. Delete any test expenses from the database (descriptions start with "TEST ROLLBACK")

## Integration with CI/CD

To run this test in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Test Rollback Logic
  run: |
    npm run dev &
    sleep 5
    node test-rollback.js
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    GOOGLE_SHEETS_SPREADSHEET_ID: ${{ secrets.GOOGLE_SHEETS_SPREADSHEET_ID }}
    GOOGLE_SERVICE_ACCOUNT_CREDENTIALS: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS }}
```

## Related Documentation

- Implementation details: [.claude/CHANGES.md](.claude/CHANGES.md#2025-11-21-data-consistency---rollback-on-dual-write-failures)
- Code review analysis: [CODE_REVIEW_ANALYSIS.md](CODE_REVIEW_ANALYSIS.md)
- API routes with rollback logic:
  - [src/app/api/expenses/route.ts](src/app/api/expenses/route.ts)
  - [src/app/api/expenses/[id]/route.ts](src/app/api/expenses/[id]/route.ts)
  - [src/app/page.tsx](src/app/page.tsx)
