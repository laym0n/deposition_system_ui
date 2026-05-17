import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type RecordObjectEventRequest = components['schemas']['RecordObjectEventRequest'];

/**
 * Records a PREMIS event for the object.
 * POST /objects/{objectId}/events
 */
export async function recordObjectEvent(objectId: string, body: RecordObjectEventRequest) {
  return fetchJson<void>(`/objects/${objectId}/events`, {
    method: 'POST',
    body,
  });
}
