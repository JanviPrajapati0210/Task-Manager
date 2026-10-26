# Continuous Integration & Continuous Deployment (CI/CD)

This document provides a complete guide to the **GitHub Actions** CI/CD pipeline implemented for the Task Management application.

---

## Pipeline Architecture & Workflow

```mermaid
flowchart TD
    A["Developer opens Pull Request targeting 'main'"] --> B["GitHub Actions Triggered: .github/workflows/ci.yml"]
    
    subgraph Job1["Job 1: lint (Code Quality & ESLint)"]
        B --> C["actions/checkout@v4"]
        C --> D["actions/setup-node@v4 (Node.js 20)"]
        D --> E["npm install"]
        E --> F["npm run lint (ESLint)"]
    end
    
    F -->|Success (Exit 0)| G{"needs: [lint]"}
    F -->|Failure (Exit 1)| X["Workflow Aborted (Blocks Merge)"]
    
    subgraph Job2["Job 2: test (Automated Unit Testing)"]
        G --> H["actions/checkout@v4"]
        H --> I["actions/setup-node@v4 (Node.js 20)"]
        I --> J["npm install"]
        J --> K["npm test (node --test)"]
    end

    K -->|Pass (All tests green)| L["CI Status: PASS ✔ (Green Badge)"]
    K -->|Fail| M["CI Status: FAIL ✖ (Blocks Merge)"]
```

---

## Workflow Configuration Summary

File: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Field | Configuration | Purpose |
| :--- | :--- | :--- |
| **Workflow Name** | `CI Pipeline` | Displays in GitHub Actions tab and status badge. |
| **Trigger (`on`)** | `pull_request: branches: [main]` | Runs automatically on every pull request targeting `main`, preventing unverified code from merging. Direct pushes to `main` are excluded per project requirements. |
| **Manual Trigger** | `workflow_dispatch` | Allows manual workflow execution via the GitHub Actions UI. |
| **Runner OS** | `ubuntu-latest` | Standard Linux runner on GitHub-hosted infrastructure. |
| **Node.js Version** | `20.x` | Matches production and Docker environments. |
| **Job 1** | `lint` | Runs ESLint over backend controllers, routes, models, middleware, and utils. |
| **Job 2** | `test` (`needs: [lint]`) | Runs automated unit tests using Node's native test runner (`node --test`). |

---

## Job Details & Defined Steps

### Job 1: `lint` (Code Quality & Syntax Verification)
Executes before the test job to ensure code complies with coding standards before burning compute time on tests:
1. **Checkout repository**: `actions/checkout@v4` fetches the branch source code.
2. **Set up Node.js 20**: `actions/setup-node@v4` provisions Node 20 and configures npm cache.
3. **Install dependencies**: `npm install` installs all dependencies declared in `package.json`.
4. **Run linter**: `npm run lint` invokes `eslint .` checking syntax and common errors.

### Job 2: `test` (Automated Unit Testing)
Configured with `needs: [lint]`. Only starts after the `lint` job passes successfully:
1. **Checkout repository**: `actions/checkout@v4`.
2. **Set up Node.js 20**: `actions/setup-node@v4`.
3. **Install dependencies**: `npm install` installs project dependencies.
4. **Run automated tests**: `npm test` executes the unit test suite (`tests/unit.test.js`), testing:
   - In-memory cache hits, misses, TTL, and cache invalidation.
   - Background notification `EventEmitter` events (`task-created`, `task-deleted`, `error`).
   - Request validation middlewares (`validateTaskId`, `validateTask`, `validateContentType`).

---

## Status Badge in `README.md`

The live pipeline status is embedded directly in [`README.md`](../README.md):

```markdown
[![CI Pipeline](https://github.com/JanviPrajapati0210/Task-Manager/actions/workflows/ci.yml/badge.svg)](https://github.com/JanviPrajapati0210/Task-Manager/actions/workflows/ci.yml)
```

- When the latest workflow run on `main` passes, the badge displays ![Passing](https://img.shields.io/badge/CI%20Pipeline-passing-brightgreen).
- When a job fails, the badge updates to reflect the failure status.

---

## Local Testing Commands

Before opening a pull request, run the following local commands to ensure pipeline success:

```bash
# 1. Run ESLint code check
npm run lint

# 2. Run automated test suite
npm test
```
