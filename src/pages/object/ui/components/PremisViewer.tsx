import React from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { fetchText } from '@shared/api/fetchText';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';
import { PremisXmlViewer } from './PremisXmlViewer';

async function getPremisMetadataXml(objectId: string) {
  return fetchText(`/objects/${objectId}/metadata`, { method: 'GET' });
}

export function PremisViewer(props: { objectId: string; enabled: boolean }) {
  const { objectId, enabled } = props;
  const debug = isDebugEnabled();

  const query = useQuery({
    queryKey: ['objects', 'premis-metadata-xml', objectId],
    queryFn: () => getPremisMetadataXml(objectId),
    enabled: Boolean(objectId) && enabled,
    staleTime: 10_000,
  });

  if (!enabled) return null;

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (query.isError) {
    const e = toUserFacingError(query.error);
    return (
      <Alert severity="error" sx={{ mb: 0 }}>
        {e.title}
        {e.description ? `: ${e.description}` : ''}
        {debug && query.error instanceof Error ? ` (debug: ${query.error.message})` : null}
      </Alert>
    );
  }

  return <PremisXmlViewer xml={query.data ?? ''} />;
}
