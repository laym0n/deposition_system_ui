import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { components } from '@shared/api/generated/api-types';
import { fetchJson } from '@shared/api/fetchJson';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';
import { useUserId } from '@shared/auth/useUserId';
import { maskId } from './components/maskId';
import { prettyDate } from './components/prettyDate';
import { MetadataTree } from './components/MetadataTree';
import { PremisViewer } from './components/PremisViewer';
import { ObjectStatistics } from './components/ObjectStatistics';
import { ObjectAnchorsHistory } from './components/ObjectAnchorsHistory';

type CachedObjectMetadataResponse = components['schemas']['CachedObjectMetadataResponse'];
type ObjectAcl = components['schemas']['ObjectAcl'];

function hasWritePermission(params: { acl?: ObjectAcl; userId: string | null | undefined }): boolean {
  const { acl, userId } = params;
  if (!userId) return false;
  const entries = acl?.entries ?? [];
  for (const e of entries) {
    if (e.principal?.id !== userId) continue;
    const perms = e.permissions ?? [];
    if (perms.includes('WRITE')) return true;
  }
  return false;
}

async function getCachedMetadata(objectId: string) {
  return fetchJson<CachedObjectMetadataResponse>(`/objects/${objectId}/cached-metadata`, {
    method: 'GET',
  });
}

export function ObjectViewPage() {
  const { objectId } = useParams({ from: '/objects/$objectId' });
  const navigate = useNavigate();
  const userId = useUserId();
  const debug = isDebugEnabled();

  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ['objects', 'cached-metadata', objectId],
    queryFn: () => getCachedMetadata(objectId),
    enabled: Boolean(objectId),
    staleTime: 10_000,
  });

  const data = query.data;
  const originalName = data?.premisMetadata?.originalName;
  const anchors = data?.premisMetadata?.anchors ?? [];
  const descriptive = data?.descriptiveMetadata ?? null;
  const latestAnchor = useMemo(() => {
    return [...anchors].sort((a, b) => String(b.anchoredAt).localeCompare(String(a.anchoredAt)))[0];
  }, [anchors]);

  const canWrite = hasWritePermission({ acl: data?.acl, userId });

  const [premisExpanded, setPremisExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" noWrap>
                    {originalName?.trim() ? originalName : 'Объект'}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      № {maskId(objectId)}
                    </Typography>
                    <Tooltip title={copied ? 'Скопировано' : 'Скопировать полный ID'}>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(objectId);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 800);
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                {canWrite && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => void navigate({ to: '/objects/$objectId/edit', params: { objectId } })}
                    >
                      Перейти к редактированию
                    </Button>
                  </Stack>
                )}
              </Stack>

              {latestAnchor ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                  <Chip size="small" color="success" label="Депонирован" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Последний якорь: {prettyDate(latestAnchor.anchoredAt)}
                  </Typography>
                </Stack>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                  <Chip size="small" color="warning" label="Не депонирован" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Якорей депонирования пока нет.
                  </Typography>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {query.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {query.isError && (
          <Alert severity="error">
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

        {query.isSuccess && (
          <>
            <Alert severity="info">
              Это режим просмотра. Для изменения метаданных используйте «Перейти к редактированию».
            </Alert>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.25}>
                  <Box>
                    <Typography variant="h6">История фиксаций</Typography>
                    <Typography variant="body2" color="text.secondary">
                      История фиксации версий в хранилище и транзакции в блокчейне.
                    </Typography>
                  </Box>

                  <ObjectAnchorsHistory objectId={objectId} anchors={anchors} defaultPageSize={5} />
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h6">Метаданные</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Описательные метаданные и PREMIS.
                    </Typography>
                  </Box>

                  {descriptive ? (
                    <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <MetadataTree value={descriptive} />
                    </Box>
                  ) : (
                    <Alert severity="info">Описательные метаданные отсутствуют.</Alert>
                  )}

                  <Divider />

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={premisExpanded}
                    onChange={(_, next) => setPremisExpanded(next)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">PREMIS (подробно)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <PremisViewer objectId={objectId} enabled={premisExpanded} />
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h6">Статистика событий</Typography>
                    <Typography variant="body2" color="text.secondary">
                      События по объекту за выбранный период.
                    </Typography>
                  </Box>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={statsExpanded}
                    onChange={(_, next) => setStatsExpanded(next)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Показать графики</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <ObjectStatistics objectId={objectId} enabled={statsExpanded} />
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  );
}
