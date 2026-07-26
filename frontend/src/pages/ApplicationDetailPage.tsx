import { FormEvent, useState } from "react";

import { ApplicationDetail } from "../api";

type DeleteTarget = { kind: "application" } | { kind: "task"; id: number; title: string } | { kind: "comment"; id: number; body: string };

type ApplicationDetailPageProps = {
  detail: ApplicationDetail;
  currentUserId: number | null;
  onBack: () => void;
  onStatusChange: (status: string) => void;
  onAddTask: (title: string) => void;
  onTaskCompletion: (taskId: number, completed: boolean) => void;
  onAddComment: (body: string) => void;
  onDeleteApplication: () => void;
  onDeleteTask: (taskId: number) => void;
  onDeleteComment: (commentId: number) => void;
};

function canDelete(workspaceRole: string, creatorId: number, currentUserId: number | null): boolean {
  return workspaceRole === "owner" || creatorId === currentUserId;
}

export function ApplicationDetailPage({ detail, currentUserId, onBack, onStatusChange, onAddTask, onTaskCompletion, onAddComment, onDeleteApplication, onDeleteTask, onDeleteComment }: ApplicationDetailPageProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const canDeleteApplication = canDelete(detail.workspace_role, detail.created_by_id, currentUserId);

  function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(taskTitle.trim());
    setTaskTitle("");
  }

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    onAddComment(commentBody.trim());
    setCommentBody("");
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "application") onDeleteApplication();
    if (pendingDelete.kind === "task") onDeleteTask(pendingDelete.id);
    if (pendingDelete.kind === "comment") onDeleteComment(pendingDelete.id);
    setPendingDelete(null);
  }

  const confirmationName = pendingDelete ? `Confirm delete ${pendingDelete.kind}` : "Confirm delete";
  return <section className="page-panel details" aria-label="Application details">
    <header className="details-header"><div><p className="eyebrow">APPLICATION DETAILS</p><h2>{detail.company} — {detail.job_title}</h2></div><button className="secondary-button" type="button" onClick={onBack}>Back to board</button></header>
    <section className="status-panel"><label htmlFor="application-detail-status">Status</label><select id="application-detail-status" value={detail.status} onChange={(event) => onStatusChange(event.target.value)}><option value="saved">saved</option><option value="applied">applied</option><option value="interview">interview</option><option value="offer">offer</option><option value="rejected">rejected</option></select>{canDeleteApplication && <button className="danger-button" type="button" onClick={() => setPendingDelete({ kind: "application" })}>Delete application</button>}</section>
    {pendingDelete && <section className="delete-confirmation" role="alert"><p>Delete this {pendingDelete.kind}? This action cannot be undone.</p><div className="button-row"><button className="danger-button" type="button" onClick={confirmDelete}>{confirmationName}</button><button className="secondary-button" type="button" onClick={() => setPendingDelete(null)}>Cancel</button></div></section>}
    <div className="details-grid">
      <section><h3>Tasks</h3><form onSubmit={submitTask}><label htmlFor="task-title">New task</label><input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Prepare interview notes" /><button disabled={!taskTitle.trim()}>Add task</button></form><ul className="record-list">{detail.tasks.map((task) => <li key={task.id}><label><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.completed} onChange={(event) => onTaskCompletion(task.id, event.target.checked)} /> {task.title}</label>{canDelete(detail.workspace_role, task.created_by_id, currentUserId) && <button className="text-button danger-text" type="button" onClick={() => setPendingDelete({ kind: "task", id: task.id, title: task.title })}>Delete task {task.title}</button>}</li>)}</ul></section>
      <section><h3>Comments</h3><form onSubmit={submitComment}><label htmlFor="comment-body">New comment</label><textarea id="comment-body" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Share a sanitized collaboration note" /><button disabled={!commentBody.trim()}>Add comment</button></form><ul className="record-list">{detail.comments.map((comment) => <li key={comment.id}><p>{comment.body}</p><small>Member #{comment.author_id}</small>{canDelete(detail.workspace_role, comment.author_id, currentUserId) && <button className="text-button danger-text" type="button" onClick={() => setPendingDelete({ kind: "comment", id: comment.id, body: comment.body })}>Delete comment {comment.body}</button>}</li>)}</ul></section>
      <section><h3>Activity</h3><ol className="record-list">{detail.activities.map((activity, index) => <li key={`${activity.action}-${index}`}><strong>{activity.action.replaceAll("_", " ")}</strong><span>{activity.detail} · Member #{activity.actor_id}</span></li>)}</ol></section>
    </div>
  </section>;
}
