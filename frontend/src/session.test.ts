// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  register: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("./api", () => api);

import { useSession } from "./session";

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSession", () => {
  it("selects the first accessible workspace after a successful sign-in", async () => {
    api.signIn.mockResolvedValue({ access_token: "test-token", token_type: "bearer", user: { id: 1, email: "owner@example.test" } });
    api.listWorkspaces.mockResolvedValue({ items: [{ id: 7, name: "Sanitized Workspace", role: "owner" }] });
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.authenticate("owner@example.test", "correct-horse-battery-staple", "sign-in");
    });

    expect(result.current.token).toBe("test-token");
    expect(result.current.workspaceId).toBe("7");
    expect(result.current.workspaces).toEqual([{ id: 7, name: "Sanitized Workspace", role: "owner" }]);
    expect(result.current.message).toBe("Signed in as owner@example.test.");
  });

  it("keeps the account form usable and reports an authentication error", async () => {
    api.signIn.mockRejectedValue(new Error("Authentication offline."));
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.authenticate("owner@example.test", "correct-horse-battery-staple", "sign-in");
    });

    expect(result.current.token).toBe("");
    expect(result.current.message).toBe("Authentication offline.");
  });

  it("selects a newly created workspace without duplicating it in the selector", async () => {
    api.signIn.mockResolvedValue({ access_token: "test-token", token_type: "bearer", user: { id: 1, email: "owner@example.test" } });
    api.listWorkspaces.mockResolvedValue({ items: [{ id: 7, name: "Existing Workspace", role: "owner" }] });
    api.createWorkspace.mockResolvedValue({ id: 8, name: "New Workspace", role: "owner" });
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.authenticate("owner@example.test", "correct-horse-battery-staple", "sign-in");
    });
    await act(async () => {
      await result.current.createWorkspace("New Workspace");
    });

    expect(result.current.workspaceId).toBe("8");
    expect(result.current.workspaces).toEqual([
      { id: 7, name: "Existing Workspace", role: "owner" },
      { id: 8, name: "New Workspace", role: "owner" },
    ]);
    expect(result.current.message).toBe("Created New Workspace. Its workspace ID is 8.");
  });
});
