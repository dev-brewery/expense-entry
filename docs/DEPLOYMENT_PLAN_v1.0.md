# Production Deployment Plan: Expense Entry v1.0
## Unraid + Docker Compose + Nginx Proxy Manager

**Target Domain:** `expenses.brewerwebdesign.com`
**Deployment Platform:** Unraid with Docker Compose on `proxynet`
**SSL:** Let's Encrypt wildcard cert `*.brewerwebdesign.com`
**Reverse Proxy:** Nginx Proxy Manager
**Estimated Work:** 12-16 hours

---

## Executive Summary

This plan prepares the expense-entry application for production deployment as version 1.0. Based on comprehensive Gemini analysis, the application is currently 70% production-ready. This plan addresses all critical issues, adds simple cookie-based authentication, and provides complete Docker containerization for Unraid deployment.

**Key Changes:**
- [ ] Create production-ready Dockerfile with multi-stage build
- [ ] Add simple cookie-based authentication (shared passcode)
- [x] Fix Next.js configuration for Docker deployment
- [x] Implement environment validation and error handling
- [ ] Create Unraid-specific docker-compose.yml for `proxynet`
- [x] Add health check endpoint
- [x] Replace console.log with production-safe logging
- [ ] Configure bind mounts to `/mnt/user/appdata/expense-entry/`
- [x] Set version to 1.0.0 in package.json

---

## Phase 1: Critical Production Fixes

### 1.1 Update package.json to Version 1.0.0

**File:** `package.json`

**Change:**
```json
{
  "name": "expense-entry",
  "version": "1.0.0",
  "description": "Full-stack expense tracking with Google Sheets integration"
}
```

---

### 1.2 Fix Next.js Configuration

**File:** `next.config.js`

**Current Issue:** Missing `output: 'standalone'` - required for Docker

**Add:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // CRITICAL: Required for Docker deployment
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
```

**Rationale:** Next.js standalone mode creates a minimal production build with only required dependencies, reducing Docker image size from ~450MB to ~200MB.

---

### 1.3 Create Environment Validation

**File:** `src/lib/env-validation.ts` (NEW)

**Purpose:** Validate required environment variables at startup with clear error messages

```typescript
export function validateEnvironment() {
  const required = [
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS',
    'DATABASE_URL',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    const errorMsg = `
╔════════════════════════════════════════════════════════════╗
║  CONFIGURATION ERROR: Missing Required Environment Variables  ║
╚════════════════════════════════════════════════════════════╝

Missing: ${missing.join(', ')}

Please ensure all required environment variables are set in your .env file.
See .env.example for reference.
    `.trim()

    throw new Error(errorMsg)
  }

  // Validate Google credentials are valid JSON
  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS!)
    if (!creds.type || !creds.project_id || !creds.private_key) {
      throw new Error('Invalid credentials structure')
    }
  } catch (error) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON or is missing required fields. ' +
      'Error: ' + (error as Error).message
    )
  }

  console.log('✅ Environment validation passed')
}
```

**Integration:** Import and call in `src/app/layout.tsx`:

```typescript
// At the top of the root layout, server-side
import { validateEnvironment } from '@/lib/env-validation'

// Call before any component rendering
if (process.env.NODE_ENV === 'production') {
  validateEnvironment()
}
```

---

### 1.4 Improve Google Credentials Error Handling

**File:** `src/lib/google-sheets.ts`
**Lines:** 20-33

**Current Code:**
```typescript
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentials), // Can throw SyntaxError
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
```

**Fixed Code:**
```typescript
let parsedCredentials
try {
  parsedCredentials = JSON.parse(credentials)
} catch (error) {
  throw new Error(
    `Failed to parse GOOGLE_SERVICE_ACCOUNT_CREDENTIALS. ` +
    `Ensure it contains valid JSON. Error: ${(error as Error).message}`
  )
}

const auth = new google.auth.GoogleAuth({
  credentials: parsedCredentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
```

**Rationale:** Prevents cryptic JSON parsing errors, provides actionable error messages for debugging.

---

### 1.5 Create Production Logging Utility

**File:** `src/lib/logger.ts` (NEW)

**Purpose:** Replace 126 console.log statements with production-safe logging

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL = process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'error' : 'debug')

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL as LogLevel]
}

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  },

  info: (message: string, ...args: any[]) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args)
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  },

  error: (message: string, error?: any) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, error)
    }
  },
}
```

**Files to Update (Replace console.log with logger methods):**
1. `src/lib/sync-sheets.ts` - 16 instances
2. `src/components/SyncChecker.tsx` - 8 instances
3. `src/lib/google-sheets.ts` - 7 instances
4. `src/lib/retry.ts` - 1 instance

**Example Replacement:**
```typescript
// Before
console.log('Syncing expenses from Google Sheets...')

// After
import { logger } from '@/lib/logger'
logger.info('Syncing expenses from Google Sheets...')
```

---

### 1.6 Add Health Check Endpoint

**File:** `src/app/api/health/route.ts` (NEW)

**Purpose:** Container health checks and monitoring

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic' // Disable caching

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`

    // Check Google Sheets configuration
    const sheetsConfigured = !!(
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS
    )

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        googleSheets: sheetsConfigured ? 'configured' : 'missing',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      { status: 503 }
    )
  }
}
```

**Usage:**
- Docker health check: `wget -q --spider http://localhost:3000/api/health`
- Manual check: `curl https://expenses.brewerwebdesign.com/api/health`

---

### 1.7 Update .dockerignore

**File:** `.dockerignore`

**Current content is good, but add these entries:**

```
node_modules
.next
.git
.gitignore
README.md
.env
.env.local
npm-debug.log
yarn-debug.log
yarn-error.log
.DS_Store

# Add these new entries
*.md
!CLAUDE.md
.claude
TESTS
BugReport*.txt
*_plan.md
DELETE_FEATURE_TESTING.md
Initial-Enhancements.md
tsconfig.tsbuildinfo
.prettierrc
.prettierignore
.eslintrc.json
docker-compose.yml
docker-compose.prod.yml
truncate-db.js
verify-audit-table.js
.vscode
.idea
coverage
*.log
```

---

## Phase 2: Simple Cookie-Based Authentication

### 2.1 Create Authentication Middleware

**File:** `src/middleware.ts` (NEW)

**Purpose:** Simple shared passcode authentication via cookie

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_NAME = 'expense_auth'
const AUTH_CODE = process.env.AUTH_CODE || 'change-me-in-production'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/health']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)

  if (!authCookie || authCookie.value !== AUTH_CODE) {
    // Redirect to login page
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

---

### 2.2 Create Login API Route

**File:** `src/app/api/auth/login/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'

const loginSchema = z.object({
  code: z.string().min(1, 'Code is required'),
})

const AUTH_CODE = process.env.AUTH_CODE || 'change-me-in-production'
const AUTH_COOKIE_NAME = 'expense_auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code } = loginSchema.parse(body)

    if (code !== AUTH_CODE) {
      return NextResponse.json(
        { error: 'Invalid authentication code' },
        { status: 401 }
      )
    }

    // Create response with auth cookie
    const response = NextResponse.json({ success: true })

    // Set HttpOnly cookie that expires in 30 days
    response.cookies.set(AUTH_COOKIE_NAME, AUTH_CODE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
```

---

### 2.3 Create Login Page

**File:** `src/app/login/page.tsx` (NEW)

```typescript
'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        return
      }

      // Redirect to original destination or home
      const redirect = searchParams.get('redirect') || '/'
      router.push(redirect)
      router.refresh()
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
            Expense Entry
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your access code to continue
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="code" className="sr-only">
              Access Code
            </label>
            <input
              id="code"
              name="code"
              type="password"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

### 2.4 Add AUTH_CODE Environment Variable

**File:** `.env.example`

Add:
```bash
# Authentication (Required for production)
AUTH_CODE=your-secure-access-code-here
```

**File:** `.env`

Add a secure random code:
```bash
AUTH_CODE=brewer-expense-2025-secure
```

**Note:** User should change this to their own secure code before deployment.

---

## Phase 3: Docker Containerization

### 3.1 Create Production Dockerfile

**File:** `Dockerfile` (NEW)

```dockerfile
# ===================================
# Stage 1: Dependencies
# ===================================
FROM node:18-alpine AS deps

# Install libc6-compat for better compatibility
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# ===================================
# Stage 2: Builder
# ===================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Build Next.js app
# This creates .next/standalone directory
RUN npm run build

# ===================================
# Stage 3: Runner (Production)
# ===================================
FROM node:18-alpine AS runner

# Install wget for health checks
RUN apk add --no-cache wget

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
```

**Key Features:**
- Multi-stage build reduces final image size to ~200MB
- Non-root user for security
- Health check built-in
- Prisma client properly included
- Standalone mode for minimal footprint

---

### 3.2 Create Unraid docker-compose.yml

**File:** `docker-compose.prod.yml` (NEW)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: expense-entry:1.0.0
    container_name: expense-entry-app
    restart: unless-stopped
    ports:
      - "3100:3000"  # Using 3100 to avoid conflicts (checked your port list)
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public&connection_limit=10&pool_timeout=30
      - GOOGLE_SHEETS_SPREADSHEET_ID=${GOOGLE_SHEETS_SPREADSHEET_ID}
      - GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=${GOOGLE_SERVICE_ACCOUNT_CREDENTIALS}
      - NEXT_PUBLIC_APP_URL=https://expenses.brewerwebdesign.com
      - AUDIT_RETENTION_DAYS=${AUDIT_RETENTION_DAYS:-180}
      - AUTH_CODE=${AUTH_CODE}
      - LOG_LEVEL=${LOG_LEVEL:-error}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - proxynet
      - expense-internal
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  postgres:
    image: postgres:16-alpine
    container_name: expense-entry-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-expense_entry}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /mnt/user/appdata/expense-entry/db:/var/lib/postgresql/data
    networks:
      - expense-internal
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres}']
      interval: 10s
      timeout: 5s
      retries: 5
    ports:
      - "5432:5432"  # Expose for database management tools

networks:
  proxynet:
    external: true  # Connect to existing Nginx Proxy Manager network
  expense-internal:
    driver: bridge

# Note: No volumes section - using bind mount directly to Unraid path
```

**Key Configuration:**
- Port 3100 (confirmed available from your port list)
- Connects to `proxynet` for Nginx Proxy Manager access
- Separate internal network for app-database communication
- Bind mount to `/mnt/user/appdata/expense-entry/db`
- Health checks for both services
- Watchtower label for automatic updates

---

### 3.3 Create Production .env Template

**File:** `.env.production.example` (NEW)

```bash
# ===================================
# Expense Entry v1.0 - Production Configuration
# ===================================

# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD
POSTGRES_DB=expense_entry
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public&connection_limit=10&pool_timeout=30

# Google Sheets Integration (REQUIRED)
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}'

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://expenses.brewerwebdesign.com
PORT=3000

# Authentication (REQUIRED)
AUTH_CODE=CHANGE_THIS_TO_SECURE_RANDOM_STRING

# Optional Configuration
AUDIT_RETENTION_DAYS=180
LOG_LEVEL=error

# ===================================
# Setup Instructions:
# 1. Copy this file to .env
# 2. Replace all CHANGE_THIS values with secure passwords
# 3. Add your Google Sheets spreadsheet ID
# 4. Add your Google service account credentials JSON (as single line)
# 5. Set a secure AUTH_CODE that you and your wife will use
# ===================================
```

---

## Phase 4: Unraid Deployment Configuration

### 4.1 Deployment Directory Structure

```
/mnt/user/appdata/expense-entry/
├── .env                          # Production environment variables
├── docker-compose.prod.yml       # Production compose file
├── Dockerfile                    # Application container definition
├── db/                          # PostgreSQL data (bind mount)
│   └── pgdata/                  # Managed by PostgreSQL
├── logs/                        # Application logs (optional)
└── backups/                     # Manual backups (optional)
```

---

### 4.2 Nginx Proxy Manager Configuration

**Manual Setup Steps:**

1. **Add Proxy Host in NPM:**
   - Domain Names: `expenses.brewerwebdesign.com`
   - Scheme: `http`
   - Forward Hostname/IP: `expense-entry-app` (container name)
   - Forward Port: `3000`
   - Cache Assets: ✅ Enabled
   - Block Common Exploits: ✅ Enabled
   - Websockets Support: ✅ Enabled

2. **SSL Configuration:**
   - SSL Certificate: Select existing `*.brewerwebdesign.com` wildcard cert
   - Force SSL: ✅ Enabled
   - HTTP/2 Support: ✅ Enabled
   - HSTS Enabled: ✅ Enabled
   - HSTS Subdomains: ✅ Enabled

3. **Advanced Configuration (Optional):**
   ```nginx
   # Add to "Custom Nginx Configuration" tab
   client_max_body_size 2M;

   # Security headers
   add_header X-Frame-Options "DENY" always;
   add_header X-Content-Type-Options "nosniff" always;
   add_header Referrer-Policy "strict-origin-when-cross-origin" always;

   # Proxy headers (NPM adds these by default, but verify)
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-Host $host;
   ```

---

## Phase 5: Deployment Steps

### 5.1 Pre-Deployment Checklist

**On Development Machine:**
- [ ] Run `npm run type-check` - ensure no TypeScript errors
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Run `npm test` - ensure tests pass
- [ ] Run `npm audit` - check for security vulnerabilities
- [ ] Update package.json version to `1.0.0`
- [ ] Commit all changes
- [ ] Create git tag: `git tag -a v1.0.0 -m "Release version 1.0.0"`
- [ ] Push to repository: `git push && git push --tags`

---

### 5.2 Deployment to Unraid

**Step 1: Prepare Unraid Server**

```bash
# SSH into Unraid
ssh root@unraid-server-ip

# Create application directory
mkdir -p /mnt/user/appdata/expense-entry/{db,logs,backups}
cd /mnt/user/appdata/expense-entry

# Clone or upload the repository
git clone https://github.com/yourusername/expense-entry.git .
# OR use rsync/scp to upload files
```

---

**Step 2: Configure Environment**

```bash
# Copy production environment template
cp .env.production.example .env

# Edit environment file
nano .env
```

**Set these values:**
```bash
POSTGRES_PASSWORD=<generate-strong-password>
GOOGLE_SHEETS_SPREADSHEET_ID=<your-spreadsheet-id>
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='<paste-full-json-here>'
AUTH_CODE=<generate-secure-code>
```

**Generate secure passwords:**
```bash
# Generate random password for PostgreSQL
openssl rand -base64 32

# Generate random auth code
openssl rand -base64 24
```

---

**Step 3: Build and Start Containers**

```bash
# Build the Docker image
docker-compose -f docker-compose.prod.yml build

# Verify image was created
docker images | grep expense-entry

# Start services (database only first)
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for database to be healthy (check health status)
docker ps
# Wait until STATUS shows "healthy" for postgres

# Run database migrations
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# Seed default categories
docker-compose -f docker-compose.prod.yml run --rm app npm run db:seed

# Start the application
docker-compose -f docker-compose.prod.yml up -d app

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

**Step 4: Verify Health**

```bash
# Check container status
docker ps

# Test health endpoint (internally)
docker exec expense-entry-app wget -qO- http://localhost:3000/api/health

# Expected output:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-25T...",
#   "version": "1.0.0",
#   "services": {
#     "database": "connected",
#     "googleSheets": "configured"
#   }
# }

# Check from host
curl http://192.168.1.115:3100/api/health
```

---

**Step 5: Configure Nginx Proxy Manager**

Follow the NPM configuration steps from Section 4.2 above.

1. Log into Nginx Proxy Manager UI
2. Add new Proxy Host
3. Configure domain and SSL
4. Save and test

---

**Step 6: Test Deployment**

```bash
# Test from external network (use your phone or external location)
curl https://expenses.brewerwebdesign.com/api/health

# Should redirect to login page
curl -I https://expenses.brewerwebdesign.com/

# Test login in browser
# Navigate to: https://expenses.brewerwebdesign.com
# Enter AUTH_CODE at login prompt
# Should see expenses dashboard
```

---

### 5.3 Post-Deployment Validation

**Smoke Tests:**

1. **Authentication:**
   - [ ] Navigate to `https://expenses.brewerwebdesign.com`
   - [ ] Should redirect to `/login`
   - [ ] Enter AUTH_CODE
   - [ ] Should redirect to home page

2. **Create Expense:**
   - [ ] Click "New Expense"
   - [ ] Fill form with test data
   - [ ] Submit
   - [ ] Verify appears in list
   - [ ] Check Google Sheets - should see new row

3. **View Expense:**
   - [ ] Click on expense from list
   - [ ] Verify details display correctly

4. **Delete Expense:**
   - [ ] Delete test expense
   - [ ] Verify removed from list
   - [ ] Check Google Sheets - row should be deleted

5. **Sync Test:**
   - [ ] Manually add expense in Google Sheets
   - [ ] Wait 5 minutes OR refresh page
   - [ ] Verify synced to application

6. **Database Persistence:**
   - [ ] Restart containers: `docker-compose -f docker-compose.prod.yml restart`
   - [ ] Verify data still present
   - [ ] Check database volume: `ls -lh /mnt/user/appdata/expense-entry/db/`

7. **SSL/Security:**
   - [ ] Verify HTTPS works
   - [ ] Check SSL certificate valid
   - [ ] Verify HTTP redirects to HTTPS
   - [ ] Test auth cookie persists across sessions

---

## Phase 6: Maintenance & Operations

### 6.1 Backup Strategy

**Database Backup Script:**

Create `/mnt/user/appdata/expense-entry/backup-db.sh`:

```bash
#!/bin/bash
# Database backup script for Expense Entry

BACKUP_DIR="/mnt/user/appdata/expense-entry/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/expense_entry_$DATE.sql.gz"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Create backup
docker exec expense-entry-db pg_dump -U postgres expense_entry | gzip > $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "expense_entry_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

**Make executable:**
```bash
chmod +x /mnt/user/appdata/expense-entry/backup-db.sh
```

**Schedule with cron (Unraid User Scripts plugin):**
```bash
# Run daily at 2 AM
0 2 * * * /mnt/user/appdata/expense-entry/backup-db.sh
```

**Note:** Google Sheets is automatically backed up by Google. PostgreSQL is just a cache, but backups are good practice.

---

### 6.2 Update Procedure

**To update to a new version:**

```bash
cd /mnt/user/appdata/expense-entry

# Pull latest changes
git pull origin main

# Rebuild image
docker-compose -f docker-compose.prod.yml build

# Run migrations (if any)
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# Restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f app
```

---

### 6.3 Monitoring & Logs

**View Logs:**
```bash
# Real-time logs
docker-compose -f docker-compose.prod.yml logs -f

# Application logs only
docker-compose -f docker-compose.prod.yml logs -f app

# Database logs
docker-compose -f docker-compose.prod.yml logs -f postgres

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

**Log Rotation:**

Add to docker-compose.prod.yml for each service:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

### 6.4 Troubleshooting

**Common Issues:**

1. **Container won't start:**
   ```bash
   # Check logs
   docker logs expense-entry-app

   # Verify environment variables
   docker exec expense-entry-app env | grep GOOGLE
   ```

2. **Database connection failed:**
   ```bash
   # Check postgres is healthy
   docker ps

   # Test connection
   docker exec expense-entry-db psql -U postgres -d expense_entry -c "SELECT 1"
   ```

3. **Google Sheets errors:**
   ```bash
   # Verify credentials JSON is valid
   docker exec expense-entry-app node -e "console.log(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS))"

   # Test Sheets API access
   docker-compose -f docker-compose.prod.yml logs app | grep "Sheets"
   ```

4. **Auth cookie not persisting:**
   - Verify `secure: true` only in production
   - Check browser isn't blocking cookies
   - Verify domain matches exactly

5. **502 Bad Gateway from NPM:**
   - Verify app container is running: `docker ps`
   - Check app health: `docker exec expense-entry-app wget -qO- http://localhost:3000/api/health`
   - Verify NPM can reach container: `ping expense-entry-app` from NPM container

---

## Phase 7: Security Hardening (Post-v1.0)

**Future Enhancements:**

1. **Rate Limiting:**
   - Implement `@upstash/ratelimit`
   - Protect login endpoint (5 attempts per 15 min)
   - Protect API routes (100 req/15 min)

2. **Enhanced Logging:**
   - Send logs to external service (Loki, Papertrail)
   - Add structured JSON logging
   - Track authentication attempts

3. **Database Security:**
   - Rotate PostgreSQL password quarterly
   - Enable SSL for database connections
   - Implement read-only user for queries

4. **Google Sheets:**
   - Rotate service account key annually
   - Monitor API quota usage
   - Implement request caching

5. **Monitoring:**
   - Add Uptime Kuma for availability monitoring
   - Configure email alerts for container failures
   - Track response times

---

## Summary

### Files to Create:
1. `src/lib/env-validation.ts` - Environment validation utility
2. `src/lib/logger.ts` - Production logging utility
3. `src/app/api/health/route.ts` - Health check endpoint
4. `src/middleware.ts` - Authentication middleware
5. `src/app/api/auth/login/route.ts` - Login API
6. `src/app/login/page.tsx` - Login page UI
7. `Dockerfile` - Multi-stage production build
8. `docker-compose.prod.yml` - Unraid production compose
9. `.env.production.example` - Production environment template

### Files to Modify:
1. `package.json` - Update version to 1.0.0
2. `next.config.js` - Add `output: 'standalone'`
3. `.dockerignore` - Add more exclusions
4. `.env.example` - Add AUTH_CODE
5. `.env` - Add AUTH_CODE (user must set)
6. `src/lib/google-sheets.ts` - Improve error handling
7. `src/app/layout.tsx` - Add environment validation
8. Replace `console.log` with `logger` in:
   - `src/lib/sync-sheets.ts` (16 instances)
   - `src/components/SyncChecker.tsx` (8 instances)
   - `src/lib/google-sheets.ts` (7 instances)
   - `src/lib/retry.ts` (1 instance)

### Deployment Time Estimate:
- **Code Changes:** 6-8 hours
- **Testing:** 2-3 hours
- **Deployment & Configuration:** 2-3 hours
- **Validation & Troubleshooting:** 1-2 hours
- **Total:** 12-16 hours

### Critical Path:
1. Fix Next.js config (5 min)
2. Create authentication system (2 hours)
3. Create Dockerfile (1 hour)
4. Create docker-compose (1 hour)
5. Test locally (1 hour)
6. Deploy to Unraid (2 hours)
7. Configure NPM (30 min)
8. Test production (1 hour)
9. Implement logging improvements (3 hours)
10. Final validation (1 hour)

---

**End of Plan**
