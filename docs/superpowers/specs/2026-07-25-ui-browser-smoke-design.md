# Team Workflow UI Browser Smoke Design

## Goal

Prove the visible React workflow works against the real Docker Compose API and PostgreSQL database, rather than proving only mocked frontend requests or direct API calls.

## Scope

Add one Playwright smoke scenario for the sanitized Compose UI. The scenario registers a unique example.test owner, creates a workspace and application, moves the application to interview, opens its details, creates and completes a task, adds a comment, and confirms the resulting activity records are visible.

The scenario must not access job platforms, real accounts, resumes, job descriptions, or persistent user data.

## Design

Use Playwright as a frontend development dependency, with a dedicated browser-smoke configuration that targets the Compose web service at http://127.0.0.1:8080. Test data uses a random run identifier and example.test identities. Passwords are generated during the test and never logged.

A PowerShell 5.1-compatible runner starts Compose, waits for both API health and the web server, runs the Playwright scenario from the frontend directory, and tears Compose resources down in finally. It is independent from the API contract runner so each gate has one focused responsibility.

GitHub Actions adds a browser-smoke job that installs the frontend dependencies and Chromium, then runs the PowerShell browser runner. The existing backend, frontend, and Docker HTTP contract jobs remain unchanged.

## Acceptance Criteria

- The browser test uses the public UI controls and no direct API calls.
- It verifies registration, workspace creation, application creation, status movement, details, task completion, comment creation, and displayed activity records.
- Local browser runner passes against Compose and cleans up containers, networks, and volumes after success or failure.
- CI runs the browser scenario on the exact commit and remains green with all existing jobs.
- The evidence recorder and README describe the added UI verification without expanding the sanitized-data boundary.

## Risks and Boundaries

The smoke is a single Chromium happy-path workflow, not exhaustive accessibility, visual-regression, cross-browser, load, or real-user testing. Selector choices will use accessible labels and visible control names to reduce coupling to layout.
