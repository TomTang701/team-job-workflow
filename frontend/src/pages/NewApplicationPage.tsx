import { FormEvent } from "react";

type NewApplicationPageProps = {
  workspaceName: string;
  company: string;
  jobTitle: string;
  message: string;
  onCompanyChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
  onCreateApplication: (event: FormEvent) => void;
};

export function NewApplicationPage({ workspaceName, company, jobTitle, message, onCompanyChange, onJobTitleChange, onCreateApplication }: NewApplicationPageProps) {
  return <section className="page-panel narrow-page">
    <p className="eyebrow">NEW APPLICATION</p>
    <h2>Add a sanitized application to {workspaceName}</h2>
    <form className="compact-form" onSubmit={onCreateApplication}>
      <label htmlFor="company">Company</label>
      <input id="company" aria-label="Company" value={company} onChange={(event) => onCompanyChange(event.target.value)} placeholder="Example Co" required />
      <label htmlFor="job-title">Job title</label>
      <input id="job-title" aria-label="Job title" value={jobTitle} onChange={(event) => onJobTitleChange(event.target.value)} placeholder="Backend Intern" required />
      <button disabled={!company.trim() || !jobTitle.trim()}>Add application</button>
    </form>
    <p className="message">{message}</p>
  </section>;
}
