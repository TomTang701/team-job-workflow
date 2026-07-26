import { describe, expect, it } from "vitest";

import { parseRoute } from "./router";

describe("parseRoute", () => {
  it("maps each workflow area to its own hash page", () => {
    expect(parseRoute("#/auth")).toEqual({ page: "auth" });
    expect(parseRoute("#/workspaces")).toEqual({ page: "workspaces" });
    expect(parseRoute("#/workspaces/7/members")).toEqual({ page: "members", workspaceId: 7 });
    expect(parseRoute("#/workspaces/7/board")).toEqual({ page: "board", workspaceId: 7 });
    expect(parseRoute("#/workspaces/7/applications/new")).toEqual({ page: "application-new", workspaceId: 7 });
    expect(parseRoute("#/workspaces/7/applications/19")).toEqual({ page: "application-detail", workspaceId: 7, applicationId: 19 });
  });

  it("marks invalid paths as not found", () => {
    expect(parseRoute("#/workspaces/not-a-number/board")).toEqual({ page: "not-found" });
  });
});
