import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@app/providers/queryClient';
import { useIsAdmin } from '@shared/auth/useIsAdmin';
import {
  createDescriptiveMetadataSchema,
  getDescriptiveMetadataJsonSchema,
  getDescriptiveMetadataSchemas,
  listIntellectualEntityTypes,
  updateDescriptiveMetadataSchemaActive,
} from '@shared/api';
import { JsonSchemaFieldsTable, JsonSchemaViewer } from '@shared/ui';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';

type JsonSchemaLike = {
  title?: string;
  description?: string;
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
};


function prettyDate(input?: string): string {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString();
}

function schemaListTitle(schema: unknown): string | null {
  if (!schema || typeof schema !== 'object') return null;
  const title = (schema as { title?: unknown }).title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
type FieldRow = {
  id: string;
  name: string;
  title: string;
  description: string;
  type: FieldType;
  format: string;
  required: boolean;
  // object: properties
  children?: FieldRow[];
  // array: schema of items
  arrayItem?: FieldRow;
};

function indentSx(level: number) {
  return { pl: level * 3 };
}

function nestedRowSx(level: number) {
  if (level <= 0) return undefined;
  return {
    // subtle hierarchy hint
    backgroundColor: 'action.hover',
    // left guide line (tree feel)
    '& td:first-of-type': {
      position: 'relative',
    },
    '& td:first-of-type::before': {
      content: '""',
      position: 'absolute',
      left: 22,
      top: 0,
      bottom: 0,
      width: '1px',
      bgcolor: 'divider',
      opacity: 0.7,
    },
  };
}


function ensureArrayItem(row: FieldRow): FieldRow {
  if (row.type !== 'array') return row;
  return { ...row, arrayItem: row.arrayItem ?? createEmptyRow() };
}

function ensureObjectChildren(row: FieldRow): FieldRow {
  if (row.type !== 'object') return row;
  return { ...row, children: row.children && row.children.length ? row.children : [createEmptyRow()] };
}

function removeRowById(rows: FieldRow[], id: string): FieldRow[] {
  const filtered = rows.filter((r) => r.id !== id).map((r) => {
    if (r.children) {
      const nextChildren = removeRowById(r.children, id);
      if (nextChildren !== r.children) return { ...r, children: nextChildren };
    }
    if (r.arrayItem) {
      if (r.arrayItem.id === id) {
        // Keep array item row, but reset it.
        return { ...r, arrayItem: createEmptyRow() };
      }
      const nextItemArr = removeRowById([r.arrayItem], id);
      if (nextItemArr[0] !== r.arrayItem) return { ...r, arrayItem: nextItemArr[0] };
    }
    return r;
  });

  return filtered;
}

function createEmptyRow(): FieldRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    title: '',
    description: '',
    type: 'string',
    format: '',
    required: false,
  };
}

function createEmptyObjectRow(): FieldRow {
  return { ...createEmptyRow(), type: 'object', children: [createEmptyRow()] };
}

function createEmptyArrayRow(): FieldRow {
  return { ...createEmptyRow(), type: 'array', arrayItem: createEmptyRow() };
}

function fieldRowToSchema(row: FieldRow): JsonSchemaLike {
  const base: JsonSchemaLike = {
    type: row.type,
    title: row.title.trim() || undefined,
    description: row.description.trim() || undefined,
  };

  const fmt = row.format.trim();
  if (fmt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (base as any).format = fmt;
  }

  if (row.type === 'object') {
    const obj = buildSchemaFromRows({ rows: row.children ?? [], title: base.title, description: base.description });
    return obj;
  }

  if (row.type === 'array') {
    const item = row.arrayItem;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (base as any).items = item ? fieldRowToSchema(item) : { type: 'string' };
    return base;
  }

  return base;
}

function findRowById(rows: FieldRow[], id: string): FieldRow | null {
  for (const r of rows) {
    if (r.id === id) return r;
    if (r.children) {
      const found = findRowById(r.children, id);
      if (found) return found;
    }
    if (r.arrayItem) {
      const found = findRowById([r.arrayItem], id);
      if (found) return found;
    }
  }
  return null;
}

function updateRowById(rows: FieldRow[], id: string, updater: (row: FieldRow) => FieldRow): FieldRow[] {
  return rows.map((r) => {
    if (r.id === id) return updater(r);
    if (r.children) {
      const nextChildren = updateRowById(r.children, id, updater);
      if (nextChildren !== r.children) return { ...r, children: nextChildren };
    }
    if (r.arrayItem) {
      const nextItemArr = updateRowById([r.arrayItem], id, updater);
      if (nextItemArr[0] !== r.arrayItem) return { ...r, arrayItem: nextItemArr[0] };
    }
    return r;
  });
}

function buildSchemaFromRows(params: { rows: FieldRow[]; title?: string; description?: string }): JsonSchemaLike {
  const { rows, title, description } = params;
  const properties: Record<string, JsonSchemaLike> = {};
  const required: string[] = [];

  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    properties[name] = fieldRowToSchema(r);
    if (r.required) required.push(name);
  }

  return {
    type: 'object',
    title: title?.trim() || undefined,
    description: description?.trim() || undefined,
    properties,
    required: required.length ? required : undefined,
  };
}

export function DescriptiveMetadataSchemasPage() {
  const isAdmin = useIsAdmin();
  const debug = isDebugEnabled();
  const [entityTypeName, setEntityTypeName] = useState<string>('');
  const effectiveEntityTypeName = entityTypeName.trim();

  const [viewTab, setViewTab] = useState<'fields' | 'schema'>('fields');

  const [createMode, setCreateMode] = useState<'table' | 'json'>('table');
  const [schemaTitleDraft, setSchemaTitleDraft] = useState<string>('');
  const [schemaDescriptionDraft, setSchemaDescriptionDraft] = useState<string>('');
  const [schemaJsonDraft, setSchemaJsonDraft] = useState<string>('');
  const [rows, setRows] = useState<FieldRow[]>(() => [createEmptyRow()]);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [nestedEditor, setNestedEditor] = useState<{ open: boolean; rowId?: string }>({ open: false });
  const [error, setError] = useState<string | null>(null);

  const generatedSchema = useMemo(() => {
    return buildSchemaFromRows({ rows, title: schemaTitleDraft, description: schemaDescriptionDraft });
  }, [rows, schemaTitleDraft, schemaDescriptionDraft]);

  const generatedSchemaJson = useMemo(() => {
    try {
      return JSON.stringify(generatedSchema, null, 2);
    } catch {
      return '';
    }
  }, [generatedSchema]);

  const entityTypesQuery = useQuery({
    queryKey: ['intellectual-entity-types', 'list'],
    queryFn: () => listIntellectualEntityTypes(),
    staleTime: 60_000,
  });
  const entityTypes = entityTypesQuery.data ?? [];

  const schemasQuery = useQuery({
    queryKey: ['descriptive-metadata', 'schemas', { entityTypeName: effectiveEntityTypeName }],
    queryFn: () => getDescriptiveMetadataSchemas({ entityType: effectiveEntityTypeName }),
    enabled: Boolean(effectiveEntityTypeName),
    staleTime: 10_000,
  });

  const schemas = useMemo(() => {
    const arr = schemasQuery.data ?? [];
    return [...arr].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [schemasQuery.data]);

  const activeSchemaId = schemas.find((s) => s.active)?.id;
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');
  const effectiveSelectedSchemaId = selectedSchemaId || activeSchemaId || schemas[0]?.id || '';

  const [schemaTitlesById, setSchemaTitlesById] = useState<Record<string, string>>({});

  // Summary DTO doesn't include schema title, so we fetch JSON Schema and read `title`.
  // This is a lightweight background load; results are cached in local state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Avoid synchronous setState directly in effect body (rule: react-hooks/set-state-in-effect).
      await Promise.resolve();

      if (!schemas.length) {
        if (!cancelled) setSchemaTitlesById({});
        return;
      }

      const entries = await Promise.all(
        schemas.map(async (s) => {
          const id = String(s.id);
          try {
            const json = await queryClient.fetchQuery({
              queryKey: ['descriptive-metadata', 'schema-json', id],
              queryFn: () => getDescriptiveMetadataJsonSchema(id),
              staleTime: 60_000,
            });
            const t = schemaListTitle(json);
            return t ? ([id, t] as const) : null;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const e of entries) {
        if (!e) continue;
        next[e[0]] = e[1];
      }
      setSchemaTitlesById(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [schemas]);

  const jsonSchemaQuery = useQuery({
    queryKey: ['descriptive-metadata', 'schema-json', effectiveSelectedSchemaId],
    queryFn: async () => {
      if (!effectiveSelectedSchemaId) return null;
      return getDescriptiveMetadataJsonSchema(effectiveSelectedSchemaId);
    },
    enabled: Boolean(effectiveSelectedSchemaId),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: { entityTypeName: string; schemaJson: string }) => createDescriptiveMetadataSchema(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['descriptive-metadata', 'schemas'] });
      setSchemaTitleDraft('');
      setSchemaDescriptionDraft('');
      setSchemaJsonDraft('');
      setRows([createEmptyRow()]);
    },
  });

  function toggleExpanded(id: string) {
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function isExpanded(id: string) {
    return Boolean(expandedRowIds[id]);
  }

  function renderFieldRow(row: FieldRow, level: number, opts?: { isArrayItem?: boolean }) {
    const isArrayItem = Boolean(opts?.isArrayItem);
    const canExpand = row.type === 'object' || row.type === 'array';
    const expanded = canExpand ? isExpanded(row.id) : false;

    return (
      <TableRow key={row.id} hover sx={nestedRowSx(level)}>
        <TableCell sx={{ width: 44 }}>
          <Box sx={indentSx(level)}>
            {canExpand ? (
              <IconButton
                size="small"
                aria-label={expanded ? 'collapse-row' : 'expand-row'}
                onClick={() => toggleExpanded(row.id)}
                disabled={isCreating}
              >
                {expanded ? <KeyboardArrowDownIcon fontSize="inherit" /> : <KeyboardArrowRightIcon fontSize="inherit" />}
              </IconButton>
            ) : null}
          </Box>
        </TableCell>

        <TableCell sx={{ width: '18%', minWidth: 0 }}>
          <TextField
            value={row.name}
            onChange={(e) => setRows((prev) => updateRowById(prev, row.id, (r) => ({ ...r, name: e.target.value })))}
            size="small"
            placeholder={isArrayItem ? 'items' : 'название'}
            fullWidth
            disabled={isCreating || isArrayItem}
          />
        </TableCell>

        <TableCell sx={{ width: '18%', minWidth: 0 }}>
          <TextField
            value={row.title}
            onChange={(e) => setRows((prev) => updateRowById(prev, row.id, (r) => ({ ...r, title: e.target.value })))}
            size="small"
            placeholder="заголовок"
            fullWidth
            disabled={isCreating}
          />
        </TableCell>

        <TableCell sx={{ width: '32%', minWidth: 0 }}>
          <TextField
            value={row.description}
            onChange={(e) => setRows((prev) => updateRowById(prev, row.id, (r) => ({ ...r, description: e.target.value })))}
            size="small"
            placeholder="описание"
            fullWidth
            disabled={isCreating}
          />
        </TableCell>

        <TableCell sx={{ width: 140, minWidth: 0 }}>
          <Select
            size="small"
            fullWidth
            value={row.type}
            disabled={isCreating}
            onChange={(e) => {
              const nextType = e.target.value as FieldType;
              setRows((prev) =>
                updateRowById(prev, row.id, (x) => {
                  if (nextType === 'object') return ensureObjectChildren({ ...x, type: nextType, arrayItem: undefined });
                  if (nextType === 'array') return ensureArrayItem({ ...x, type: nextType, children: undefined });
                  return { ...x, type: nextType, children: undefined, arrayItem: undefined };
                }),
              );
            }}
          >
            {(['string', 'number', 'integer', 'boolean', 'object', 'array'] as FieldType[]).map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </TableCell>

        <TableCell sx={{ width: 140, minWidth: 0 }}>
          <TextField
            value={row.format}
            onChange={(e) => setRows((prev) => updateRowById(prev, row.id, (r) => ({ ...r, format: e.target.value })))}
            size="small"
            placeholder="формат"
            fullWidth
            disabled={isCreating}
          />
        </TableCell>

        <TableCell sx={{ width: 140, minWidth: 0 }}>
          {isArrayItem ? (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Checkbox
                checked={row.required}
                disabled={isCreating}
                onChange={(e) => setRows((prev) => updateRowById(prev, row.id, (r) => ({ ...r, required: e.target.checked })))}
              />
              <Typography variant="caption" color="text.secondary">
                {row.required ? 'Да' : 'Нет'}
              </Typography>
            </Stack>
          )}
        </TableCell>

        <TableCell sx={{ width: 44 }}>
          <IconButton
            size="small"
            aria-label="delete-row"
            disabled={isCreating || isArrayItem}
            onClick={() => setRows((prev) => removeRowById(prev, row.id))}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  }

  function renderRowsRecursive(list: FieldRow[], level: number): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    for (const r of list) {
      const expanded = isExpanded(r.id);
      const hasNested = r.type === 'object' || r.type === 'array';

      out.push(renderFieldRow(r, level));

      if (!hasNested) continue;

      if (!expanded) continue;

      if (r.type === 'object') {
        out.push(...renderRowsRecursive(r.children ?? [], level + 1));
        // Add-row button for object children (in same table)
        out.push(
          <TableRow key={`${r.id}__add-child`}>
            <TableCell sx={{ width: 44 }} />
            <TableCell colSpan={7}>
              <Box sx={indentSx(level + 1)}>
                <Button
                  variant="text"
                  size="small"
                  disabled={isCreating}
                  onClick={() =>
                    setRows((prev) =>
                      updateRowById(prev, r.id, (x) => {
                        const obj = ensureObjectChildren(x);
                        return { ...obj, children: [...(obj.children ?? []), createEmptyRow()] };
                      }),
                    )
                  }
                >
                  Добавить поле объекту
                </Button>
              </Box>
            </TableCell>
          </TableRow>,
        );
      }

      if (r.type === 'array') {
        const item = r.arrayItem ?? createEmptyRow();
        const itemRow: FieldRow = { ...item, name: 'items' };
        out.push(renderFieldRow(itemRow, level + 1, { isArrayItem: true }));

        if ((itemRow.type === 'object' || itemRow.type === 'array') && isExpanded(itemRow.id)) {
          out.push(...renderRowsRecursive(itemRow.children ?? [], level + 2));
        }
      }
    }
    return out;
  }

  const activateMutation = useMutation({
    mutationFn: (params: { schemaId: string; active: boolean }) =>
      updateDescriptiveMetadataSchemaActive(params.schemaId, { active: params.active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['descriptive-metadata', 'schemas'] });
    },
  });

  const isCreating = createMutation.isPending;
  const isActivating = activateMutation.isPending;

  async function handleCreate() {
    if (!isAdmin) return;
    setError(null);
    if (!effectiveEntityTypeName) {
      setError('Выберите entityType');
      return;
    }

    const raw = (createMode === 'table' ? generatedSchemaJson : schemaJsonDraft).trim();
    if (!raw) {
      setError('schemaJson обязателен');
      return;
    }

    try {
      // Validate JSON early to show readable errors.
      JSON.parse(raw);
    } catch {
      setError('schemaJson должен быть валидным JSON');
      return;
    }

    try {
      await createMutation.mutateAsync({ entityTypeName: effectiveEntityTypeName, schemaJson: raw });
    } catch (e) {
      const ue = toUserFacingError(e);
      setError(`${ue.title}${ue.description ? `: ${ue.description}` : ''}${debug && e instanceof Error ? ` (debug: ${e.message})` : ''}`);
    }
  }

  async function handleSetActive(schemaId: string, nextActive: boolean) {
    if (!isAdmin) return;
    setError(null);
    try {
      await activateMutation.mutateAsync({ schemaId, active: nextActive });
    } catch (e) {
      const ue = toUserFacingError(e);
      setError(`${ue.title}${ue.description ? `: ${ue.description}` : ''}${debug && e instanceof Error ? ` (debug: ${e.message})` : ''}`);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5">Схемы descriptive-metadata</Typography>
          <Typography variant="body2" color="text.secondary">
            Управление схемами описательных метаданных для типов объектов депонирования.
          </Typography>
        </Box>

        {!isAdmin && (
          <Alert severity="info">
            У вас нет прав администратора — доступен только просмотр.
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Фильтр</Typography>

              {entityTypesQuery.isLoading && <Alert severity="info">Загружаю типы…</Alert>}
              {entityTypesQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const ue = toUserFacingError(entityTypesQuery.error);
                    return (
                      <>
                        {ue.title}{ue.description ? `: ${ue.description}` : ''}
                        {debug && entityTypesQuery.error instanceof Error ? ` (debug: ${entityTypesQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              <FormControl fullWidth size="small" disabled={entityTypesQuery.isLoading || entityTypesQuery.isError}>
                <InputLabel id="entityTypeName-label">Тип</InputLabel>
                <Select
                  labelId="entityTypeName-label"
                  label="Тип"
                  value={effectiveEntityTypeName}
                  onChange={(e) => {
                    setEntityTypeName(String(e.target.value));
                    setSelectedSchemaId('');
                  }}
                >
                  {entityTypes.map((t) => (
                    <MenuItem key={t.id} value={t.name}>
                      {t.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Список схем</Typography>

              {!effectiveEntityTypeName && <Alert severity="info">Выберите тип, чтобы загрузить схемы.</Alert>}

              {schemasQuery.isLoading && effectiveEntityTypeName && <Alert severity="info">Загружаю схемы…</Alert>}
              {schemasQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const ue = toUserFacingError(schemasQuery.error);
                    return (
                      <>
                        {ue.title}{ue.description ? `: ${ue.description}` : ''}
                        {debug && schemasQuery.error instanceof Error ? ` (debug: ${schemasQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              {schemasQuery.isSuccess && schemas.length === 0 && (
                <Alert severity="warning">Для этого типа схем пока нет.</Alert>
              )}

              {schemas.length > 0 && (
                <>
                  <List dense disablePadding>
                    {schemas.map((s) => (
                      <ListItem
                        key={s.id}
                        divider
                        disableGutters
                        secondaryAction={
                          isAdmin ? (
                            <Button
                              size="small"
                              variant={s.active ? 'contained' : 'outlined'}
                              disabled={isActivating}
                              onClick={() => void handleSetActive(String(s.id), !s.active)}
                            >
                              {s.active ? 'Сделать неактивной' : 'Сделать активной'}
                            </Button>
                          ) : null
                        }
                      >
                        <ListItemButton
                          selected={String(s.id) === String(effectiveSelectedSchemaId)}
                          onClick={() => setSelectedSchemaId(String(s.id))}
                          sx={{
                            // leave space for secondaryAction button
                            pr: isAdmin ? 16 : 2,
                            borderRadius: 1,
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {schemaTitlesById[String(s.id)] ?? `Схема • ${prettyDate(s.createdAt)}`}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {s.active ? 'Активная' : 'Неактивная'}
                                {' • '}
                                Создана: {prettyDate(s.createdAt)}
                                {debug ? ` • id: ${s.id}` : ''}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Просмотр JSON Schema</Typography>

              {!effectiveSelectedSchemaId && <Alert severity="info">Выберите схему.</Alert>}
              {jsonSchemaQuery.isLoading && effectiveSelectedSchemaId && <Alert severity="info">Загружаю JSON…</Alert>}
              {jsonSchemaQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const ue = toUserFacingError(jsonSchemaQuery.error);
                    return (
                      <>
                        {ue.title}{ue.description ? `: ${ue.description}` : ''}
                        {debug && jsonSchemaQuery.error instanceof Error ? ` (debug: ${jsonSchemaQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              {jsonSchemaQuery.data && (
                <>
                  <Tabs
                    value={viewTab}
                    onChange={(_, v) => setViewTab(v)}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Tab value="fields" label="Поля" />
                    <Tab value="schema" label="JSON Schema" />
                  </Tabs>

                  {viewTab === 'fields' && (
                    (() => {
                      return (
                        <JsonSchemaFieldsTable schema={jsonSchemaQuery.data} />
                      );
                    })()
                  )}

                  {viewTab === 'schema' && (
                    <JsonSchemaViewer value={jsonSchemaQuery.data as object} collapsed={1} />
                  )}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Создать новую схему</Typography>
                <Typography variant="caption" color="text.secondary">
                  Вставьте JSON Schema и создайте новую версию схемы для выбранного типа.
                </Typography>

                <Divider />

                <Tabs
                  value={createMode}
                  onChange={(_, v) => setCreateMode(v)}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Tab value="table" label="Таблица" />
                  <Tab value="json" label="JSON" />
                </Tabs>

                {createMode === 'table' && (
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        label="Название схемы (опционально)"
                        value={schemaTitleDraft}
                        onChange={(e) => setSchemaTitleDraft(e.target.value)}
                        fullWidth
                        size="small"
                        disabled={isCreating}
                      />
                      <TextField
                        label="Описание схемы (опционально)"
                        value={schemaDescriptionDraft}
                        onChange={(e) => setSchemaDescriptionDraft(e.target.value)}
                        fullWidth
                        size="small"
                        disabled={isCreating}
                      />
                    </Stack>

                    <TableContainer
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        width: '100%',
                        overflowX: 'hidden',
                      }}
                    >
                      <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 44 }} />
                            <TableCell sx={{ fontWeight: 700 }}>Поле</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Название</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Описание</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 140 }}>Тип</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 140 }}>Format</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 120 }}>Required</TableCell>
                            <TableCell sx={{ width: 44 }} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {renderRowsRecursive(rows, 0)}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Box>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={isCreating}
                        onClick={() =>
                          setRows((prev) => [...prev, createEmptyRow()])
                        }
                      >
                        Добавить поле
                      </Button>
                      <Button variant="text" size="small" disabled={isCreating} onClick={() => setRows((p) => [...p, createEmptyObjectRow()])}>
                        + объект
                      </Button>
                      <Button variant="text" size="small" disabled={isCreating} onClick={() => setRows((p) => [...p, createEmptyArrayRow()])}>
                        + массив
                      </Button>
                    </Box>

                    <Stack spacing={0.75}>
                      <Typography variant="subtitle2">Предпросмотр</Typography>
                      <JsonSchemaViewer value={generatedSchema as unknown as object} collapsed={2} />
                    </Stack>
                  </Stack>
                )}

                <Dialog
                  open={nestedEditor.open}
                  onClose={() => setNestedEditor({ open: false })}
                  maxWidth="md"
                  fullWidth
                >
                  {(() => {
                    if (!nestedEditor.open || !nestedEditor.rowId) return null;
                    const row = findRowById(rows, nestedEditor.rowId);
                    if (!row) return null;

                    const title = row.type === 'object'
                      ? (row.name.trim() ? `Поля объекта: ${row.name.trim()}` : 'Поля объекта')
                      : row.type === 'array'
                        ? (row.name.trim() ? `Элемент массива: ${row.name.trim()}` : 'Элемент массива')
                        : 'Настройка';

                    return (
                      <>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogContent dividers>
                          {row.type === 'object' && (
                            <Stack spacing={1.25}>
                              <Typography variant="body2" color="text.secondary">
                                Добавьте вложенные поля объекта.
                              </Typography>
                              <TableContainer
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 2,
                                  width: '100%',
                                  overflowX: 'hidden',
                                }}
                              >
                                <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ width: 44 }} />
                                      <TableCell sx={{ fontWeight: 700 }}>Поле</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Название</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Описание</TableCell>
                                      <TableCell sx={{ fontWeight: 700, width: 140 }}>Тип</TableCell>
                                      <TableCell sx={{ fontWeight: 700, width: 140 }}>Format</TableCell>
                                      <TableCell sx={{ fontWeight: 700, width: 120 }}>Required</TableCell>
                                      <TableCell sx={{ width: 44 }} />
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {(row.children && row.children.length ? row.children : [createEmptyRow()]).map((c) => (
                                      <TableRow key={c.id} hover>
                                        <TableCell sx={{ width: '18%', minWidth: 0 }}>
                                          <TextField
                                            value={c.name}
                                            onChange={(e) =>
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).map((x) =>
                                                    x.id === c.id ? { ...x, name: e.target.value } : x,
                                                  ),
                                                })),
                                              )
                                            }
                                            size="small"
                                            fullWidth
                                          />
                                        </TableCell>
                                        <TableCell sx={{ width: '18%', minWidth: 0 }}>
                                          <TextField
                                            value={c.title}
                                            onChange={(e) =>
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).map((x) =>
                                                    x.id === c.id ? { ...x, title: e.target.value } : x,
                                                  ),
                                                })),
                                              )
                                            }
                                            size="small"
                                            fullWidth
                                          />
                                        </TableCell>
                                        <TableCell sx={{ width: '32%', minWidth: 0 }}>
                                          <TextField
                                            value={c.description}
                                            onChange={(e) =>
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).map((x) =>
                                                    x.id === c.id ? { ...x, description: e.target.value } : x,
                                                  ),
                                                })),
                                              )
                                            }
                                            size="small"
                                            fullWidth
                                          />
                                        </TableCell>
                                        <TableCell sx={{ width: 140, minWidth: 0 }}>
                                          <Select
                                            size="small"
                                            fullWidth
                                            value={c.type}
                                            onChange={(e) => {
                                              const nextType = e.target.value as FieldType;
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).map((x) => {
                                                    if (x.id !== c.id) return x;
                                                    if (nextType === 'object') return { ...x, type: nextType, children: x.children ?? [createEmptyRow()], arrayItem: undefined };
                                                    if (nextType === 'array') return { ...x, type: nextType, arrayItem: x.arrayItem ?? createEmptyRow(), children: undefined };
                                                    return { ...x, type: nextType, children: undefined, arrayItem: undefined };
                                                  }),
                                                })),
                                              );
                                            }}
                                          >
                                            {(['string', 'number', 'integer', 'boolean', 'object', 'array'] as FieldType[]).map((t) => (
                                              <MenuItem key={t} value={t}>
                                                {t}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </TableCell>
                                        <TableCell sx={{ width: 140, minWidth: 0 }}>
                                          <TextField
                                            value={c.format}
                                            onChange={(e) =>
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).map((x) =>
                                                    x.id === c.id ? { ...x, format: e.target.value } : x,
                                                  ),
                                                })),
                                              )
                                            }
                                            size="small"
                                            fullWidth
                                          />
                                        </TableCell>
                                        <TableCell sx={{ width: 140, minWidth: 0 }}>
                                          <Checkbox
                                            checked={c.required}
                                            onChange={(e) =>
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).map((x) =>
                                                    x.id === c.id ? { ...x, required: e.target.checked } : x,
                                                  ),
                                                })),
                                              )
                                            }
                                          />
                                        </TableCell>
                                        <TableCell sx={{ width: 44 }}>
                                          <IconButton
                                            size="small"
                                            disabled={Boolean(row.children && row.children.length <= 1)}
                                            onClick={() =>
                                              setRows((prev) =>
                                                updateRowById(prev, row.id, (r) => ({
                                                  ...r,
                                                  children: (r.children && r.children.length ? r.children : [createEmptyRow()]).filter((x) => x.id !== c.id),
                                                })),
                                              )
                                            }
                                          >
                                            <DeleteIcon fontSize="inherit" />
                                          </IconButton>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              <Box>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() =>
                                    setRows((prev) =>
                                      updateRowById(prev, row.id, (r) => ({
                                        ...r,
                                        children: [...(r.children && r.children.length ? r.children : [createEmptyRow()]), createEmptyRow()],
                                      })),
                                    )
                                  }
                                >
                                  Добавить поле
                                </Button>
                              </Box>
                            </Stack>
                          )}

                          {row.type === 'array' && (
                            <Stack spacing={1.25}>
                              <Typography variant="body2" color="text.secondary">
                                Настройте элемент массива. Для объекта-элемента можно добавлять поля.
                              </Typography>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id="array-item-type">Тип элемента</InputLabel>
                                  <Select
                                    labelId="array-item-type"
                                    label="Тип элемента"
                                    value={(row.arrayItem ?? createEmptyRow()).type}
                                    onChange={(e) => {
                                      const nextType = e.target.value as FieldType;
                                      setRows((prev) =>
                                        updateRowById(prev, row.id, (r) => {
                                          const item = r.arrayItem ?? createEmptyRow();
                                          if (nextType === 'object') return { ...r, arrayItem: { ...item, type: nextType, children: item.children ?? [createEmptyRow()], arrayItem: undefined } };
                                          if (nextType === 'array') return { ...r, arrayItem: { ...item, type: nextType, arrayItem: item.arrayItem ?? createEmptyRow(), children: undefined } };
                                          return { ...r, arrayItem: { ...item, type: nextType, children: undefined, arrayItem: undefined } };
                                        }),
                                      );
                                    }}
                                  >
                                    {(['string', 'number', 'integer', 'boolean', 'object', 'array'] as FieldType[]).map((t) => (
                                      <MenuItem key={t} value={t}>
                                        {t}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>

                                <TextField
                                  label="Format"
                                  size="small"
                                  fullWidth
                                  value={row.arrayItem?.format ?? ''}
                                  onChange={(e) =>
                                    setRows((prev) =>
                                      updateRowById(prev, row.id, (r) => ({
                                        ...r,
                                        arrayItem: { ...(r.arrayItem ?? createEmptyRow()), format: e.target.value },
                                      })),
                                    )
                                  }
                                />
                              </Stack>

                              {row.arrayItem?.type === 'object' && (
                                <Alert severity="info" sx={{ mb: 0 }}>
                                  Для object-элемента массивов поля редактируются так же, как у обычного object: откройте «Настройка» уже у вложенного поля в таблице объекта.
                                </Alert>
                              )}
                            </Stack>
                          )}
                        </DialogContent>
                        <DialogActions>
                          <Button variant="outlined" onClick={() => setNestedEditor({ open: false })}>
                            Закрыть
                          </Button>
                        </DialogActions>
                      </>
                    );
                  })()}
                </Dialog>

                {createMode === 'json' && (
                  <TextField
                    label="schemaJson (JSON)"
                    placeholder={'{\n  "type": "object",\n  ...\n}'}
                    value={schemaJsonDraft}
                    onChange={(e) => setSchemaJsonDraft(e.target.value)}
                    fullWidth
                    multiline
                    minRows={10}
                    size="small"
                    disabled={isCreating}
                  />
                )}

                <Button variant="contained" disabled={isCreating || !effectiveEntityTypeName} onClick={() => void handleCreate()}>
                  Создать
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
