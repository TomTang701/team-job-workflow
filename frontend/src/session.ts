import { useState } from "react";

import { createWorkspace, listWorkspaces, register, signIn, Workspace } from "./api";

export type AuthenticationMode = "sign-in" | "register";

export function useSession() {
  const [token, setToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [message, setMessage] = useState("Register or sign in, then create a sanitized workspace.");

  async function loadWorkspaces(accessToken = token) {
    if (!accessToken) return;
    const body = await listWorkspaces(accessToken);
    setWorkspaces(body.items);
    setWorkspaceId((current) => {
      if (body.items.some((workspace) => String(workspace.id) === current)) return current;
      return body.items.length ? String(body.items[0].id) : "";
    });
  }

  async function authenticate(nextEmail: string, nextPassword: string, mode: AuthenticationMode) {
    try {
      const body = mode === "register" ? await register(nextEmail, nextPassword) : await signIn(nextEmail, nextPassword);
      setToken(body.access_token);
      await loadWorkspaces(body.access_token);
      setMessage(`${mode === "register" ? "Registered" : "Signed in"} as ${body.user.email}.`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
      return false;
    }
  }

  async function createNewWorkspace(name: string) {
    try {
      const workspace = await createWorkspace(token, name);
      setWorkspaces((current) => [...current.filter((item) => item.id !== workspace.id), workspace]);
      setWorkspaceId(String(workspace.id));
      setWorkspaceName("");
      setMessage(`Created ${workspace.name}. Its workspace ID is ${workspace.id}.`);
      return workspace;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create workspace.");
      return null;
    }
  }

  return {
    token,
    workspaces,
    workspaceId,
    email,
    password,
    workspaceName,
    message,
    setWorkspaceId,
    setEmail,
    setPassword,
    setWorkspaceName,
    setMessage,
    loadWorkspaces,
    authenticate,
    createWorkspace: createNewWorkspace,
  };
}
