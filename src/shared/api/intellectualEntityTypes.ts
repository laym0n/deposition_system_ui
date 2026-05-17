import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type IntellectualEntityTypeDto = components['schemas']['IntellectualEntityTypeDto'];
export type CreateRequest = components['schemas']['CreateRequest'];

export function listIntellectualEntityTypes() {
  return fetchJson<IntellectualEntityTypeDto[]>('/intellectual-entity-types', {
    method: 'GET',
  });
}

export function createIntellectualEntityType(body: CreateRequest) {
  return fetchJson<IntellectualEntityTypeDto>('/intellectual-entity-types', {
    method: 'POST',
    body,
  });
}

export function updateIntellectualEntityType(id: string, body: CreateRequest) {
  return fetchJson<IntellectualEntityTypeDto>(`/intellectual-entity-types/${id}`, {
    method: 'PUT',
    body,
  });
}

export function deleteIntellectualEntityType(id: string) {
  return fetchJson<void>(`/intellectual-entity-types/${id}`, {
    method: 'DELETE',
  });
}
