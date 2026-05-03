import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemText,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { SearchObjectsResult } from '@shared/api';
import { searchObjects } from '@shared/api';
import { useAuth } from '@shared/auth/useAuth';

export function MainPage() {
  const auth = useAuth();

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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="h4">Система депонирования</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography color="text.secondary">Публичный поиск объектов</Typography>
            {!auth.isLoading && !auth.isAuthenticated && (
              <Typography
                component="button"
                onClick={() => void auth.login()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Войти
              </Typography>
            )}

            {!auth.isLoading && auth.isAuthenticated && (
              <Typography
                component="button"
                onClick={() => void auth.logout()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Выйти
              </Typography>
            )}
          </Box>
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
            Не удалось выполнить поиск.{' '}
            {searchQuery.error instanceof Error ? searchQuery.error.message : null}
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

            <List dense disablePadding>
              {hits.map((hit) => (
                <ListItem key={hit.objectId} divider>
                  <ListItemText
                    primary={hit.objectId}
                    secondary={hit.entityType ?? '—'}
                  />
                </ListItem>
              ))}
            </List>

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
