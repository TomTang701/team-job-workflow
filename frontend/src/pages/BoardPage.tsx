import { FormEvent } from "react";

import { JobApplication, STATUSES } from "../kanban";

type BoardPageProps = {
  workspaceName: string;
  applications: JobApplication[];
  statusFilter: string;
  search: string;
  page: number;
  total: number;
  onStatusFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onApplyFilters: (event: FormEvent) => void;
  onPageChange: (page: number) => void;
  onMoveApplication: (application: JobApplication, status: string) => void;
  onViewDetails: (applicationId: number) => void;
  onCreateApplication: () => void;
};

export function BoardPage({ workspaceName, applications, statusFilter, search, page, total, onStatusFilterChange, onSearchChange, onApplyFilters, onPageChange, onMoveApplication, onViewDetails, onCreateApplication }: BoardPageProps) {
  return <section className="page-panel board-page">
    <div className="page-heading"><div><p className="eyebrow">APPLICATION BOARD</p><h2>{workspaceName}</h2></div><button type="button" onClick={onCreateApplication}>Add application</button></div>
    <section className="filter-panel" aria-label="Application filters"><form onSubmit={onApplyFilters}><label htmlFor="application-search">Search</label><input id="application-search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="company or title" /><label htmlFor="application-status">Status</label><select id="application-status" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><button>Apply filters</button></form><div className="pagination"><p>Page {page} · {total} results</p><button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</button><button type="button" onClick={() => onPageChange(page + 1)} disabled={page * 20 >= total}>Next</button></div></section>
    <section className="board" aria-label="Application kanban board">{STATUSES.map((status) => <div className="column" key={status}><h3>{status}</h3>{applications.filter((application) => application.status === status).map((application) => <article key={application.id}><strong>{application.company}</strong><span>{application.job_title}</span><button className="details-trigger" type="button" onClick={() => onViewDetails(application.id)}>View details</button><label className="sr-only" htmlFor={`move-${application.id}`}>Move {application.company}</label><select id={`move-${application.id}`} aria-label={`Move ${application.company}`} value={application.status} onChange={(event) => onMoveApplication(application, event.target.value)}>{STATUSES.map((option) => <option key={option}>{option}</option>)}</select></article>)}</div>)}</section>
  </section>;
}
