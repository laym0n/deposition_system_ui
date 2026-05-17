import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type CreateJobRequest = components['schemas']['CreateJobRequest'];
export type CreateDepositionJobResult = components['schemas']['CreateDepositionJobResult'];
export type DepositionJobStatusResponse = components['schemas']['DepositionJobStatusResponse'];
export type DepositionJobListItem = components['schemas']['DepositionJobListItem'];
export type DepositionJobPage = components['schemas']['DepositionJobPage'];

export function createDeponeJob(body: CreateJobRequest) {
  return fetchJson<CreateDepositionJobResult>('/depone/jobs', {
    method: 'POST',
    body,
  });
}

export function submitDeponeJob(jobId: string) {
  return fetchJson<void>(`/depone/jobs/${jobId}/submit`, {
    method: 'POST',
  });
}

export function getDeponeJobStatus(jobId: string) {
  return fetchJson<DepositionJobStatusResponse>(`/depone/jobs/${jobId}`, {
    method: 'GET',
  });
}

/** Returns deposition jobs for current user (paginated). */
export function listMyDeponeJobs(params?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.size !== undefined) qs.set('size', String(params.size));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  return fetchJson<DepositionJobPage>(`/depone/jobs${suffix}`, {
    method: 'GET',
  });
}
