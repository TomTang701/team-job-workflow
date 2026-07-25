import { describe, expect, it } from "vitest";

import { groupApplications } from "./kanban";

describe("groupApplications", () => {
  it("places every application into its status column", () => {
    const groups = groupApplications([
      { id: 1, company: "Acme", job_title: "Backend Intern", status: "applied" },
      { id: 2, company: "Beta", job_title: "Platform Intern", status: "interview" },
    ]);

    expect(groups.applied).toHaveLength(1);
    expect(groups.interview[0].company).toBe("Beta");
    expect(groups.saved).toEqual([]);
  });
});
