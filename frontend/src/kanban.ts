export type ApplicationStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export type JobApplication = {
  id: number;
  company: string;
  job_title: string;
  status: ApplicationStatus;
};

export const STATUSES: ApplicationStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

export function groupApplications(applications: JobApplication[]): Record<ApplicationStatus, JobApplication[]> {
  const groups: Record<ApplicationStatus, JobApplication[]> = {
    saved: [],
    applied: [],
    interview: [],
    offer: [],
    rejected: [],
  };
  for (const application of applications) {
    groups[application.status].push(application);
  }
  return groups;
}
