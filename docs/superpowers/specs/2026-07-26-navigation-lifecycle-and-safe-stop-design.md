# Navigation, Lifecycle, and Safe Stop Design

## Goal

Make the local team workflow easier to use by separating workflows into addressable pages, accepting six-character passwords, and adding secure deletion for applications, tasks, and comments.

## Navigation

The SPA will use a small internal hash router rather than add React Router. This keeps the existing dependency lock unchanged while giving each workflow a stable URL and browser back/forward behavior.

- `#/auth`: register and sign in.
- `#/workspaces`: create and select a workspace.
- `#/workspaces/:workspaceId/members`: invite registered users and assign `owner` or `member`.
- `#/workspaces/:workspaceId/board`: filters, pagination, Kanban columns, and a link to create an application.
- `#/workspaces/:workspaceId/applications/new`: create a job-application record.
- `#/workspaces/:workspaceId/applications/:applicationId`: application status, tasks, comments, activity, and deletion controls.

The app shell owns authentication and active-workspace state. Page components receive only the state and callbacks they need. A route with no authenticated user returns the user to `#/auth`; a route whose workspace is inaccessible shows the API error and does not expose data.

## Authentication

`Credentials.password` will use `min_length=6`; the frontend password input will use `minLength={6}` and the explicit "6+ character password" hint. Argon2id hashing, JWT format, and login error behavior remain unchanged. Existing accounts with longer passwords remain valid.

## Deletion and Authorization

The API will add these idempotency-safe routes:

- `DELETE /api/applications/{application_id}`
- `DELETE /api/tasks/{task_id}`
- `DELETE /api/comments/{comment_id}`

For every route the backend loads the parent application and confirms workspace membership. Authorization succeeds only if the caller is an `owner` in that workspace or is the record creator (`created_by_id` for applications/tasks and `author_id` for comments). All other members receive `403`; missing records return `404`.

Deleting an application explicitly deletes its tasks and comments, changes any related activity rows to `application_id = NULL`, writes an `application_deleted` workspace audit event, then deletes the application in one transaction. Deleting a task or comment writes `task_deleted` or `comment_deleted` activity against the still-existing application. The response is `204 No Content`.

Details responses will include application `created_by_id`, task `created_by_id`, comment `author_id`, and current workspace role so the frontend can hide delete buttons from unauthorized members. This is a usability feature only; the API remains the authorization boundary. The details page asks for confirmation before deletion and returns to the board after an application is removed.

## Local Stack Lifecycle

`stop-local.cmd` will run from the repository root, verify Docker Desktop is reachable, and execute `docker compose down --remove-orphans`. It does not pass `--volumes`, preserving demo data. It affects only this compose project and reports the stopped URL/stack. `start-local.cmd` remains Tom's existing uncommitted launcher and will not be modified.

## Verification

- API tests prove exact six-character registration succeeds and five-character registration fails.
- API tests prove creator and owner deletion succeeds, another member receives `403`, a nonmember receives `403`, missing IDs return `404`, and application deletion removes child tasks/comments while preserving a detached activity event.
- Frontend API tests prove the three DELETE requests carry bearer authorization.
- UI tests prove each major workflow route renders its own page and delete controls are absent for non-authorized records.
- Browser smoke exercises an owner deleting a sanitized task and comment, and confirms the records disappear.
- Docker Compose smoke, production build, and the exact-commit GitHub Actions workflow remain required before the evidence manifest can be refreshed.
