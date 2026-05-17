import type { components } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type PresignedSourceFilesDownloadResponse = components['schemas']['PresignedSourceFilesDownloadResponse'];

/**
 * Returns presigned download URL(s) for object source file(s).
 * GET /objects/{objectId}/source-files/presigned?fileId=<uuid>
 */
export async function presignSourceFilesDownload(params: { objectId: string; fileId?: string | string[] }) {
  const { objectId, fileId } = params;

  const qs = new URLSearchParams();
  if (Array.isArray(fileId)) {
    for (const id of fileId) qs.append('fileId', id);
  } else if (fileId) {
    qs.set('fileId', fileId);
  }

  const url = qs.toString() ? `/objects/${objectId}/source-files/presigned?${qs.toString()}` : `/objects/${objectId}/source-files/presigned`;
  return fetchJson<PresignedSourceFilesDownloadResponse[]>(url, { method: 'GET' });
}
