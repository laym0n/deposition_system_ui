import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

type VerifyPremisResult = components['schemas']['VerifyPremisResult'];

export async function verifyObjectPremis(objectId: string) {
  return fetchJson<VerifyPremisResult>(`/objects/${objectId}/verify`, {
    method: 'GET',
  });
}
