import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { addWorkspaceMember, ApplicationDetail, createApplication, createComment, createTask, deleteApplication, deleteComment, deleteTask, getApplicationDetails, listApplications, setApplicationStatus, setTaskCompletion } from "./api";
import { JobApplication } from "./kanban";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { AuthPage } from "./pages/AuthPage";
import { BoardPage } from "./pages/BoardPage";
import { MembersPage } from "./pages/MembersPage";
import { NewApplicationPage } from "./pages/NewApplicationPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { navigate, routeHash, useHashRoute } from "./router";
import { AuthenticationMode, useSession } from "./session";
import "./styles.css";

function workspacePath(workspaceId: number, suffix: string): string {
  return `/workspaces/${workspaceId}/${suffix}`;
}

export function App() {
  const route = useHashRoute();
  const session = useSession();
  const { token, userId, workspaces, workspaceId, workspaceName, email, password, message, setEmail, setMessage, setPassword, setWorkspaceId, setWorkspaceName } = session;
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [details, setDetails] = useState<ApplicationDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "member">("member");

  const workspaceRoute = route.page === "members" || route.page === "board" || route.page === "application-new" || route.page === "application-detail" ? route : null;
  const routedWorkspace = workspaceRoute ? workspaces.find((workspace) => workspace.id === workspaceRoute.workspaceId) : undefined;
  const activeWorkspace = routedWorkspace ?? workspaces.find((workspace) => String(workspace.id) === workspaceId);

  useEffect(() => {
    if (!token && route.page !== "auth") navigate("/auth");
  }, [route.page, token]);

  useEffect(() => {
    if (workspaceRoute && routedWorkspace && workspaceId !== String(routedWorkspace.id)) setWorkspaceId(String(routedWorkspace.id));
  }, [routedWorkspace, setWorkspaceId, workspaceId, workspaceRoute]);

  useEffect(() => {
    if (token && workspaceRoute && !routedWorkspace) {
      setMessage("Workspace access is required.");
      navigate("/workspaces");
    }
  }, [routedWorkspace, setMessage, token, workspaceRoute]);

  async function loadApplications(workspaceIdToLoad: number, targetPage = page) {
    if (!token) return;
    try {
      const body = await listApplications(token, workspaceIdToLoad, { statusFilter, search, page: targetPage, pageSize: 20 });
      setApplications(body.items);
      setPage(body.page);
      setTotal(body.total);
      setMessage(`${body.total} application records loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load applications.");
    }
  }

  async function loadApplicationDetails(applicationId: number) {
    if (!token) return;
    try {
      const application = await getApplicationDetails(token, applicationId);
      setDetails(application);
      setMessage(`Opened details for ${application.company}.`);
    } catch (error) {
      setDetails(null);
      setMessage(error instanceof Error ? error.message : "Could not load application details.");
      navigate("/workspaces");
    }
  }

  useEffect(() => {
    if (route.page === "board" && routedWorkspace) void loadApplications(routedWorkspace.id, 1);
  }, [route.page, routedWorkspace?.id]);

  useEffect(() => {
    if (route.page === "application-detail") void loadApplicationDetails(route.applicationId);
    else setDetails(null);
  }, [route.page, route.page === "application-detail" ? route.applicationId : null]);

  async function authenticate(event: FormEvent, mode: AuthenticationMode) {
    event.preventDefault();
    const success = await session.authenticate(email, password, mode);
    if (success) navigate("/workspaces");
  }

  async function addWorkspace(event: FormEvent) {
    event.preventDefault();
    const workspace = await session.createWorkspace(workspaceName);
    if (workspace) navigate(workspacePath(workspace.id, "board"));
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!token || !routedWorkspace || !memberEmail.trim()) return;
    try {
      const member = await addWorkspaceMember(token, routedWorkspace.id, memberEmail.trim(), memberRole);
      setMemberEmail("");
      setMessage(`Added ${member.email} as ${member.role}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add member.");
    }
  }

  async function addApplication(event: FormEvent) {
    event.preventDefault();
    if (!token || !routedWorkspace) return;
    try {
      await createApplication(token, routedWorkspace.id, company.trim(), jobTitle.trim());
      setCompany("");
      setJobTitle("");
      navigate(workspacePath(routedWorkspace.id, "board"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create application.");
    }
  }

  async function moveApplication(application: JobApplication, status: string) {
    if (!token) return;
    try {
      const updated = await setApplicationStatus(token, application.id, status);
      setApplications((current) => current.map((item) => item.id === application.id ? updated : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update status.");
    }
  }

  async function updateDetailStatus(status: string) {
    if (!token || !details) return;
    try {
      const updated = await setApplicationStatus(token, details.id, status);
      setDetails((current) => current ? { ...current, status: updated.status } : null);
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update status.");
    }
  }

  async function addTask(title: string) {
    if (!token || !details) return;
    try {
      await createTask(token, details.id, title);
      await loadApplicationDetails(details.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create task.");
    }
  }

  async function toggleTask(taskId: number, completed: boolean) {
    if (!token || !details) return;
    try {
      await setTaskCompletion(token, taskId, completed);
      await loadApplicationDetails(details.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  async function addComment(body: string) {
    if (!token || !details) return;
    try {
      await createComment(token, details.id, body);
      await loadApplicationDetails(details.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  async function removeTask(taskId: number) {
    if (!token || !details) return;
    try {
      await deleteTask(token, taskId);
      await loadApplicationDetails(details.id);
      setMessage("Deleted task.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete task.");
    }
  }

  async function removeComment(commentId: number) {
    if (!token || !details) return;
    try {
      await deleteComment(token, commentId);
      await loadApplicationDetails(details.id);
      setMessage("Deleted comment.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete comment.");
    }
  }

  async function removeApplication() {
    if (!token || !details) return;
    const applicationId = details.id;
    const workspaceForDetails = details.workspace_id;
    try {
      await deleteApplication(token, applicationId);
      setApplications((current) => current.filter((item) => item.id !== applicationId));
      setDetails(null);
      setMessage("Deleted application.");
      navigate(workspacePath(workspaceForDetails, "board"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete application.");
    }
  }

  if (!token || route.page === "auth") {
    return <main><header><p className="eyebrow">SANITIZED DEMO ONLY</p><h1>Team Job Workflow</h1><p>Shared, role-aware job-search tracking without platform automation.</p></header><AuthPage email={email} password={password} message={message} onEmailChange={setEmail} onPasswordChange={setPassword} onAuthenticate={authenticate} /></main>;
  }

  if (workspaceRoute && !routedWorkspace) {
    return <main><header><p className="eyebrow">SANITIZED DEMO ONLY</p><h1>Team Job Workflow</h1></header><section className="page-panel"><h2>Workspace unavailable</h2><p>{message}</p><a className="button-link" href={routeHash("/workspaces")}>Return to workspaces</a></section></main>;
  }

  const navigationWorkspace = activeWorkspace;
  let pageContent;
  if (route.page === "workspaces" || route.page === "not-found") {
    pageContent = <WorkspacePage workspaces={workspaces} workspaceId={workspaceId} workspaceName={workspaceName} message={message} onWorkspaceNameChange={setWorkspaceName} onWorkspaceSelect={setWorkspaceId} onCreateWorkspace={addWorkspace} onOpenBoard={(id) => navigate(workspacePath(id, "board"))} />;
  } else if (route.page === "members" && routedWorkspace) {
    pageContent = <MembersPage workspaceName={routedWorkspace.name} role={routedWorkspace.role} memberEmail={memberEmail} memberRole={memberRole} message={message} onMemberEmailChange={setMemberEmail} onMemberRoleChange={setMemberRole} onAddMember={addMember} />;
  } else if (route.page === "board" && routedWorkspace) {
    pageContent = <><BoardPage workspaceName={routedWorkspace.name} applications={applications} statusFilter={statusFilter} search={search} page={page} total={total} onStatusFilterChange={setStatusFilter} onSearchChange={setSearch} onApplyFilters={(event) => { event.preventDefault(); void loadApplications(routedWorkspace.id, 1); }} onPageChange={(targetPage) => void loadApplications(routedWorkspace.id, targetPage)} onMoveApplication={moveApplication} onViewDetails={(applicationId) => navigate(workspacePath(routedWorkspace.id, `applications/${applicationId}`))} onCreateApplication={() => navigate(workspacePath(routedWorkspace.id, "applications/new"))} /><p className="message">{message}</p></>;
  } else if (route.page === "application-new" && routedWorkspace) {
    pageContent = <NewApplicationPage workspaceName={routedWorkspace.name} company={company} jobTitle={jobTitle} message={message} onCompanyChange={setCompany} onJobTitleChange={setJobTitle} onCreateApplication={addApplication} />;
  } else if (route.page === "application-detail" && routedWorkspace) {
    pageContent = details ? <><ApplicationDetailPage detail={details} currentUserId={userId} onBack={() => navigate(workspacePath(routedWorkspace.id, "board"))} onStatusChange={updateDetailStatus} onAddTask={addTask} onTaskCompletion={toggleTask} onAddComment={addComment} onDeleteApplication={removeApplication} onDeleteTask={removeTask} onDeleteComment={removeComment} /><p className="message">{message}</p></> : <section className="page-panel"><h2>Loading application details…</h2><p className="message">{message}</p></section>;
  }

  return <main>
    <header><p className="eyebrow">SANITIZED DEMO ONLY</p><h1>Team Job Workflow</h1><p>Shared, role-aware job-search tracking without platform automation.</p></header>
    <nav className="app-nav" aria-label="Workflow navigation"><a href={routeHash("/workspaces")}>Workspaces</a>{navigationWorkspace && <><a href={routeHash(workspacePath(navigationWorkspace.id, "board"))}>Board</a><a href={routeHash(workspacePath(navigationWorkspace.id, "applications/new"))}>Add application</a><a href={routeHash(workspacePath(navigationWorkspace.id, "members"))}>Members</a></>}</nav>
    {pageContent}
  </main>;
}

const rootElement = document.getElementById("root");
if (rootElement) createRoot(rootElement).render(<App />);
