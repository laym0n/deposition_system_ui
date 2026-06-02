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
  Divider,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import SchemaIcon from '@mui/icons-material/Schema';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { SearchObjectsResult } from '@shared/api';
import { searchObjects } from '@shared/api';
import { useAuth } from '@shared/auth/useAuth';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';

export function MainPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const debug = isDebugEnabled();

  const [query, setQuery] = useState('');
  // "applied" query is the one we actually search by (only updates on Enter)
  const [appliedQuery, setAppliedQuery] = useState('');

  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const isSearchEnabled = appliedQuery.trim().length > 0;

  const searchQuery = useQuery({
    queryKey: ['objects', 'search', { q: appliedQuery, offset, limit }],
    queryFn: () =>
      searchObjects({
        searchQuery: appliedQuery.trim(),
        offset,
        limit,
      }),
    enabled: isSearchEnabled,
    staleTime: 10_000,
  });

  const data: SearchObjectsResult | undefined = searchQuery.data;
  const hits = data?.hits ?? [];
  const total = data?.total ?? 0;
  const pagesCount = useMemo(() => {
    if (!isSearchEnabled) return 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [isSearchEnabled, total]);

  const canUsePrivateFeatures = !auth.isLoading && auth.isAuthenticated;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="h4">Система депонирования</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Загрузите материалы на депонирование или найдите уже опубликованные объекты.
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Stack spacing={2}>
                <Typography variant="body1" sx={{ maxWidth: 720 }}>
                  В этой системе вы можете выполнить <b>депонирование интеллектуальной собственности</b>: загрузить
                  материалы, указать метаданные и получить результат обработки. Депонирование выполняется в фоне, а
                  статус можно отслеживать в истории.
                </Typography>

                {!canUsePrivateFeatures && !auth.isLoading && (
                  <Alert severity="info" sx={{ mb: 0 }}>
                    Чтобы запускать депонирование и смотреть историю, нужно войти.
                  </Alert>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Card
                    variant="outlined"
                    sx={{ flex: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                    onClick={() => void navigate({ to: '/deposition/async' })}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <AutoAwesomeIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Депонировать интеллектуальную собственность
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Запустите депонирование: загрузка материалов и отправка метаданных.
                        </Typography>
                        <Box>
                          <Button size="small" variant="contained" disabled={!canUsePrivateFeatures}>
                            Перейти
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card
                    variant="outlined"
                    sx={{ flex: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                    onClick={() => void navigate({ to: '/jobs' })}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <PlaylistAddCheckIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            История и статусы
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Посмотрите результаты ваших депонирований
                        </Typography>
                        <Box>
                          <Button size="small" variant="outlined" disabled={!canUsePrivateFeatures}>
                            Открыть историю
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card
                    variant="outlined"
                    sx={{ flex: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                    onClick={() => void navigate({ to: '/deposition/available' })}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <SchemaIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Типы объектов депонирования
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Ознакомьтесь с поддерживаемыми типами и требованиями к метаданным.
                        </Typography>
                        <Box>
                          <Button size="small" variant="text">
                            Посмотреть типы
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h6">Публичный поиск объектов</Typography>
                <Typography variant="body2" color="text.secondary">
                  Введите запрос и нажмите Enter, чтобы найти объект по метаданным.
                </Typography>
              </Box>

              <TextField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Введите запрос и нажмите Enter"
                label="Поиск"
                fullWidth
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const next = query.trim();
                  setAppliedQuery(next);
                  setPage(1);
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        {!isSearchEnabled && (
          <Alert severity="info">Введите поисковый запрос и нажмите Enter.</Alert>
        )}

        {searchQuery.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {searchQuery.isError && (
          <Alert severity="error">
            {(() => {
              const e = toUserFacingError(searchQuery.error);
              return (
                <>
                  {e.title}
                  {e.description ? `: ${e.description}` : ''}
                  {debug && searchQuery.error instanceof Error ? ` (debug: ${searchQuery.error.message})` : null}
                </>
              );
            })()}
          </Alert>
        )}

        {isSearchEnabled && !searchQuery.isLoading && !searchQuery.isError && hits.length === 0 && (
          <Alert severity="warning">Ничего не найдено.</Alert>
        )}

        {hits.length > 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Найдено: {total}
            </Typography>

            <Stack spacing={1.25}>
              {hits.map((hit) => (
                <Card
                  key={hit.objectId}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2,
                      transform: 'translateY(-1px)',
                    },
                    '&:focus-within': {
                      borderColor: 'primary.main',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() =>
                    void navigate({
                      to: '/objects/$objectId',
                      params: { objectId: hit.objectId },
                    })
                  }
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>
                          {hit.originalName ?? hit.objectId}
                        </Typography>

                        {hit.intellectualEntityType?.description || hit.intellectualEntityType?.name ? (
                          <Chip
                            size="small"
                            variant="filled"
                            label={hit.intellectualEntityType.description ?? hit.intellectualEntityType.name}
                            color="primary"
                            sx={{ flexShrink: 0 }}
                          />
                        ) : null}
                      </Stack>

                      {hit.intellectualEntityType?.name ? (
                        <Typography variant="body2" color="text.secondary">
                          {hit.intellectualEntityType.name}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Открыть карточку объекта
                        </Typography>
                      )}

                      <Typography variant="caption" color="text.secondary">
                        ID: {hit.objectId}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {pagesCount > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  page={page}
                  count={pagesCount}
                  color="primary"
                  onChange={(_, nextPage) => setPage(nextPage)}
                />
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
