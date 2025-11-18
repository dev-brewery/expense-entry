# Expense Entry

A full-stack expense tracking application built with Next.js 14, TypeScript, Google Sheets, and PostgreSQL. **Expenses are stored in Google Sheets** with automatic monthly organization, while PostgreSQL serves as an optional performance cache.

## Features

- **Google Sheets Integration** - All expenses automatically saved to Google Sheets
- **Monthly Organization** - Expenses organized into monthly sheets (e.g., "June 2025", "September 2026")
- **Automatic Totals** - Each month sheet includes automatic SUM formulas for total spending
- Create, read, update, and delete expenses
- Categorize expenses with custom categories
- View expense history with filtering
- Responsive UI with dark mode support
- Type-safe API with Zod validation
- PostgreSQL database for performance caching (optional)

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Server Actions
- **Primary Data Store:** Google Sheets API
- **Cache Database:** PostgreSQL with Prisma ORM (optional for performance)
- **Validation:** Zod
- **Development:** ESLint, Prettier, Docker

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL database)
- npm, yarn, or pnpm
- **Google Cloud Project** with Sheets API enabled
- **Google Service Account** with access to your spreadsheet

## Getting Started

### 1. Set up Google Sheets Integration

#### Step 1.1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

#### Step 1.2: Create a Service Account

1. In the Google Cloud Console, go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials"** at the top
3. Select **"Service Account"** from the dropdown
4. Fill in the service account details on the first page:
   - **Service account name**: `expense-entry-service` (or any name you prefer)
   - **Service account ID**: This will auto-fill based on the name
   - **Description** (optional): "Service account for expense tracking app"
   - Click **"Create and Continue"**
5. On the "Grant this service account access to project" page:
   - **DO NOT select any role** - just click **"Continue"**
   - We'll grant access directly to the spreadsheet instead of at the project level
6. On the "Grant users access to this service account" page:
   - Leave everything blank and click **"Done"**
7. You'll see your new service account in the list. Click on it to open the details
8. Go to the **"Keys"** tab
9. Click **"Add Key" > "Create new key"**
10. Choose **"JSON"** format and click **"Create"**
11. **A JSON file will download automatically** - this file contains your credentials
    - The file will be named something like `your-project-xxxxx.json`
    - **Keep this file secure** - it gives access to your spreadsheet
    - You'll copy the contents of this file into your `.env` file later

#### Step 1.3: Create a Google Spreadsheet and Share with Service Account

1. Go to [Google Sheets](https://sheets.google.com/)
2. Click the **"+ Blank"** button to create a new blank spreadsheet
3. At the top, click "Untitled spreadsheet" and name it **"Expense Tracker"** (or whatever you prefer)
4. Copy the **Spreadsheet ID** from the URL in your browser:
   - The URL format is: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
   - Example: If your URL is `https://docs.google.com/spreadsheets/d/1ABC-xyz123/edit`, the ID is `1ABC-xyz123`
   - Copy this ID - you'll need it for the `.env` file
5. **Share the spreadsheet with your service account:**

   **Finding the Service Account Email:**
   - Open the JSON file you downloaded in Step 1.2 with any text editor
   - Look for the `client_email` field - it will look something like:
     ```json
     "client_email": "expense-entry-service@your-project-123456.iam.gserviceaccount.com"
     ```
   - Copy this entire email address

   **Sharing the Sheet:**
   - In your Google Sheet, click the **"Share"** button in the top-right corner
   - In the "Add people and groups" field, **paste the service account email** you just copied
   - Make sure the permission dropdown says **"Editor"** (not "Viewer" or "Commenter")
   - **IMPORTANT**: Uncheck the box that says **"Notify people"** - the service account won't receive emails
   - Click **"Share"** or **"Done"**

   You should now see the service account email listed under "People with access" with "Editor" permission.

**Why Editor permission?** The app needs to:
- Create new month sheets (e.g., "June 2025")
- Add/update/delete expense rows
- Add formulas for totals

**Security Note:** Only this service account can access the sheet via the API. Your personal Google account still has full control and can revoke access anytime by removing the service account from the share settings.

### 2. Clone the repository

```bash
git clone <repository-url>
cd expense-entry
```

### 3. Install dependencies

```bash
npm install
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Edit the `.env` file and add your Google Sheets credentials:

#### Understanding the JSON Credentials File

Your downloaded JSON file looks like this (with real values instead of `...`):

```json
{
  "type": "service_account",
  "project_id": "your-project-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n",
  "client_email": "expense-entry-service@your-project-123456.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

#### Configuring the .env file

1. **Get the Spreadsheet ID** from Step 1.3 (from the URL)
2. **Get the JSON credentials** - open the JSON file with a text editor and copy the entire contents
3. Edit your `.env` file to look like this:

```bash
# Database (optional - used for caching/performance)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/expense_entry?schema=public"

# Google Sheets Integration (REQUIRED)
GOOGLE_SHEETS_SPREADSHEET_ID="1ABC-xyz123"
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"type":"service_account","project_id":"your-project-123456","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n","client_email":"expense-entry-service@your-project-123456.iam.gserviceaccount.com","client_id":"123456789...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}'

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Important:**
- For `GOOGLE_SHEETS_SPREADSHEET_ID`: Paste the Spreadsheet ID from Step 1.3
- For `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`:
  - Copy the **entire contents** of your JSON file
  - Remove all newlines and formatting - it should be **one single line**
  - Keep it wrapped in single quotes `'...'`
  - The `\n` characters in the private key are important - keep them as-is

### 5. Start the PostgreSQL database

```bash
npm run docker:up
```

### 6. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed the database with default categories
npm run db:seed
```

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 8. How it Works

- **Creating expenses**: Expenses are saved to both PostgreSQL and Google Sheets
- **Google Sheets organization**: Each month gets its own sheet (e.g., "June 2025", "September 2026")
- **Automatic totals**: Each month sheet includes a TOTAL row with a SUM formula
- **Reading expenses**: Data is read from PostgreSQL for performance
- **Sync**: On page load, the app checks Google Sheets for any manually-added expenses and syncs them to PostgreSQL
- **Editing in Sheets**: You can manually add/edit expenses in Google Sheets, and they'll be synced to the app on next page load

## Troubleshooting Google Sheets Setup

### Error: "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable is not set"

**Solution:** Make sure your `.env` file has the `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` variable set with the full JSON content on a single line.

### Error: "Failed to create/access sheet" or "Permission denied"

**Possible causes:**
1. **Service account not shared with the sheet**
   - Open your Google Sheet
   - Click "Share" and verify the service account email is listed with "Editor" permission
   - The email should look like: `your-service@your-project.iam.gserviceaccount.com`

2. **Wrong spreadsheet ID**
   - Check your `.env` file has the correct `GOOGLE_SHEETS_SPREADSHEET_ID`
   - The ID should be from the URL: `https://docs.google.com/spreadsheets/d/{THIS_PART}/edit`

3. **Google Sheets API not enabled**
   - Go to Google Cloud Console > "APIs & Services" > "Library"
   - Search for "Google Sheets API" and make sure it's enabled

### Error: "Invalid JSON in GOOGLE_SERVICE_ACCOUNT_CREDENTIALS"

**Solution:**
- Open your downloaded JSON file in a text editor
- Copy the **entire contents** (including the outer `{` and `}`)
- Make sure it's all on **one line** in the `.env` file
- Wrap it in **single quotes** `'...'` not double quotes
- Example: `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"type":"service_account",...}'`

### How to verify the setup is working

1. Start the dev server: `npm run dev`
2. Open the app and create a test expense
3. Open your Google Sheet - you should see:
   - A new sheet tab created for the current month (e.g., "January 2025")
   - Header row: ID, Date, Description, Amount, Category, Category Color
   - Total row: "TOTAL:" with a SUM formula
   - Your test expense in row 3

### Finding your service account email

If you've lost the service account email:
1. Open the JSON credentials file you downloaded
2. Look for the `client_email` field
3. Or go to Google Cloud Console > "IAM & Admin" > "Service Accounts"
4. Your service account will be listed there with its email

## Available Scripts

### Development
- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Database
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Seed database with default data

### Docker
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers
- `npm run docker:logs` - View Docker logs

### Testing
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Project Structure

```
expense-entry/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding script
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API routes
│   │   ├── expenses/      # Expense pages
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Home page
│   │   └── globals.css    # Global styles
│   └── lib/               # Shared utilities
│       ├── prisma.ts      # Prisma client singleton
│       ├── utils.ts       # Utility functions
│       └── validations/   # Zod schemas
├── docker-compose.yml     # Docker configuration
├── next.config.js         # Next.js configuration
├── tailwind.config.ts     # Tailwind configuration
└── tsconfig.json          # TypeScript configuration
```

## Database Schema

### Expense
- `id`: Unique identifier
- `amount`: Expense amount (Float)
- `description`: Expense description
- `date`: Date of expense
- `categoryId`: Reference to Category
- `receipt`: Optional receipt URL
- `notes`: Optional notes
- `createdAt`: Creation timestamp
- `updatedAt`: Update timestamp

### Category
- `id`: Unique identifier
- `name`: Category name (unique)
- `color`: Optional color hex code
- `createdAt`: Creation timestamp
- `updatedAt`: Update timestamp

## API Endpoints

### Expenses
- `GET /api/expenses` - List all expenses (with optional filters)
  - Query params: `?sync=true` to force sync from Google Sheets before fetching
  - `startDate`, `endDate`, `categoryId` for filtering
- `POST /api/expenses` - Create a new expense (writes to both PostgreSQL and Google Sheets)
- `GET /api/expenses/[id]` - Get a specific expense
- `PATCH /api/expenses/[id]` - Update an expense (updates both PostgreSQL and Google Sheets)
- `DELETE /api/expenses/[id]` - Delete an expense (deletes from both PostgreSQL and Google Sheets)

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create a new category

### Sync
- `GET /api/sync` - Check if sync is needed
- `POST /api/sync` - Manually trigger sync from Google Sheets to PostgreSQL

## Data Flow

### Writing Data (Create/Update/Delete)
1. User creates/updates/deletes an expense via the UI
2. API route validates the data with Zod
3. **Data is written to PostgreSQL** (fast, local cache)
4. **Data is written to Google Sheets** (source of truth)
5. Response returned to user

### Reading Data (List/Get)
1. User requests expenses via the UI
2. **Data is read from PostgreSQL** (fast)
3. Data returned to user

### Syncing (Page Load)
1. On page load, SyncChecker component runs
2. Checks if Google Sheets has more expenses than PostgreSQL
3. If yes, fetches all expenses from Google Sheets
4. For each expense in Sheets not in PostgreSQL:
   - Creates the category if it doesn't exist
   - Inserts the expense into PostgreSQL
5. User notification shows how many expenses were synced

This architecture ensures:
- **Google Sheets is the source of truth** - you can manually edit expenses there
- **PostgreSQL provides fast reads** - no API rate limits or latency
- **Automatic sync keeps data consistent** - manual edits in Sheets appear in the app

## Development Workflow

1. Make changes to the code
2. Run `npm run format` to format code
3. Run `npm run lint` to check for linting issues
4. Run `npm run type-check` to check TypeScript types
5. Run `npm test` to run tests
6. Commit your changes

## License

MIT
