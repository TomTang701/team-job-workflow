# Team Workflow UI Browser Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the Team Job Workflow’s visible Compose UI can complete a sanitized collaboration workflow against its real API and PostgreSQL database.

**Architecture:** Add a focused Playwright browser spec under the frontend, then invoke it through a PowerShell runner that owns Compose startup, readiness checks, and cleanup. A dedicated CI job prepares Chromium and invokes that runner; the evidence recorder reports browser verification separately from API-contract Docker smoke.

**Tech Stack:** React, TypeScript, Vite, Playwright, PowerShell 5.1-compatible scripts, Docker Compose, GitHub Actions.

## Global Constraints

- Use only unique `example.test` identities and generated non-logged passwords.
- The browser scenario uses UI controls only; it must not call backend endpoints directly.
- The runner must remove Compose containers, networks, and volumes in `finally`.
- Browser coverage is Chromium happy-path smoke coverage, not a claim of cross-browser or real-user coverage.

---

### Task 1: Add a real UI browser scenario

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/workflow.spec.ts`

**Interfaces:**
- Consumes: Compose web UI at `http://127.0.0.1:8080` and its existing accessible controls.
- Produces: `pnpm exec playwright test --config playwright.config.ts`, which succeeds only when the UI workflow is visibly complete.

- [ ] **Step 1: Write the failing browser spec**

```typescript
test("owner completes the sanitized collaboration workflow through the UI", async ({ page }) => {
  const runId = crypto.randomUUID().slice(0, 8);
  const email = `browser-owner-${runId}@example.test`;
  const company = `Browser Example ${runId}`;

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(crypto.randomUUID());
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.locator(".message")).toContainText("Registered");
  // Create a workspace and application, move to interview, then add and complete a task and add a comment.
});
```

- [ ] **Step 2: Run the browser command to verify it fails**

Run from `frontend`: `pnpm exec playwright test --config playwright.config.ts`
Expected: failure because Playwright configuration and test dependency do not yet exist.

- [ ] **Step 3: Implement the minimal browser test setup**

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: process.env.TJW_BROWSER_BASE_URL ?? "http://127.0.0.1:8080" },
  reporter: "list",
});
```

Install `@playwright/test` as a frontend development dependency. In the scenario, assert visible confirmation for registration, workspace creation, application presence in the interview column, task completion, comment text, and `status changed`, `task completed`, and `comment added` activities.

- [ ] **Step 4: Run the focused browser command**

Run from `frontend`: `pnpm exec playwright test --config playwright.config.ts`
Expected: passes only when a Compose stack is already available at port 8080.

- [ ] **Step 5: Commit**

```powershell
git add frontend/package.json frontend/pnpm-lock.yaml frontend/playwright.config.ts frontend/e2e/workflow.spec.ts
git commit -m "test: add workflow UI browser smoke"
```

### Task 2: Create a Compose browser runner

**Files:**
- Create: `scripts/run-browser-smoke.ps1`

**Interfaces:**
- Consumes: Docker Compose, `pnpm`, Chromium installed by Playwright, and the Task 1 command.
- Produces: exit code 0 only after API and web readiness plus the UI scenario; it always calls `docker compose down --volumes --remove-orphans`.

- [ ] **Step 1: Write the failing runner invocation**

Run: `.\scripts\run-browser-smoke.ps1`
Expected: failure because the runner does not exist.

- [ ] **Step 2: Implement the runner**

```powershell
try {
    docker compose up --build -d
    # Poll http://127.0.0.1:8000/health and http://127.0.0.1:8080 until both return HTTP 200.
    Push-Location -LiteralPath (Join-Path $root "frontend")
    try {
        & $pnpm.Source exec playwright test --config playwright.config.ts
        if ($LASTEXITCODE -ne 0) { throw "Playwright browser smoke failed." }
    } finally {
        Pop-Location
    }
} finally {
    docker compose down --volumes --remove-orphans
}
```

Require Docker and `pnpm` before startup. Do not log generated credentials, tokens, or raw API responses.

- [ ] **Step 3: Run the runner**

Run: `.\scripts\run-browser-smoke.ps1`
Expected: Compose starts, the UI scenario passes, and the final Compose resource list is empty.

- [ ] **Step 4: Commit**

```powershell
git add scripts/run-browser-smoke.ps1
git commit -m "test: run UI smoke against compose"
```

### Task 3: Make browser evidence reproducible

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/record-verification-evidence.ps1`
- Modify: `README.md`

**Interfaces:**
- Consumes: `scripts/run-browser-smoke.ps1`.
- Produces: a `browser_ui_smoke_passed` evidence field and an exact-head CI browser job.

- [ ] **Step 1: Add CI browser gate**

Add a `browser-smoke` job that checks out code, installs pnpm 11 and Node 24 in `frontend`, installs dependencies with `--frozen-lockfile`, installs Chromium with `pnpm exec playwright install --with-deps chromium`, then invokes `./scripts/run-browser-smoke.ps1` with `pwsh`.

- [ ] **Step 2: Add evidence recording**

Run the browser runner in `record-verification-evidence.ps1` after the existing Docker contract runner. Record its result as `browser_ui_smoke_passed`; include it in the final pass condition without weakening any existing field.

- [ ] **Step 3: Update README**

Document the UI workflow covered by the browser runner, its Chromium-only boundary, and the command `.\scripts\run-browser-smoke.ps1`.

- [ ] **Step 4: Run all local verification**

Run: `.\.venv\Scripts\python.exe -m pytest tests -q`
Run from `frontend`: `pnpm.cmd test`
Run from `frontend`: `pnpm.cmd build`
Run: `.\scripts\run-docker-smoke.ps1`
Run: `.\scripts\run-browser-smoke.ps1`
Expected: all commands succeed and each runner cleans Compose resources.

- [ ] **Step 5: Commit**

```powershell
git add .github/workflows/ci.yml scripts/record-verification-evidence.ps1 README.md
git commit -m "ci: verify workflow UI in browser"
```

### Task 4: Verify exact-head evidence

**Files:**
- Modify: `local_data/verification-evidence.json` (ignored local artifact)

**Interfaces:**
- Consumes: exact-head GitHub Actions result and all local acceptance gates.
- Produces: an evidence manifest with every field true, including `browser_ui_smoke_passed`.

- [ ] **Step 1: Push the verified commits and wait for exact-head CI**

Run: `git push origin main`
Expected: backend, frontend, Docker HTTP contract, and browser-smoke CI jobs succeed.

- [ ] **Step 2: Refresh evidence**

Run: `.\scripts\record-verification-evidence.ps1`
Expected: every manifest field is `true`.

- [ ] **Step 3: Review**

Run: `git status --short`
Run: `git diff --check`
Expected: no unintended tracked changes; preserve unrelated user files.
