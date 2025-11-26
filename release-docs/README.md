# GitHub Issue Creation Process

This directory contains documentation and scripts for automating the creation of GitHub issues for release milestones.

## v1.0.0 Production Release

For the v1.0.0 production release, we automated the creation of:
- 1 Milestone: "v1.0.0 Production Release"
- 7 Labels (priority, type, phase)
- 11 Issues mapped to the deployment plan

### Automated Creation

The process was automated using GitHub CLI (`gh`) via PowerShell script.

**Prerequisites:**
- GitHub CLI installed (`gh --version`)
- Authenticated with GitHub (`gh auth login`)

**Script:** `create-all-issues.ps1`

**Usage:**
```powershell
cd g:\repos\expense-entry
.\release-docs\create-all-issues.ps1
```

### Manual Creation

If automation fails or for future releases, use the manual guide:

**Artifact:** `create_github_issues.md` (located in `.gemini/antigravity/brain/`)

This artifact contains:
- Step-by-step instructions
- Copy-paste templates for all issues
- Label creation guidance
- Milestone setup instructions

### Results (v1.0.0)

Successfully created:
- Milestone #1: v1.0.0 Production Release
- Labels: `priority: critical`, `priority: high`, `type: feature`, `type: chore`, `phase: 1-critical`, `phase: 2-auth`, `phase: 3-docker`
- Issues #3-#13: All 11 deployment plan issues

View at: https://github.com/dev-brewery/expense-entry/issues

### Issue Breakdown

| # | Title | Phase | Priority |
|---|-------|-------|----------|
| #3 | Update Next.js Configuration for Docker Deployment | 1 | Critical |
| #4 | Create Environment Validation System | 1 | Critical |
| #5 | Improve Google Sheets Error Handling | 1 | High |
| #6 | Create Production Logging Utility | 1 | High |
| #7 | Create Health Check Endpoint | 1 | Critical |
| #8 | Update .dockerignore for Production | 1 | High |
| #9 | Implement Cookie-Based Authentication System | 2 | Critical |
| #10 | Create Production Dockerfile | 3 | Critical |
| #11 | Create Unraid Docker Compose Configuration | 3 | Critical |
| #12 | Create Production Environment Template | 3 | Critical |
| #13 | Update Package Version to 1.0.0 | 1 | High |

## References

- **Deployment Plan:** `docs/DEPLOYMENT_PLAN_v1.0.md`
- **Development Workflow:** `DEVELOPMENT.md`
- **Quick Start Guide:** `QUICKSTART_v1.0.0.md`
