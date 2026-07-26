import { expect, test } from "@playwright/test";

test("owner completes and cleans up the sanitized collaboration workflow through routed pages", async ({ page }) => {
  const runId = crypto.randomUUID().slice(0, 8);
  const email = `browser-owner-${runId}@example.test`;
  const password = crypto.randomUUID();
  const workspaceName = `Browser workspace ${runId}`;
  const company = `Browser Example ${runId}`;
  const taskTitle = `Prepare browser notes ${runId}`;
  const comment = `Sanitized browser comment ${runId}.`;

  await page.goto("/#/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.locator(".message")).toContainText(`Registered as ${email}`);

  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: workspaceName, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add application", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Add a sanitized application to ${workspaceName}`, exact: true })).toBeVisible();
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Job title").fill("Backend Intern");
  await page.getByRole("button", { name: "Add application", exact: true }).click();

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

  await page.getByRole("button", { name: `Delete task ${taskTitle}` }).click();
  await page.getByRole("button", { name: "Confirm delete task" }).click();
  await expect(page.getByLabel(`Complete ${taskTitle}`)).toHaveCount(0);

  await page.getByRole("button", { name: `Delete comment ${comment}` }).click();
  await page.getByRole("button", { name: "Confirm delete comment" }).click();
  await expect(page.getByText(comment, { exact: true })).toHaveCount(0);

  const activity = page.getByRole("heading", { name: "Activity", exact: true }).locator("..");
  await expect(activity).toContainText("status changed");
  await expect(activity).toContainText("task deleted");
  await expect(activity).toContainText("comment deleted");
});
