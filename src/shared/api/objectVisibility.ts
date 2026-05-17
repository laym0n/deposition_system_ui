import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type UpdateObjectVisibilityRequest = components['schemas']['UpdateObjectVisibilityRequest'];

export function updateObjectVisibility(objectId: string, body: UpdateObjectVisibilityRequest) {
  return fetchJson<components['schemas']['DepositionResult']>(`/objects/${objectId}/visibility`, {
    method: 'PUT',
    body,
  });
}
