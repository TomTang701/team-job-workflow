import type { JobApplication } from "./kanban";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type AuthResult = { access_token: string; token_type: string; user: { id?: number; email: string } };
export type Workspace = { id: number; name: string; role: string };
export type WorkspaceList = { items: Workspace[] };
export type WorkspaceMember = { user_id: number; email: string; role: "owner" | "member" };
export type TaskRecord = { id: number; title: string; completed: boolean };
export type CommentRecord = { id: number; body: string; author_id: number };
export type ActivityRecord = { action: string; detail: string; actor_id: number };
export type ApplicationDetail = {
  id: number;
  workspace_id: number;
  company: string;
  job_title: string;
  status: string;
  tasks: TaskRecord[];
  comments: CommentRecord[];
  activities: ActivityRecord[];
};
export type ListApplicationsOptions = { statusFilter?: string; search?: string; page?: number; pageSize?: number };
export type ApplicationList = { items: JobApplication[]; page: number; page_size: number; total: number };

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail ?? "The API request failed.");
  return body as T;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthResult>(response);
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${apiBase}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthResult>(response);
}

export async function createWorkspace(token: string, name: string): Promise<Workspace> {
  const response = await fetch(`${apiBase}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  return parseResponse<Workspace>(response);
}

export async function listWorkspaces(token: string): Promise<WorkspaceList> {
  const response = await fetch(`${apiBase}/api/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<WorkspaceList>(response);
}

export async function addWorkspaceMember(token: string, workspaceId: number, email: string, role: WorkspaceMember["role"]): Promise<WorkspaceMember> {
  const response = await fetch(`${apiBase}/api/workspaces/${workspaceId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, role }),
  });
  return parseResponse<WorkspaceMember>(response);
}

export async function getApplicationDetails(token: string, applicationId: number): Promise<ApplicationDetail> {
  const response = await fetch(`${apiBase}/api/applications/${applicationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<ApplicationDetail>(response);
}

export async function createApplication(token: string, workspaceId: number, company: string, jobTitle: string): Promise<JobApplication> {
  const response = await fetch(`${apiBase}/api/workspaces/${workspaceId}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ company, job_title: jobTitle }),
  });
  return parseResponse<JobApplication>(response);
}

export async function setApplicationStatus(token: string, applicationId: number, status: string): Promise<JobApplication> {
  const response = await fetch(`${apiBase}/api/applications/${applicationId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  return parseResponse<JobApplication>(response);
}

export async function createTask(token: string, applicationId: number, title: string): Promise<TaskRecord> {
  const response = await fetch(`${apiBase}/api/applications/${applicationId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title }),
  });
  return parseResponse<TaskRecord>(response);
}

export async function setTaskCompletion(token: string, taskId: number, completed: boolean): Promise<TaskRecord> {
  const response = await fetch(`${apiBase}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ completed }),
  });
  return parseResponse<TaskRecord>(response);
}

export async function createComment(token: string, applicationId: number, body: string): Promise<CommentRecord> {
  const response = await fetch(`${apiBase}/api/applications/${applicationId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  });
  return parseResponse<CommentRecord>(response);
}

export async function listApplications(token: string, workspaceId: number, options: ListApplicationsOptions = {}): Promise<ApplicationList> {
  const query = new URLSearchParams();
  if (options.statusFilter) query.set("status_filter", options.statusFilter);
  if (options.search) query.set("search", options.search);
  query.set("page", String(options.page ?? 1));
  query.set("page_size", String(options.pageSize ?? 20));
  const response = await fetch(`${apiBase}/api/workspaces/${workspaceId}/applications?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<ApplicationList>(response);
}
