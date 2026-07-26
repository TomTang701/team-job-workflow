// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  addWorkspaceMember: vi.fn(),
  createApplication: vi.fn(),
  createComment: vi.fn(),
  createTask: vi.fn(),
  createWorkspace: vi.fn(),
  getApplicationDetails: vi.fn(),
  listApplications: vi.fn(),
  listWorkspaces: vi.fn(),
  register: vi.fn(),
  setApplicationStatus: vi.fn(),
  setTaskCompletion: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("./api", () => api);

import { App } from "./main";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App", () => {
  it("loads an accessible workspace after a successful sign-in", async () => {
    api.signIn.mockResolvedValue({ access_token: "test-token", user: { email: "owner@example.test" } });
    api.listWorkspaces.mockResolvedValue({ items: [{ id: 7, name: "Sanitized Workspace", role: "owner" }] });
    render(<App />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery-staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Signed in as owner@example.test.")).not.toBeNull();
    expect(api.listWorkspaces).toHaveBeenCalledWith("test-token");
    expect(screen.getByRole("option", { name: "Sanitized Workspace (owner)" })).not.toBeNull();
  });

  it("shows the API error when sign-in fails", async () => {
    api.signIn.mockRejectedValue(new Error("Authentication offline."));
    render(<App />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery-staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Authentication offline.")).not.toBeNull();
  });
});
