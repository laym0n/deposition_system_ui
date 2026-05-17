import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createIntellectualEntityType,
  deleteIntellectualEntityType,
  listIntellectualEntityTypes,
  updateIntellectualEntityType,
} from '@shared/api';
import { queryClient } from '@app/providers/queryClient';
import { useIsAdmin } from '@shared/auth/useIsAdmin';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';

type FormState = {
  id?: string;
  name: string;
  description: string;
};

const EMPTY_FORM: FormState = { name: '', description: '' };

export function DepositionObjectTypesPage() {
  const isAdmin = useIsAdmin();
  const debug = isDebugEnabled();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });

  const listQuery = useQuery({
    queryKey: ['intellectual-entity-types', 'list'],
    queryFn: () => listIntellectualEntityTypes(),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const arr = listQuery.data ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? arr.filter((x) => {
          const name = String(x.name ?? '').toLowerCase();
          const desc = String(x.description ?? '').toLowerCase();
          return name.includes(q) || desc.includes(q);
        })
      : arr;
    return [...filtered].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
  }, [listQuery.data]);

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) => createIntellectualEntityType(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['intellectual-entity-types', 'list'] });
      setForm(EMPTY_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; body: { name: string; description?: string } }) =>
      updateIntellectualEntityType(params.id, params.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['intellectual-entity-types', 'list'] });
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteIntellectualEntityType(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['intellectual-entity-types', 'list'] });
      // Nothing else to do here; local state cleanup is handled in handleDelete.
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  function canSubmit() {
    if (!isAdmin) return false;
    if (isSaving) return false;
    if (!form.name.trim()) return false;
    return true;
  }

  async function handleSubmit() {
    setError(null);
    if (!isAdmin) return;
    if (!form.name.trim()) {
      setError('Название обязательно');
      return;
    }

    try {
      const body = { name: form.name.trim(), description: form.description.trim() || undefined };
      if (form.id) {
        await updateMutation.mutateAsync({ id: form.id, body });
      } else {
        await createMutation.mutateAsync(body);
      }
    } catch (e) {
      const ue = toUserFacingError(e);
      setError(`${ue.title}${ue.description ? `: ${ue.description}` : ''}${debug && e instanceof Error ? ` (debug: ${e.message})` : ''}`);
    }
  }

  async function handleDelete(id?: string) {
    if (!isAdmin) return;
    if (!id) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(id);
      if (form.id === id) setForm(EMPTY_FORM);
    } catch (e) {
      const ue = toUserFacingError(e);
      setError(`${ue.title}${ue.description ? `: ${ue.description}` : ''}${debug && e instanceof Error ? ` (debug: ${e.message})` : ''}`);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5">Типы объектов депонирования</Typography>
          <Typography variant="body2" color="text.secondary">
            Справочник типов интеллектуальной собственности. Редактирование доступно только администратору.
          </Typography>
        </Box>
        {isAdmin && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" href="/descriptive-metadata/schemas">
                Открыть
              </Button>
            }
          >
            Вам доступно управление схемами описательных метаданных для типов
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Список</Typography>

              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию или описанию"
                size="small"
                fullWidth
              />

              {listQuery.isLoading && <Alert severity="info">Загружаю типы…</Alert>}
              {listQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const ue = toUserFacingError(listQuery.error);
                    return (
                      <>
                        {ue.title}{ue.description ? `: ${ue.description}` : ''}
                        {debug && listQuery.error instanceof Error ? ` (debug: ${listQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
                <Alert severity="warning">Типов пока нет.</Alert>
              )}

              {items.length > 0 && (
                <List dense disablePadding>
                  {items.map((t) => (
                    <ListItem
                      key={t.id}
                      divider
                      disableGutters
                      secondaryAction={
                        isAdmin ? (
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              aria-label="edit"
                              onClick={() =>
                                setForm({
                                  id: t.id,
                                  name: t.name ?? '',
                                  description: t.description ?? '',
                                })
                              }
                            >
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label="delete"
                              color="error"
                              onClick={() => setDeleteDialog({ open: true, id: t.id, name: t.name ?? '' })}
                            >
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>
                        ) : null
                      }
                    >
                      <ListItemButton
                        onClick={() => {
                          if (!isAdmin) return;
                          setForm({ id: t.id, name: t.name ?? '', description: t.description ?? '' });
                        }}
                        disabled={!isAdmin}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {t.name}
                            </Typography>
                          }
                          secondary={t.description ? <Typography variant="caption">{t.description}</Typography> : null}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false })} maxWidth="xs" fullWidth>
          <DialogTitle>Удалить тип?</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2">
              Вы уверены, что хотите удалить тип <b>{deleteDialog.name || '—'}</b>?
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Это действие нельзя отменить.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setDeleteDialog({ open: false })} disabled={isDeleting}>
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={isDeleting}
              onClick={async () => {
                const id = deleteDialog.id;
                setDeleteDialog({ open: false });
                await handleDelete(id);
              }}
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>

        {isAdmin && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                  <Typography variant="subtitle1">{form.id ? 'Редактирование' : 'Создание'}</Typography>
                  <Box sx={{ flex: 1 }} />
                  {form.id && (
                    <Button variant="outlined" size="small" onClick={() => setForm(EMPTY_FORM)} disabled={isSaving || isDeleting}>
                      Отменить
                    </Button>
                  )}
                </Stack>

                <Divider />

                <TextField
                  label="Название"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  fullWidth
                  size="small"
                  disabled={isSaving || isDeleting}
                />
                <TextField
                  label="Описание"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  fullWidth
                  size="small"
                  disabled={isSaving || isDeleting}
                />

                <Button variant="contained" onClick={() => void handleSubmit()} disabled={!canSubmit()}>
                  {form.id ? 'Сохранить' : 'Создать'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
