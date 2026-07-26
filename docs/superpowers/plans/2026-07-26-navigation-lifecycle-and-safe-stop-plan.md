# Navigation, Lifecycle, and Safe Stop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Split Team Job Workflow into addressable pages, accept six-character passwords, implement creator-or-owner deletion, and add a safe compose stop command.

**Architecture:** FastAPI remains the authorization boundary and exposes DELETE routes enforcing creator-or-owner membership. A dependency-free hash router separates frontend pages while App retains session state. Docker shutdown stays scoped to this repository's compose project and preserves its volume.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, React 19, TypeScript, Vitest, Playwright, CMD, Docker Compose.

## Global Constraints

- Keep Argon2id hashing and JWT authentication unchanged.
- Password minimum is exactly six characters in backend validation and browser input.
- Do not modify Tom's currently uncommitted README.md or start-local.cmd.
- Server authorization controls deletion; hidden buttons are not a security boundary.
- stop-local.cmd must not pass --volumes.

---

### Task 1: Password boundary and deletion API

**Files:**

- Modify: app/main.py, app/models.py, tests/test_api.py, tests/test_security.py

**Interfaces:**

- DELETE /api/applications/{application_id}, DELETE /api/tasks/{task_id}, and DELETE /api/comments/{comment_id} return 204.
- can_delete_record(membership: Membership, creator_id: int, actor_id: int) -> bool permits an owner or record creator.
- Details include application created_by_id, task created_by_id, comment author_id, and workspace_role.

- [ ] **Step 1: Write failing API tests**

~~~python
def test_registration_accepts_exactly_six_characters(tmp_path):
    response = make_client(tmp_path).post("/api/auth/register", json={"email": "six@example.test", "password": "123456"})
    assert response.status_code == 201

def test_registration_rejects_five_characters(tmp_path):
    response = make_client(tmp_path).post("/api/auth/register", json={"email": "five@example.test", "password": "12345"})
    assert response.status_code == 422

def test_only_creator_or_owner_can_delete_task_and_comment(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    creator = register(client, "creator@example.test")
    other_member = register(client, "other@example.test")
    workspace = client.post("/api/workspaces", headers=auth_headers(owner["access_token"]), json={"name": "Shared search"}).json()
    for user in (creator, other_member):
        client.post(f"/api/workspaces/{workspace['id']}/members", headers=auth_headers(owner["access_token"]), json={"email": user["user"]["email"], "role": "member"})
    application = client.post(f"/api/workspaces/{workspace['id']}/applications", headers=auth_headers(creator["access_token"]), json={"company": "Example", "job_title": "Intern"}).json()
    task = client.post(f"/api/applications/{application['id']}/tasks", headers=auth_headers(creator["access_token"]), json={"title": "Prepare notes"}).json()
    assert client.delete(f"/api/tasks/{task['id']}", headers=auth_headers(other_member["access_token"])).status_code == 403
    assert client.delete(f"/api/tasks/{task['id']}", headers=auth_headers(owner["access_token"])).status_code == 204
~~~

- [ ] **Step 2: Run focused tests**

Run: .\.venv\Scripts\python.exe -m pytest tests\test_api.py tests\test_security.py -q

Expected: failures for six-character registration and missing DELETE routes.

- [ ] **Step 3: Implement backend authorization and transaction**

Set Credentials.password to Field(min_length=6, max_length=256). Add can_delete_record and enforce membership plus owner/creator permission in all three routes. Application deletion must set related Activity.application_id to None, delete child tasks and comments, write application_deleted with application_id=None, delete the application, and commit as one transaction. Task/comment deletion logs a deletion event before deleting its record.

- [ ] **Step 4: Run focused API/security tests**

Run: .\.venv\Scripts\python.exe -m pytest tests\test_api.py tests\test_security.py -q

Expected: owner/creator success, member/nonmember 403, missing 404, detached activity preservation, and password boundary all pass.

- [ ] **Step 5: Commit API lifecycle**

~~~powershell
git add app/main.py app/models.py tests/test_api.py tests/test_security.py
git commit -m "feat: add authorized record deletion"
~~~

### Task 2: Typed delete client

**Files:**

- Modify: frontend/src/api.ts, frontend/src/api.test.ts

**Interfaces:**

- deleteApplication(token: string, applicationId: number): Promise<void>
- deleteTask(token: string, taskId: number): Promise<void>
- deleteComment(token: string, commentId: number): Promise<void>

- [ ] **Step 1: Write failing API-client test**

~~~typescript
it("deletes a task with bearer authentication", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  await deleteTask("token", 19);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://127.0.0.1:8000/api/tasks/19",
    expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer token" } }),
  );
});
~~~

- [ ] **Step 2: Run focused client test**

Run: pnpm test -- api.test.ts

Expected: import failure for deleteTask.

- [ ] **Step 3: Implement three typed DELETE calls**

Reuse parseResponse for errors. A 204 success must return without JSON parsing.

- [ ] **Step 4: Run client regression**

Run: pnpm test -- api.test.ts

Expected: create, update, and delete calls carry the expected bearer header.

- [ ] **Step 5: Commit typed client**

~~~powershell
git add frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat: add deletion API client"
~~~

### Task 3: Hash-routed workflow pages

**Files:**

- Create: frontend/src/router.ts, frontend/src/pages/AuthPage.tsx, frontend/src/pages/WorkspacePage.tsx, frontend/src/pages/MembersPage.tsx, frontend/src/pages/BoardPage.tsx, frontend/src/pages/NewApplicationPage.tsx, frontend/src/pages/ApplicationDetailPage.tsx, frontend/src/router.test.tsx
- Modify: frontend/src/main.tsx, frontend/src/main.test.tsx, frontend/src/styles.css

**Interfaces:**

- parseRoute(hash: string): Route parses auth, workspaces, members, board, application creation, and application details.
- navigate(hash: string): void assigns window.location.hash.
- ApplicationDetailPage renders a delete control only if workspaceRole === "owner" or record creator ID equals current user ID.

- [ ] **Step 1: Write failing route and visibility tests**

~~~typescript
it("parses an application detail route", () => {
  expect(parseRoute("#/workspaces/7/applications/19")).toEqual({
    kind: "application-detail", workspaceId: 7, applicationId: 19,
  });
});

it("hides another member's task delete control", () => {
  render(<ApplicationDetailPage workspaceRole="member" currentUserId={2} detail={detailCreatedByMemberOne} />);
  expect(screen.queryByRole("button", { name: "Delete task Prepare STAR stories" })).toBeNull();
});
~~~

- [ ] **Step 2: Run focused UI tests**

Run: pnpm test -- router.test.tsx main.test.tsx

Expected: module failures because router/pages do not exist.

- [ ] **Step 3: Implement shell and pages**

Move stacked forms into the six approved pages. App retains useSession, message state, hashchange listener, and navigation. Auth renders only authentication; board renders filtering, pagination, Kanban and links; create application has its own page; details contains status, tasks, comments, activity and confirmation-backed deletion. Unauthorized route API errors return to #/workspaces without data disclosure.

- [ ] **Step 4: Run UI regression and build**

Run: pnpm test -- router.test.tsx main.test.tsx session.test.ts

Run: pnpm build

Expected: routes, control visibility, legacy sign-in behavior, typecheck, and Vite build pass.

- [ ] **Step 5: Commit routed UI**

~~~powershell
git add frontend/src
git commit -m "feat: split workflow into routed pages"
~~~

### Task 4: Compose stop command

**Files:**

- Create: stop-local.cmd, scripts/test-stop-local.ps1
- Modify: README.md only if Tom's uncommitted change does not overlap the local-run section.

**Interfaces:**

- stop-local.cmd executes docker.exe compose down --remove-orphans from %~dp0 after docker.exe info succeeds.
- scripts/test-stop-local.ps1 -WhatIf verifies command contents and never stops Docker.

- [ ] **Step 1: Write failing command-contract test**

~~~powershell
$script = Get-Content -Raw "$PSScriptRoot\..\stop-local.cmd"
if ($script -notmatch 'docker\.exe compose down --remove-orphans') { exit 1 }
if ($script -match '--volumes') { exit 1 }
~~~

- [ ] **Step 2: Run it and confirm missing-file failure**

Run: powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\test-stop-local.ps1 -WhatIf

Expected: nonzero because stop-local.cmd does not exist.

- [ ] **Step 3: Add stop-local.cmd without modifying start-local.cmd**

Use pushd "%~dp0", verify Docker command and engine readiness, run docker.exe compose down --remove-orphans, print that persisted data was retained, and return Docker's exit code.

- [ ] **Step 4: Run contract and lifecycle smoke**

Run: powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\test-stop-local.ps1 -WhatIf

Run: start-local.cmd --no-browser

Run: stop-local.cmd

Expected: contract passes, stack stops, and no named volume is removed.

- [ ] **Step 5: Commit stop command**

~~~powershell
git add stop-local.cmd scripts/test-stop-local.ps1
git commit -m "feat: add local compose stop command"
~~~

### Task 5: Browser acceptance and evidence refresh

**Files:**

- Modify: frontend/e2e/workflow.e2e.ts, local_data/verification-evidence.json (ignored)

- [ ] **Step 1: Write failing owner-deletion scenario**

~~~typescript
await page.getByRole("button", { name: "Delete task Prepare STAR stories" }).click();
await page.getByRole("button", { name: "Confirm delete task" }).click();
await expect(page.getByText("Prepare STAR stories")).toHaveCount(0);
~~~

- [ ] **Step 2: Run smoke and confirm missing controls**

Run: powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\run-browser-smoke.ps1

Expected: failure locating the delete control.

- [ ] **Step 3: Add the scenario after API and pages are green**

Keep all data under @example.test and use only seeded sanitized records.

- [ ] **Step 4: Run final local gates**

Run: .\.venv\Scripts\python.exe -m pytest -q

Run: pnpm test

Run: pnpm build

Run: powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\record-verification-evidence.ps1

- [ ] **Step 5: Verify exact commit and working tree**

Run: gh run list --commit (git rev-parse HEAD) --limit 1 --json status,conclusion,url

Run: Get-Content -Raw local_data\verification-evidence.json

Run: git status --short

Expected: all local gates pass; after push, exact CI succeeds; evidence names that commit; Tom's existing README.md and start-local.cmd remain outside this work.
