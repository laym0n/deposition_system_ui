import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type UpsertRightsStatementRequest = components['schemas']['UpsertRightsStatementRequest'];

export function upsertRightsStatement(objectId: string, body: UpsertRightsStatementRequest) {
  return fetchJson<components['schemas']['DepositionResult']>(`/objects/${objectId}/rights-statement`, {
    method: 'POST',
    body,
  });
}

export function updateRightsStatement(objectId: string, rightsStatementId: string, body: UpsertRightsStatementRequest) {
  return fetchJson<components['schemas']['DepositionResult']>(
    `/objects/${objectId}/rights-statements/${rightsStatementId}`,
    {
      method: 'PATCH',
      body,
    },
  );
}
