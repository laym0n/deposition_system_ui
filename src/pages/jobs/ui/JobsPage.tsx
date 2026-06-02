import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Pagination,
  Select,
  MenuItem as SelectItem,
  FormControl,
  InputLabel,
  Stack,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { DepositionJobListItem } from '@shared/api';
import { listIntellectualEntityTypes, listMyDeponeJobs, submitDeponeJob } from '@shared/api';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';

function maskId(id: string, left = 8, right = 6) {
  const v = String(id ?? '');
  if (v.length <= left + right + 3) return v;
  return `${v.slice(0, left)}…${v.slice(-right)}`;
}

function statusLabel(status: DepositionJobListItem['status']): string {
  switch (status) {
    case 'UPLOADING':
      return 'Загрузка файлов';
    case 'PROCESSING':
      return 'Обработка';
    case 'COMPLETED':
      return 'Готово';
    case 'FAILED':
      return 'Ошибка';
    case 'CANCELLED':
      return 'Отменено';
    default:
      return status;
  }
}

function statusColor(status: DepositionJobListItem['status']): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'PROCESSING':
      return 'info';
    case 'UPLOADING':
      return 'warning';
    case 'CANCELLED':
      return 'default';
    default:
      return 'default';
  }
}

export function JobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const debug = isDebugEnabled();

  // Server-side pagination
  const [page, setPage] = useState(1); // UI is 1-based
  const [pageSize, setPageSize] = useState(10);
  const [retryError, setRetryError] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['depone', 'jobs', 'me', { page, pageSize }],
    queryFn: () => listMyDeponeJobs({ page: page - 1, size: pageSize }),
    staleTime: 5_000,
    placeholderData: keepPreviousData,
  });

  const entityTypesQuery = useQuery({
    queryKey: ['intellectual-entity-types', 'list'],
    queryFn: () => listIntellectualEntityTypes(),
    staleTime: 60_000,
  });

  const retrySubmitMutation = useMutation({
    mutationFn: async (jobId: string) => submitDeponeJob(jobId),
    onMutate: () => {
      setRetryError(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['depone', 'jobs', 'me'] });
    },
    onError: (error) => {
      const e = toUserFacingError(error);
      setRetryError(`${e.title}${e.description ? `: ${e.description}` : ''}${debug && error instanceof Error ? ` (debug: ${error.message})` : ''}`);
    },
  });

  const entityTypeDescriptionByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of entityTypesQuery.data ?? []) {
      if (!t?.name) continue;
      const label = (t.description ?? '').trim() || t.name;
      m.set(t.name, label);
    }
    return m;
  }, [entityTypesQuery.data]);

  const jobs = useMemo(() => {
    const list = jobsQuery.data?.items ?? [];
    // newest first
    return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [jobsQuery.data]);

  const totalItems = Number(jobsQuery.data?.totalItems ?? 0);
  const pagesCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageSafe = Math.min(page, pagesCount);

  function isObjectPageAvailable(status: DepositionJobListItem['status']) {
    return status === 'COMPLETED';
  }

  function canRetry(status: DepositionJobListItem['status']) {
    return status === 'FAILED' || status === 'CANCELLED';
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5">Мои депонирования</Typography>
          <Typography variant="body2" color="text.secondary">
            История ваших депонирований. Успешные записи можно открыть как объект, а неуспешные — отправить на повторную обработку.
          </Typography>
        </Box>

        {retryError && <Alert severity="error">{retryError}</Alert>}

        {jobsQuery.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {jobsQuery.isError && (
          <Alert severity="error">
            {(() => {
              const e = toUserFacingError(jobsQuery.error);
              return (
                <>
                  {e.title}{e.description ? `: ${e.description}` : ''}
                  {debug && jobsQuery.error instanceof Error ? ` (debug: ${jobsQuery.error.message})` : null}
                </>
              );
            })()}
          </Alert>
        )}

        {!jobsQuery.isLoading && !jobsQuery.isError && totalItems === 0 && (
          <Alert severity="info">Пока нет депонирований. Создайте депонирование на странице асинхронного депонирования.</Alert>
        )}

        {jobs.length > 0 && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Всего: {totalItems}
                  </Typography>

                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="jobs-page-size-label">На странице</InputLabel>
                    <Select
                      labelId="jobs-page-size-label"
                      value={pageSize}
                      label="На странице"
                      onChange={(e) => {
                        setPage(1);
                        setPageSize(Number(e.target.value));
                      }}
                    >
                      {[10, 20, 50].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <List dense disablePadding>
                  {jobs.map((job) => (
                    <ListItem key={job.jobId} divider disablePadding>
                      <ListItemButton
                        onClick={
                          isObjectPageAvailable(job.status)
                            ? () => {
                                void navigate({
                                  to: '/objects/$objectId',
                                  params: { objectId: job.objectId },
                                });
                              }
                            : undefined
                        }
                        sx={!isObjectPageAvailable(job.status) ? { cursor: 'default' } : undefined}
                      >
                        <ListItemText
                          primary={
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                            >
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {job.objectName?.trim() || 'Без названия'}
                                </Typography>
                                <Chip size="small" label={statusLabel(job.status)} color={statusColor(job.status)} />
                              </Stack>

                              {canRetry(job.status) && (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  disabled={retrySubmitMutation.isPending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRetryError(null);
                                    retrySubmitMutation.mutate(job.jobId);
                                  }}
                                >
                                  {retrySubmitMutation.isPending ? 'Отправка…' : 'Попробовать снова'}
                                </Button>
                              )}
                            </Stack>
                          }
                          secondary={
                            <Stack spacing={0.25}>
                              {(job.intellectualEntityTypeName || job.objectId) && (
                                <Typography variant="caption" color="text.secondary">
                                  {job.intellectualEntityTypeName
                                    ? (entityTypeDescriptionByName.get(job.intellectualEntityTypeName) ?? job.intellectualEntityTypeName)
                                    : 'Тип не указан'}
                                  {job.objectId ? ` • № ${maskId(job.objectId)}` : ''}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                Создано: {new Date(job.createdAt).toLocaleString()}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>

                {pagesCount > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                      page={pageSafe}
                      count={pagesCount}
                      onChange={(_, p) => setPage(p)}
                      disabled={jobsQuery.isFetching}
                    />
                  </Box>
                )}

                {jobsQuery.isFetching && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Обновляем список…
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
