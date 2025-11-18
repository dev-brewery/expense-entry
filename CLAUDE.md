# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack expense tracking application built with Next.js 14 (App Router), TypeScript, **Google Sheets**, and PostgreSQL. **Google Sheets is the primary data store** where all expenses are saved, organized by month. PostgreSQL acts as a performance cache for fast reads.

## Architecture

### Frontend (Next.js App Router)
- **Pages:** Located in `src/app/` following Next.js 14 App Router conventions
  - Server Components by default for data fetching
  - Server Actions for form submissions in `src/app/expenses/new/page.tsx`
  - Dynamic routes use `[id]` folder convention
- **Styling:** Tailwind CSS with dark mode support using CSS variables
- **State Management:** Server-side rendering, no client-side state management needed currently
- **Sync Component:** `src/components/SyncChecker.tsx` runs on page load to sync from Google Sheets

### Backend (Next.js API Routes)
- **API Routes:** Located in `src/app/api/`
  - `api/expenses/route.ts` - GET (list with filters, reads from PostgreSQL), POST (create, writes to both)
  - `api/expenses/[id]/route.ts` - GET (single, reads from PostgreSQL), PATCH (update, writes to both), DELETE (deletes from both)
  - `api/categories/route.ts` - GET (list), POST (create)
  - `api/sync/route.ts` - GET (check sync status), POST (trigger sync from Google Sheets)
- **Validation:** Zod schemas in `src/lib/validations/` validate all incoming data
- **Database:** Prisma ORM with singleton pattern in `src/lib/prisma.ts`
- **Google Sheets:** Service in `src/lib/google-sheets.ts` handles all Sheets API calls
- **Sync Service:** `src/lib/sync-sheets.ts` syncs missing expenses from Sheets to PostgreSQL

### Data Storage Architecture
- **Google Sheets (Primary/Source of Truth):**
  - Located in `src/lib/google-sheets.ts`
  - Expenses organized by month (e.g., "June 2025", "September 2026")
  - Each month sheet has: Headers (row 1), TOTAL formula (row 2), Expenses (row 3+)
  - Columns: ID, Date, Description, Amount, Category, Category Color
  - All write operations (create/update/delete) write to Sheets
  - Can be manually edited, changes sync to PostgreSQL on page load

- **PostgreSQL (Performance Cache):**
  - **ORM:** Prisma with PostgreSQL
  - **Schema:** Defined in `prisma/schema.prisma`
    - Two main models: Expense and Category (one-to-many relationship)
    - Cascading deletes configured on Category → Expense
    - Indexes on `date` and `categoryId` for query performance
  - **Migrations:** Not tracked in git (in `.gitignore`) - use `db:push` for development
  - All read operations use PostgreSQL for speed
  - Automatically synced from Google Sheets on page load if data is missing

## Common Commands

### First-time Setup
```bash
npm install                    # Install dependencies
npm run docker:up              # Start PostgreSQL container
npm run db:generate            # Generate Prisma client
npm run db:push                # Push schema to database
npm run db:seed                # Seed default categories
```

### Development
```bash
npm run dev                    # Start dev server (localhost:3000)
npm run docker:up              # Start database if not running
npm run db:studio              # Open Prisma Studio (database GUI)
```

### Running a Single Test
```bash
npm test -- <test-file-path>  # Run specific test file
npm run test:watch             # Run tests in watch mode
```

### Database Operations
```bash
npm run db:generate            # Regenerate Prisma client after schema changes
npm run db:push                # Push schema changes to database (dev only)
npm run db:migrate             # Create and run migrations (production)
npm run db:seed                # Reseed the database
```

### Code Quality
```bash
npm run type-check             # Check TypeScript types
npm run lint                   # Run ESLint
npm run format                 # Format all files with Prettier
npm run format:check           # Check formatting without changing files
```

### Building and Running
```bash
npm run build                  # Build for production
npm start                      # Start production server
```

## Key Patterns and Conventions

### API Route Structure
- All routes return JSON responses using `NextResponse.json()`
- Error handling with try-catch blocks
- Zod validation before database operations
- Include related data using Prisma's `include` option

### Server Components Data Fetching
- Async functions in page components fetch data directly using Prisma
- No API route calls needed for server components
- Use `notFound()` from `next/navigation` for 404 handling

### Server Actions
- Located in page files with `'use server'` directive
- Used for form submissions (e.g., creating expenses)
- Call `redirect()` after successful mutations

### Type Safety
- All database operations use Prisma-generated types
- Zod schemas define input validation and export inferred types
- Path aliases configured: `@/*` maps to `src/*`

### Validation Schemas
- Located in `src/lib/validations/`
- Export create and update schemas separately
- Export TypeScript types inferred from Zod schemas

### Utility Functions
- `formatCurrency()` - Format numbers as USD currency
- `formatDate()` - Format dates in readable format
- `cn()` - Combine class names using clsx

## Database Schema Details

### Expense Model
- Uses `@default(cuid())` for IDs (collision-resistant unique IDs)
- `amount` stored as Float (use Decimal for production financial apps)
- `date` defaults to current timestamp
- Cascading delete from Category ensures referential integrity
- Indexes on frequently queried fields (`date`, `categoryId`)

### Category Model
- `name` field has unique constraint
- `color` stores hex color codes (validated with regex in Zod schema)
- Used for organizing and filtering expenses

## Development Notes

### Environment Variables
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Google Sheets spreadsheet ID (REQUIRED)
- `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` - JSON credentials for Google service account (REQUIRED)
- `DATABASE_URL` - PostgreSQL connection string (optional, for performance cache)
- `NEXT_PUBLIC_APP_URL` - Application URL for client-side use

### Database Connection
- Prisma client uses singleton pattern to prevent connection exhaustion
- Development logging enabled for queries/errors/warnings
- Production logging only shows errors

### Styling Approach
- Utility-first with Tailwind CSS
- Dark mode using `dark:` variant classes
- CSS variables in `globals.css` for theme colors
- Responsive design using Tailwind breakpoints

### File Organization
- Group by feature/route (e.g., all expense-related pages in `app/expenses/`)
- Shared utilities in `src/lib/`
- API routes mirror frontend route structure when possible

## Testing Strategy

- Jest configured for testing (currently no tests implemented)
- Test files should be co-located with source files or in `__tests__` directories
- Use `@testing-library/react` for component testing
- Mock Prisma client for database tests

## Future Considerations

- Authentication and user management not yet implemented
- Multi-currency support would require Decimal type for amounts
- Consider adding expense editing functionality (currently view-only after creation)
- Add expense filtering UI on the expenses list page
- Implement pagination for large expense lists (currently limited to 50)
