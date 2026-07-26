import { expect, test } from "@playwright/test";

test("owner completes the sanitized collaboration workflow through the UI", async ({ page }) => {
  const runId = crypto.randomUUID().slice(0, 8);
  const email = `browser-owner-${runId}@example.test`;
  const password = crypto.randomUUID();
  const workspaceName = `Browser workspace ${runId}`;
  const company = `Browser Example ${runId}`;
  const taskTitle = `Prepare browser notes ${runId}`;
  const comment = `Sanitized browser comment ${runId}.`;

  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.locator(".message")).toContainText(`Registered as ${email}`);

  const workspaceForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Workspace", exact: true }) });
  await workspaceForm.getByLabel("Workspace name").fill(workspaceName);
  await workspaceForm.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page.locator(".message")).toContainText(`Created ${workspaceName}`);
  await expect(workspaceForm.getByLabel("Active workspace")).toHaveValue(/\d+/);

  const applicationForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Add application", exact: true }) });
  await applicationForm.getByLabel("Company").fill(company);
  await applicationForm.getByLabel("Job title").fill("Backend Intern");
  await applicationForm.getByRole("button", { name: "Add", exact: true }).click();

  const interviewColumn = page.locator(".column").filter({ has: page.getByRole("heading", { name: "interview", exact: true }) });
  await page.getByLabel(`Move ${company}`).selectOption("interview");
  await expect(interviewColumn).toContainText(company);

  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();

  await page.getByLabel("New task").fill(taskTitle);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const taskCheckbox = page.getByLabel(`Complete ${taskTitle}`);
  await expect(taskCheckbox).toBeVisible();
  await taskCheckbox.click();
  await expect(page.getByLabel(`Complete ${taskTitle}`)).toBeChecked();

  await page.getByLabel("New comment").fill(comment);
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: comment })).toBeVisible();

  const activity = page.getByRole("heading", { name: "Activity", exact: true }).locator("..");
  await expect(activity).toContainText("status changed");
  await expect(activity).toContainText("task completed");
  await expect(activity).toContainText("comment added");
});
