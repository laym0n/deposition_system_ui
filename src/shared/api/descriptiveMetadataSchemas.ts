import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type DescriptiveMetadataSchemaSummaryDto = components['schemas']['DescriptiveMetadataSchemaSummaryDto'];
export type DescriptiveMetadataSchemaDto = components['schemas']['DescriptiveMetadataSchemaDto'];
export type CreateSchemaRequest = components['schemas']['CreateSchemaRequest'];
export type UpdateActiveRequest = components['schemas']['UpdateActiveRequest'];

export function getDescriptiveMetadataSchemas(params?: {
  /**
   * Name of intellectual entity type. Backend uses string values, not a fixed enum.
   * (Previously it was DATABASE/SCIENTIFIC_WORK).
   */
  entityType?: string;
  active?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params?.entityType) qs.set('entityType', params.entityType);
  if (params?.active !== undefined) qs.set('active', String(params.active));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  return fetchJson<DescriptiveMetadataSchemaSummaryDto[]>(`/descriptive-metadata/schemas${suffix}`, {
    method: 'GET',
  });
}

/**
 * Returns JsonSchema for a descriptive-metadata schema.
 *
 * Note: OpenAPI currently types this endpoint as `{ [key:string]: unknown }`,
 * but backend actually returns JsonSchema object.
 */
export function getDescriptiveMetadataJsonSchema(schemaId: string) {
  return fetchJson<Record<string, unknown>>(`/descriptive-metadata/schemas/${schemaId}`, {
    method: 'GET',
  });
}

export function createDescriptiveMetadataSchema(body: CreateSchemaRequest) {
  return fetchJson<DescriptiveMetadataSchemaDto>('/descriptive-metadata/schema', {
    method: 'POST',
    body,
  });
}

export function updateDescriptiveMetadataSchemaActive(schemaId: string, body: UpdateActiveRequest) {
  return fetchJson<DescriptiveMetadataSchemaDto>(`/descriptive-metadata/schema/${schemaId}/active`, {
    method: 'PUT',
    body,
  });
}
