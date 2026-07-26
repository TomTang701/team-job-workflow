// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApplicationDetailPage } from "./ApplicationDetailPage";

describe("ApplicationDetailPage", () => {
  it("hides another member's task and comment delete controls", () => {
    render(
      <ApplicationDetailPage
        currentUserId={2}
        detail={{
          id: 19,
          workspace_id: 7,
          company: "Example Co",
          job_title: "Backend Intern",
          status: "interview",
          created_by_id: 1,
          workspace_role: "member",
          tasks: [{ id: 3, title: "Prepare STAR stories", completed: false, created_by_id: 1 }],
          comments: [{ id: 4, body: "Sanitized note", author_id: 1 }],
          activities: [],
        }}
        onBack={vi.fn()}
        onDeleteApplication={vi.fn()}
        onDeleteComment={vi.fn()}
        onDeleteTask={vi.fn()}
        onAddComment={vi.fn()}
        onAddTask={vi.fn()}
        onStatusChange={vi.fn()}
        onTaskCompletion={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Delete task Prepare STAR stories" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete comment Sanitized note" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete application" })).toBeNull();
  });
});
