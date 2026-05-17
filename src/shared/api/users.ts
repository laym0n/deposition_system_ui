import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type UserSummaryResponse = components['schemas']['UserSummaryResponse'];

export function searchUsers(params?: { searchQuery?: string; offset?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.searchQuery) qs.set('searchQuery', params.searchQuery);
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  return fetchJson<UserSummaryResponse[]>(`/users/search${suffix}`, {
    method: 'GET',
  });
}
