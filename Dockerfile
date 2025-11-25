# ===================================
# Stage 1: Dependencies
# ===================================
FROM node:18-alpine AS deps

# Install libc6-compat and OpenSSL for Prisma compatibility
RUN apk add --no-cache libc6-compat openssl openssl-dev

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN rm -f package-lock.json
RUN npm install

# ===================================
# Stage 2: Builder
# ===================================
FROM node:18-alpine AS builder

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Set dummy environment variables for build time validation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV GOOGLE_SHEETS_SPREADSHEET_ID="dummy"
ENV GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"type":"service_account","project_id":"dummy","private_key":"dummy","client_email":"dummy","client_id":"dummy"}'
ENV AUTH_CODE="dummy"

# Build Next.js app
# This creates .next/standalone directory
RUN npm run build

# ===================================
# Stage 3: Runner (Production)
# ===================================
FROM node:18-alpine AS runner

# Install wget for health checks and OpenSSL for Prisma
RUN apk add --no-cache wget openssl

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
