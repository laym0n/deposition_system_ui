import { fetchJson } from './fetchJson';

/**
 * Update descriptive metadata for an object.
 *
 * Backend contract (OpenAPI):
 *   PUT /objects/{objectId}/descriptive-metadata?entityType=...  body: string (JSON)
 */
export function upsertObjectDescriptiveMetadata(params: {
  objectId: string;
  entityType: string;
  value: unknown;
}) {
  const { objectId, entityType, value } = params;
  const qs = new URLSearchParams({ entityType });

  return fetchJson<Record<string, unknown>>(`/objects/${objectId}/descriptive-metadata?${qs.toString()}`,
    {
      method: 'PUT',
      // Endpoint expects JSON string, not JSON object.
      body: value ?? {},
    },
  );
}
