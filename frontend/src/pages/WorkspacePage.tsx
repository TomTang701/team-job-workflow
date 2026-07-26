import { FormEvent } from "react";

import { Workspace } from "../api";

type WorkspacePageProps = {
  workspaces: Workspace[];
  workspaceId: string;
  workspaceName: string;
  message: string;
  onWorkspaceNameChange: (value: string) => void;
  onWorkspaceSelect: (workspaceId: string) => void;
  onCreateWorkspace: (event: FormEvent) => void;
  onOpenBoard: (workspaceId: number) => void;
};

export function WorkspacePage({ workspaces, workspaceId, workspaceName, message, onWorkspaceNameChange, onWorkspaceSelect, onCreateWorkspace, onOpenBoard }: WorkspacePageProps) {
  const selectedWorkspace = workspaces.find((workspace) => String(workspace.id) === workspaceId);
  return <section className="page-panel">
    <p className="eyebrow">WORKSPACES</p>
    <h2>Create or select a team workspace</h2>
    <form className="compact-form" onSubmit={onCreateWorkspace}>
      <label htmlFor="workspace-name">Workspace name</label>
      <input id="workspace-name" aria-label="Workspace name" value={workspaceName} onChange={(event) => onWorkspaceNameChange(event.target.value)} placeholder="Sanitized internship search" required />
      <button disabled={!workspaceName.trim()}>Create workspace</button>
    </form>
    <label htmlFor="active-workspace">Active workspace</label>
    <select id="active-workspace" aria-label="Active workspace" value={workspaceId} onChange={(event) => onWorkspaceSelect(event.target.value)}>
      <option value="">Select a workspace</option>
      {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} ({workspace.role})</option>)}
    </select>
    {selectedWorkspace && <button type="button" onClick={() => onOpenBoard(selectedWorkspace.id)}>Open board</button>}
    <div className="workspace-list" aria-label="Accessible workspaces">
      {workspaces.map((workspace) => <article key={workspace.id} className="workspace-card"><h3>{workspace.name}</h3><p>{workspace.role}</p><button type="button" onClick={() => onOpenBoard(workspace.id)}>Open {workspace.name}</button></article>)}
    </div>
    <p className="message">{message}</p>
  </section>;
}
