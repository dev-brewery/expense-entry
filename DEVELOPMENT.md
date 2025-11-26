# Development Guide: Expense Entry v1.0.0

## Repository Structure

```
expense-entry/
├── .github/
│   └── ISSUE_TEMPLATE/      # Issue templates for features and bugs
├── docs/
│   └── DEPLOYMENT_PLAN_v1.0.md  # Production deployment plan
├── src/                     # Application source code
├── prisma/                  # Database schema and migrations
├── .env.example             # Development environment template
├── .env.production.example  # Production environment template (v1.0)
├── Dockerfile               # Production container (v1.0)
├── docker-compose.yml       # Development containers
├── docker-compose.prod.yml  # Production containers (v1.0)
└── README.md
```

## Branch Strategy: GitFlow-Lite

### Branch Hierarchy
```
main (production, protected)
├── release/1.0.0 (production prep, semi-protected)
│   ├── feature/critical-fixes (Phase 1)
│   ├── feature/auth-system (Phase 2)
│   ├── feature/docker-setup (Phase 3)
│   └── feature/logging-improvements (Phase 5)
└── dev (alpha development)
```

### Branch Purposes

- **`main`** - Production-ready code only. Tagged releases (v1.0.0, v1.1.0, etc.)
- **`release/1.0.0`** - Preparation for v1.0.0 production release. QA and testing happens here.
- **`feature/*`** - Individual features/fixes from deployment plan. Branched from `release/1.0.0`.
- **`dev`** - Ongoing alpha development. Continue daily work here during production prep.

## Workflow for v1.0.0 Production Release

### 1. Setup Release Branch

```bash
# Ensure you're on latest dev
git checkout dev
git pull origin dev

# Create release branch
git checkout -b release/1.0.0
git push -u origin release/1.0.0
```

### 2. Working on a Feature

```bash
# Create feature branch from release/1.0.0
git checkout release/1.0.0
git pull origin release/1.0.0
git checkout -b feature/auth-system

# Make your changes
# Commit frequently with descriptive messages
git add src/middleware.ts
git commit -m "feat(auth): add authentication middleware

- Add cookie-based auth
- Protect all routes except login and health
- Ref: #5"

# Push feature branch
git push -u origin feature/auth-system
```

### 3. Creating a Pull Request

1. Go to GitHub
2. Click "New Pull Request"
3. Base: `release/1.0.0` ← Compare: `feature/auth-system`
4. Fill in PR template:
   - Title: `[Phase 2] Add Cookie-Based Authentication`
   - Description: Link to issue(s), describe changes
   - Checklist: Testing done, files changed
5. Self-review the PR
6. If all looks good, merge to `release/1.0.0`
7. Delete feature branch after merge

### 4. Testing on Release Branch

```bash
# Checkout release branch
git checkout release/1.0.0
git pull origin release/1.0.0

# Test locally
npm install
npm run dev

# Run through smoke tests from deployment plan Section 5.3
```

### 5. Final Release

```bash
# When all features merged and QA passed
git checkout main
git merge release/1.0.0

# Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0 - Production ready

Features:
- Cookie-based authentication
- Docker containerization
- Environment validation
- Health check endpoint
- Production logging

See docs/DEPLOYMENT_PLAN_v1.0.md for details"

# Push to origin
git push origin main
git push origin v1.0.0
```

## Commit Message Convention

Follow Convent Commits format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance (dependencies, config)
- `docs`: Documentation only
- `refactor`: Code change that neither fixes bug nor adds feature
- `test`: Adding or updating tests

**Examples:**
```bash
feat(auth): add login page UI

fix(docker): correct standalone output path in next.config.js

chore(deps): update Next.js to 14.2.18

docs(readme): add production deployment instructions
```

## Issue Management

### Creating Issues from Deployment Plan

Each phase from `docs/DEPLOYMENT_PLAN_v1.0.md` should have corresponding issues:

**Phase 1: Critical Fixes** → 1 issue per section (1.1, 1.2, etc.)
**Phase 2: Authentication** → 1 issue (combines all auth sections)
**Phase 3: Docker** → 1-2 issues (Dockerfile + docker-compose)

### Issue Workflow

1. **Create issue** using template
2. **Add to v1.0.0 milestone** (create milestone first)
3. **Add labels**: `priority: critical`, `phase: 1-critical`, `type: feature`
4. **Assign to yourself**
5. **Create feature branch** referencing issue number
6. **Work on feature**, commit with issue references
7. **Create PR** linking to issue
8. **Close issue** when PR merged

### Labels to Create

```
# Priority
priority: critical
priority: high
priority: low

# Type
type: feature
type: bug
type: chore

# Phase (from deployment plan)
phase: 1-critical
phase: 2-auth
phase: 3-docker
phase: 4-unraid
phase: 5-logging
phase: 6-maintenance
phase: 7-hardening

# Status
status: blocked
status: in-progress
status: needs-review
```

## Testing Checklist

### Before Creating PR
- [ ] Code builds without errors: `npm run build`
- [ ] Type check passes: `npm run type-check`
- [ ] Linter passes: `npm run lint`
- [ ] Manual testing completed
- [ ] Environment variables documented in `.env.example`

### Before Merging to Release
- [ ] PR reviewed (self-review counts)
- [ ] All commits have descriptive messages
- [ ] No merge conflicts
- [ ] Feature tested in context of release branch

### Before Merging Release to Main
- [ ] All smoke tests passed (Section 5.3 of deployment plan)
- [ ] Docker build successful
- [ ] Health check endpoint working
- [ ] Authentication tested
- [ ] Database migrations tested
- [ ] `.env.production.example` complete

## Local Development

### Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Docker Testing (Local)
```bash
# Build production image
docker build -t expense-entry:test .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up
```

## Questions?

Refer to:
- `docs/DEPLOYMENT_PLAN_v1.0.md` - Detailed production deployment plan
- `.github/ISSUE_TEMPLATE/` - Issue templates
- `README.md` - Project overview and quick start

## Quick Commands Reference

```bash
# Create feature branch
git checkout release/1.0.0 && git pull && git checkout -b feature/my-feature

# Commit with issue reference
git commit -m "feat(scope): description

Ref: #<issue-number>"

# Update release branch with new features
git checkout release/1.0.0 && git pull

# Build and test Docker
docker-compose -f docker-compose.prod.yml up --build

# Run type checking
npm run type-check

# Database migrations
npx prisma migrate dev      # Development
npx prisma migrate deploy   # Production
```
