# Simplified issue creator - one issue at a time
$repo = "dev-brewery/expense-entry"

# Issue 1
gh issue create `
    --title "Update Next.js Configuration for Docker Deployment" `
    --body "Add output standalone to next.config.js for Docker. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.2" `
    --label "priority: critical" `
    --label "phase: 1-critical" `
    --label "type: chore"

# Issue 2
gh issue create `
    --title "Create Environment Validation System" `
    --body "Create src/lib/env-validation.ts to validate environment variables. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.3" `
    --label "priority: critical" `
    --label "phase: 1-critical" `
    --label "type: feature"

# Issue 3
gh issue create `
    --title "Improve Google Sheets Error Handling" `
    --body "Add try-catch for JSON parsing in src/lib/google-sheets.ts. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.4" `
    --label "priority: high" `
    --label "phase: 1-critical" `
    --label "type: feature"

# Issue 4
gh issue create `
    --title "Create Production Logging Utility" `
    --body "Create src/lib/logger.ts and replace 32 console.log statements. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.5" `
    --label "priority: high" `
    --label "phase: 1-critical" `
    --label "type: feature"

# Issue 5
gh issue create `
    --title "Create Health Check Endpoint" `
    --body "Create src/app/api/health/route.ts for Docker health checks. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.6" `
    --label "priority: critical" `
    --label "phase: 1-critical" `
    --label "type: feature"

# Issue 6
gh issue create `
    --title "Update .dockerignore for Production" `
    --body "Add exclusions to reduce Docker image size. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.7" `
    --label "priority: high" `
    --label "phase: 1-critical" `
    --label "type: chore"

# Issue 7
gh issue create `
    --title "Implement Cookie-Based Authentication System" `
    --body "Create auth middleware, login API, and login page. See docs/DEPLOYMENT_PLAN_v1.0.md Sections 2.1-2.4" `
    --label "priority: critical" `
    --label "phase: 2-auth" `
    --label "type: feature"

# Issue 8
gh issue create `
    --title "Create Production Dockerfile" `
    --body "Create multi-stage Dockerfile with security best practices. See docs/DEPLOYMENT_PLAN_v1.0.md Section 3.1" `
    --label "priority: critical" `
    --label "phase: 3-docker" `
    --label "type: feature"

# Issue 9
gh issue create `
    --title "Create Unraid Docker Compose Configuration" `
    --body "Create docker-compose.prod.yml for Unraid deployment. See docs/DEPLOYMENT_PLAN_v1.0.md Section 3.2" `
    --label "priority: critical" `
    --label "phase: 3-docker" `
    --label "type: feature"

# Issue 10
gh issue create `
    --title "Create Production Environment Template" `
    --body "Create .env.production.example with all required variables. See docs/DEPLOYMENT_PLAN_v1.0.md Section 3.3" `
    --label "priority: critical" `
    --label "phase: 3-docker" `
    --label "type: chore"

# Issue 11
gh issue create `
    --title "Update Package Version to 1.0.0" `
    --body "Update package.json to version 1.0.0. See docs/DEPLOYMENT_PLAN_v1.0.md Section 1.1" `
    --label "priority: high" `
    --label "phase: 1-critical" `
    --label "type: chore"

Write-Host "All 11 issues created!"
