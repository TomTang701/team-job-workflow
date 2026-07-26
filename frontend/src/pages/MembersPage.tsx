import { FormEvent } from "react";

type MembersPageProps = {
  workspaceName: string;
  role: string;
  memberEmail: string;
  memberRole: "owner" | "member";
  message: string;
  onMemberEmailChange: (value: string) => void;
  onMemberRoleChange: (role: "owner" | "member") => void;
  onAddMember: (event: FormEvent) => void;
};

export function MembersPage({ workspaceName, role, memberEmail, memberRole, message, onMemberEmailChange, onMemberRoleChange, onAddMember }: MembersPageProps) {
  return <section className="page-panel">
    <p className="eyebrow">TEAM MEMBERS</p>
    <h2>{workspaceName}</h2>
    {role === "owner" ? <form className="compact-form" onSubmit={onAddMember}>
      <label htmlFor="member-email">Registered demo email</label>
      <input id="member-email" aria-label="Member email" type="email" value={memberEmail} onChange={(event) => onMemberEmailChange(event.target.value)} placeholder="member@example.test" required />
      <label htmlFor="member-role">Role</label>
      <select id="member-role" aria-label="Member role" value={memberRole} onChange={(event) => onMemberRoleChange(event.target.value as "owner" | "member")}><option value="member">member</option><option value="owner">owner</option></select>
      <button disabled={!memberEmail.trim()}>Add registered member</button>
    </form> : <p>Only workspace owners can add registered members. Your role is <strong>{role}</strong>.</p>}
    <p className="message">{message}</p>
  </section>;
}
