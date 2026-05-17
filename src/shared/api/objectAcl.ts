import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type UpsertObjectAclEntryRequest = components['schemas']['UpsertObjectAclEntryRequest'];

export function upsertUserAclEntry(objectId: string, body: UpsertObjectAclEntryRequest) {
  return fetchJson<components['schemas']['DepositionResult']>(`/objects/${objectId}/acl/users`, {
    method: 'POST',
    body,
  });
}
