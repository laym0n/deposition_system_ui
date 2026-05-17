import React from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { fetchText } from '@shared/api/fetchText';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';
import { PremisXmlViewer } from './PremisXmlViewer';

async function getPremisMetadataXmlForVersion(params: { objectId: string; versionId: string }) {
  const { objectId, versionId } = params;
  const v = versionId.trim();
  if (!v) throw new Error('versionId is empty');
  const qs = new URLSearchParams({ versionId: v });
  return fetchText(`/objects/${objectId}/metadata?${qs.toString()}`, { method: 'GET' });
}

export function PremisVersionDialog(props: {
  open: boolean;
  objectId: string;
  versionId: string | null | undefined;
  onClose: () => void;
}) {
  const { open, objectId, versionId, onClose } = props;
  const debug = isDebugEnabled();
  const v = String(versionId ?? '').trim();

  const query = useQuery({
    queryKey: ['objects', 'premis-metadata-xml', objectId, 'version', v],
    queryFn: () => getPremisMetadataXmlForVersion({ objectId, versionId: v }),
    enabled: open && Boolean(objectId) && Boolean(v),
    staleTime: 10_000,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>PREMIS метаданные версии</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            versionId: {v || '—'}
          </Typography>

          {!v && <Alert severity="warning">Не задан ID версии.</Alert>}

          {query.isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          )}

          {query.isError && (
            <Alert severity="error" sx={{ mb: 0 }}>
              {(() => {
                const e = toUserFacingError(query.error);
                return (
                  <>
                    {e.title}{e.description ? `: ${e.description}` : ''}
                    {debug && query.error instanceof Error ? ` (debug: ${query.error.message})` : null}
                  </>
                );
              })()}
            </Alert>
          )}

          {query.isSuccess && query.data && <PremisXmlViewer xml={query.data} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
