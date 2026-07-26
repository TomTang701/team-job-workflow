import { afterEach, describe, expect, it, vi } from "vitest";

import { addWorkspaceMember, createApplication, createComment, createTask, createWorkspace, getApplicationDetails, listApplications, setApplicationStatus, setTaskCompletion, signIn } from "./api";

describe("workflow API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends credentials to the sign-in endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ access_token: "token", user: { email: "demo@example.test" } }), { status: 200 }));

    const result = await signIn("demo@example.test", "correct-horse-battery-staple");

    expect(result.access_token).toBe("token");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("creates a workspace with a bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 3, name: "Sanitized Search", role: "owner" }), { status: 201 }));

    const workspace = await createWorkspace("token", "Sanitized Search");

    expect(workspace.id).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/workspaces", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("creates an application with a bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 17, company: "Example", job_title: "Backend Intern", status: "saved" }), { status: 201 }));

    const application = await createApplication("token", 2, "Example", "Backend Intern");

    expect(application).toMatchObject({ id: 17, company: "Example", job_title: "Backend Intern", status: "saved" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/workspaces/2/applications", expect.objectContaining({ method: "POST", body: JSON.stringify({ company: "Example", job_title: "Backend Intern" }), headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("updates an application status with a bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 17, company: "Example", job_title: "Backend Intern", status: "interview" }), { status: 200 }));

    const application = await setApplicationStatus("token", 17, "interview");

    expect(application.status).toBe("interview");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/applications/17/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "interview" }), headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("loads application details with collaboration records", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 7, workspace_id: 2, company: "Example", job_title: "Backend Intern", status: "interview", tasks: [], comments: [], activities: [] }), { status: 200 }));

    const details = await getApplicationDetails("token", 7);

    expect(details.id).toBe(7);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/applications/7", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("adds a task to the selected application", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 19, title: "Prepare STAR stories", completed: false }), { status: 201 }));

    const task = await createTask("token", 7, "Prepare STAR stories");

    expect(task).toMatchObject({ id: 19, title: "Prepare STAR stories", completed: false });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/applications/7/tasks", expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Prepare STAR stories" }), headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("updates completion for a collaboration task", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 19, title: "Prepare STAR stories", completed: true }), { status: 200 }));

    const task = await setTaskCompletion("token", 19, true);

    expect(task.completed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/tasks/19", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ completed: true }), headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("adds a comment to the selected application", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 23, body: "Share interview notes", author_id: 4 }), { status: 201 }));

    const comment = await createComment("token", 7, "Share interview notes");

    expect(comment).toMatchObject({ id: 23, body: "Share interview notes", author_id: 4 });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/applications/7/comments", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "Share interview notes" }), headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("loads a filtered search result page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 7, company: "Example", job_title: "Platform Intern", status: "interview" }], page: 2, page_size: 10, total: 11 }), { status: 200 }));

    const result = await listApplications("token", 2, { statusFilter: "interview", search: "Platform", page: 2, pageSize: 10 });

    expect(result).toMatchObject({ page: 2, page_size: 10, total: 11 });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/workspaces/2/applications?status_filter=interview&search=Platform&page=2&page_size=10", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });

  it("adds a registered member with the selected role", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ user_id: 8, email: "member@example.test", role: "member" }), { status: 200 }));

    const member = await addWorkspaceMember("token", 2, "member@example.test", "member");

    expect(member).toMatchObject({ user_id: 8, email: "member@example.test", role: "member" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/workspaces/2/members", expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "member@example.test", role: "member" }), headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });
});
