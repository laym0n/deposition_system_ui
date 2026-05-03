import React from 'react';
import { Alert, Box, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { components } from '@shared/api/generated/api-types';
import { fetchJson } from '@shared/api/fetchJson';

type CachedObjectMetadataResponse = components['schemas']['CachedObjectMetadataResponse'];

async function getCachedMetadata(objectId: string) {
  return fetchJson<CachedObjectMetadataResponse>(`/objects/${objectId}/cached-metadata`, {
    method: 'GET',
  });
}

export function ObjectPage() {
  const { objectId } = useParams({ from: '/objects/$objectId' });

  const query = useQuery({
    queryKey: ['objects', 'cached-metadata', objectId],
    queryFn: () => getCachedMetadata(objectId),
    enabled: Boolean(objectId),
    staleTime: 10_000,
  });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5">Объект</Typography>
        <Typography color="text.secondary">ID: {objectId}</Typography>

        {query.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {query.isError && (
          <Alert severity="error">
            Не удалось загрузить данные объекта.{' '}
            {query.error instanceof Error ? query.error.message : null}
          </Alert>
        )}

        {query.isSuccess && (
          <Box
            component="pre"
            sx={{
              p: 2,
              m: 0,
              borderRadius: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
            }}
          >
            {JSON.stringify(query.data, null, 2)}
          </Box>
        )}
      </Stack>
    </Container>
  );
}
