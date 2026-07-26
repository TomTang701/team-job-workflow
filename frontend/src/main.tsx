import { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { groupApplications, JobApplication, STATUSES } from "./kanban";
import { addWorkspaceMember, ApplicationDetail, createApplication, createComment, createTask, createWorkspace, getApplicationDetails, listApplications, listWorkspaces, register, setApplicationStatus, setTaskCompletion, signIn, Workspace } from "./api";
import "./styles.css";

function App() {
  const [token, setToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [details, setDetails] = useState<ApplicationDetail | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "member">("member");
  const [message, setMessage] = useState("Register or sign in, then create a sanitized workspace.");
  const groups = useMemo(() => groupApplications(applications), [applications]);

  async function loadWorkspaces(accessToken = token) {
    if (!accessToken) return;
    const body = await listWorkspaces(accessToken);
    setWorkspaces(body.items);
    setWorkspaceId((current) => {
      if (body.items.some((workspace) => String(workspace.id) === current)) return current;
      return body.items.length ? String(body.items[0].id) : "";
    });
  }

  async function authenticate(event: FormEvent, mode: "sign-in" | "register") {
    event.preventDefault();
    try {
      const body = mode === "register" ? await register(email, password) : await signIn(email, password);
      setToken(body.access_token);
      await loadWorkspaces(body.access_token);
      setMessage(`${mode === "register" ? "Registered" : "Signed in"} as ${body.user.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  async function addWorkspace(event: FormEvent) {
    event.preventDefault();
    try {
      const workspace = await createWorkspace(token, workspaceName);
      setWorkspaces((current) => [...current.filter((item) => item.id !== workspace.id), workspace]);
      setWorkspaceId(String(workspace.id));
      setApplications([]);
      setDetails(null);
      setWorkspaceName("");
      setMessage(`Created ${workspace.name}. Its workspace ID is ${workspace.id}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create workspace.");
    }
  }

  async function loadApplications(targetPage = page) {
    if (!token || !workspaceId) return;
    try {
      const body = await listApplications(token, Number(workspaceId), { statusFilter, search, page: targetPage, pageSize: 20 });
      setApplications(body.items);
      setPage(body.page);
      setTotal(body.total);
      setMessage(`${body.total} application records loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load applications.");
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    void loadApplications(1);
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!token || !workspaceId || !memberEmail.trim()) return;
    try {
      const member = await addWorkspaceMember(token, Number(workspaceId), memberEmail.trim(), memberRole);
      setMemberEmail("");
      setMessage(`Added ${member.email} as ${member.role}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add member.");
    }
  }

  async function addApplication(event: FormEvent) {
    event.preventDefault();
    try {
      await createApplication(token, Number(workspaceId), company, jobTitle);
      setCompany("");
      setJobTitle("");
      await loadApplications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create application.");
    }
  }

  async function moveApplication(application: JobApplication, target: string) {
    try {
      const updated = await setApplicationStatus(token, application.id, target);
      setApplications((current) => current.map((item) => (item.id === application.id ? updated : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update status.");
    }
  }

  async function loadApplicationDetails(applicationId: number) {
    try {
      const application = await getApplicationDetails(token, applicationId);
      setDetails(application);
      setMessage(`Opened details for ${application.company}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load application details.");
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!details || !taskTitle.trim()) return;
    try {
      await createTask(token, details.id, taskTitle.trim());
      setTaskTitle("");
      await loadApplicationDetails(details.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create task.");
    }
  }

  async function toggleTask(taskId: number, completed: boolean) {
    try {
      await setTaskCompletion(token, taskId, completed);
      if (details) await loadApplicationDetails(details.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!details || !commentBody.trim()) return;
    try {
      await createComment(token, details.id, commentBody.trim());
      setCommentBody("");
      await loadApplicationDetails(details.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  return <main>
    <header><p className="eyebrow">SANITIZED DEMO ONLY</p><h1>Team Job Workflow</h1><p>Shared, role-aware job-search tracking without platform automation.</p></header>
    <section className="controls">
      <form onSubmit={(event) => authenticate(event, "sign-in")}><h2>Account</h2><input aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" /><input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="12+ character password" /><button>Sign in</button><button type="button" onClick={(event) => authenticate(event, "register")}>Register</button></form>
      <form onSubmit={addWorkspace}><h2>Workspace</h2><input aria-label="Workspace name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="sanitized workspace name" /><button disabled={!token || !workspaceName}>Create workspace</button><select aria-label="Active workspace" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setApplications([]); setDetails(null); }} disabled={!token}><option value="">Select a workspace</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} ({workspace.role})</option>)}</select><button type="button" onClick={() => loadApplications()} disabled={!token || !workspaceId}>Load board</button></form>
      <form onSubmit={addApplication}><h2>Add application</h2><input aria-label="Company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="company" /><input aria-label="Job title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="job title" /><button disabled={!token || !workspaceId}>Add</button></form>
      <form onSubmit={addMember}><h2>Team member</h2><input aria-label="Member email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="registered demo email" /><select aria-label="Member role" value={memberRole} onChange={(event) => setMemberRole(event.target.value as "owner" | "member")}><option value="member">member</option><option value="owner">owner</option></select><button disabled={!token || !workspaceId || !memberEmail.trim()}>Add registered member</button></form>
    </section>
    <p className="message">{message}</p>
    <section className="filter-panel" aria-label="Application filters"><form onSubmit={applyFilters}><label htmlFor="application-search">Search</label><input id="application-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="company or title" /><label htmlFor="application-status">Status</label><select id="application-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><button disabled={!token || !workspaceId}>Apply filters</button></form><div className="pagination"><p>Page {page} · {total} results</p><button type="button" onClick={() => loadApplications(page - 1)} disabled={!token || !workspaceId || page <= 1}>Previous</button><button type="button" onClick={() => loadApplications(page + 1)} disabled={!token || !workspaceId || page * 20 >= total}>Next</button></div></section>
    <section className="board" aria-label="Application kanban board">{STATUSES.map((status) => <div className="column" key={status}><h2>{status}</h2>{groups[status].map((application) => <article key={application.id}><strong>{application.company}</strong><span>{application.job_title}</span><button className="details-trigger" type="button" onClick={() => loadApplicationDetails(application.id)}>View details</button><select aria-label={`Move ${application.company}`} value={application.status} onChange={(event) => moveApplication(application, event.target.value)}>{STATUSES.map((option) => <option key={option}>{option}</option>)}</select></article>)}</div>)}</section>
    {details && <section className="details" aria-label="Application details">
      <header className="details-header"><div><p className="eyebrow">APPLICATION DETAILS</p><h2>{details.company} — {details.job_title}</h2><p>{details.status}</p></div><button className="close-details" type="button" onClick={() => setDetails(null)}>Close details</button></header>
      <div className="details-grid">
        <section><h3>Tasks</h3><form onSubmit={addTask}><label htmlFor="task-title">New task</label><input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Prepare interview notes" /><button disabled={!taskTitle.trim()}>Add task</button></form><ul className="record-list">{details.tasks.map((task) => <li key={task.id}><label><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.completed} onChange={(event) => toggleTask(task.id, event.target.checked)} /> {task.title}</label></li>)}</ul></section>
        <section><h3>Comments</h3><form onSubmit={addComment}><label htmlFor="comment-body">New comment</label><textarea id="comment-body" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Share a sanitized collaboration note" /><button disabled={!commentBody.trim()}>Add comment</button></form><ul className="record-list">{details.comments.map((comment) => <li key={comment.id}><p>{comment.body}</p><small>Member #{comment.author_id}</small></li>)}</ul></section>
        <section><h3>Activity</h3><ol className="record-list">{details.activities.map((activity, index) => <li key={`${activity.action}-${index}`}><strong>{activity.action.replaceAll("_", " ")}</strong><span>{activity.detail} · Member #{activity.actor_id}</span></li>)}</ol></section>
      </div>
    </section>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
