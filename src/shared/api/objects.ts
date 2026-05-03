import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type ObjectSearchRequest = components['schemas']['ObjectSearchRequest'];
export type SearchObjectsResult = components['schemas']['SearchObjectsResult'];

export function searchObjects(body: ObjectSearchRequest) {
  return fetchJson<SearchObjectsResult>('/objects/search', {
    method: 'POST',
    body,
  });
}
