import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@shared/api/generated/api-types';
import {
  createDeponeJob,
  getDescriptiveMetadataJsonSchema,
  getDescriptiveMetadataSchemas,
  listIntellectualEntityTypes,
  searchObjects,
  submitDeponeJob,
} from '@shared/api';
import type { JsonSchema } from '@shared/ui';
import { JsonSchemaForm } from '@shared/ui';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';

type CreateJobRequest = components['schemas']['CreateJobRequest'];
type CreateDepositionJobResult = components['schemas']['CreateDepositionJobResult'];
type PresignedUpload = components['schemas']['PresignedUpload'];
type Relationship = components['schemas']['Relationship'];
type ObjectSearchHit = components['schemas']['Hit'];

type RepresentationDraft = {
  id: string;
  originalName: string;
  files: File[];
};

type RelationshipDraft = {
  type: NonNullable<Relationship['type']>;
  subType: NonNullable<Relationship['subType']>;
  objectId: string;
  objectQuery: string;
  objectLabel: string;
};

const RELATIONSHIP_TYPE_OPTIONS: Array<NonNullable<Relationship['type']>> = [
  'DEPENDENCY',
  'DERIVATION',
  'LOGICAL',
  'REFERENCE',
  'REPLACEMENT',
  'STRUCTURAL',
];

const RELATIONSHIP_SUBTYPE_OPTIONS: Array<NonNullable<Relationship['subType']>> = [
  'HAS_PART',
  'INCLUDES',
  'IS_INCLUDED_IN',
  'IS_PART_OF',
  'IS_REPRESENTED_BY',
  'REPRESENTS',
  'OTHER',
];

type UploadProgress = {
  fileName: string;
  loaded: number;
  total?: number;
  status: 'PENDING' | 'UPLOADING' | 'DONE' | 'FAILED';
  error?: string;
};

function getObjectOptionLabel(option: Pick<ObjectSearchHit, 'objectId' | 'originalName'>): string {
  return option.originalName?.trim() || option.objectId;
}

function RelationshipObjectAutocomplete(props: {
  value: RelationshipDraft;
  disabled: boolean;
  onChange: (next: RelationshipDraft) => void;
}) {
  const { value, disabled, onChange } = props;

  const searchQuery = value.objectQuery.trim();
  const objectsQuery = useQuery({
    queryKey: ['objects', 'search', 'relationship-picker', { q: searchQuery }],
    queryFn: async () =>
      searchObjects({
        searchQuery,
        offset: 0,
        limit: 10,
      }),
    enabled: searchQuery.length >= 2,
    staleTime: 10_000,
  });

  const options = objectsQuery.data?.hits ?? [];
  const selectedValue =
    value.objectId || value.objectLabel
      ? {
          objectId: value.objectId,
          originalName: value.objectLabel || value.objectQuery || value.objectId,
        }
      : null;

  return (
    <Autocomplete
      options={options}
      value={selectedValue}
      inputValue={value.objectQuery}
      onInputChange={(_, nextInputValue, reason) => {
        if (reason === 'reset') return;

        onChange({
          ...value,
          objectQuery: nextInputValue,
          objectId: reason === 'input' ? '' : value.objectId,
          objectLabel: reason === 'input' ? '' : value.objectLabel,
        });
      }}
      onChange={(_, nextValue) => {
        onChange({
          ...value,
          objectId: nextValue?.objectId ?? '',
          objectLabel: nextValue ? getObjectOptionLabel(nextValue) : '',
          objectQuery: nextValue ? getObjectOptionLabel(nextValue) : '',
        });
      }}
      getOptionLabel={(option) => getObjectOptionLabel(option)}
      isOptionEqualToValue={(option, selected) => option.objectId === selected.objectId}
      loading={objectsQuery.isLoading}
      disabled={disabled}
      noOptionsText={searchQuery.length < 2 ? 'Введите минимум 2 символа' : 'Ничего не найдено'}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Связанный объект"
          size="small"
        />
      )}
      renderOption={(optionProps, option) => (
        <Box component="li" {...optionProps} key={option.objectId}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {getObjectOptionLabel(option)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {option.intellectualEntityType?.description ?? option.intellectualEntityType?.name ?? 'Объект'} • ID: {option.objectId}
            </Typography>
          </Stack>
        </Box>
      )}
      fullWidth
    />
  );
}

async function uploadToPresignedUrl(params: {
  file: File;
  presigned: PresignedUpload;
  onProgress?: (loaded: number, total?: number) => void;
}) {
  const { file, presigned, onProgress } = params;

  async function calcSha256Base64(inputFile: File): Promise<string> {
    const buf = await inputFile.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] ?? 0);
    return btoa(binary);
  }

  // fetch() has no progress events; using XHR to show upload progress.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presigned.uploadUrl, true);

    // requiredHeaders should be set exactly as backend returned (S3-compatible).
    const headers = { ...(presigned.requiredHeaders ?? {}) } as Record<string, string>;

    // If backend requires checksum header but provided a placeholder, compute it in browser.
    // NOTE: crypto.subtle is available only on secure contexts (https/localhost). Dev server is localhost.
    const checksumKey = Object.keys(headers).find((k) => k.toLowerCase() === 'x-amz-checksum-sha256');
    if (checksumKey) {
      const current = headers[checksumKey];
      if (!current || current.includes('<') || current.includes('BASE64_SHA256')) {
        // compute and overwrite
        void calcSha256Base64(file).then((val) => {
          headers[checksumKey] = val;
        });
      }
    }

    // set headers just before send to ensure checksum was computed (best-effort)
    const setHeaders = () => {
      Object.entries(headers).forEach(([k, v]) => {
        if (v) xhr.setRequestHeader(k, v);
      });
    };

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      if (e.lengthComputable) onProgress(e.loaded, e.total);
      else onProgress(e.loaded, undefined);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      reject(new Error(`Upload failed: HTTP ${xhr.status} ${xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    // If we need to compute checksum, do it explicitly before sending.
    (async () => {
      if (checksumKey) {
        const current = headers[checksumKey];
        if (!current || current.includes('<') || current.includes('BASE64_SHA256')) {
          headers[checksumKey] = await calcSha256Base64(file);
        }
      }

      setHeaders();
      xhr.send(file);
    })().catch((e) => reject(e));
  });
}

function basenameFromPath(s: string): string {
  // handles: "object/.../file.txt" and "s3://bucket/.../file.txt"
  const withoutSchema = s.includes('://') ? s.split('://').slice(1).join('://') : s;
  const parts = withoutSchema.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? s;
}

export function DepositionAsyncPage() {
  const debug = isDebugEnabled();
  const [entityTypeName, setEntityTypeName] = useState<string>('');
  const [premisOriginalName, setPremisOriginalName] = useState<string>('');
  const [premisIdentifiers, setPremisIdentifiers] = useState<Array<{ type: 'SYSTEM' | 'OTHER'; value: string }>>([]);
  const [relationships, setRelationships] = useState<RelationshipDraft[]>([]);
  const [descriptiveMetadataValue, setDescriptiveMetadataValue] = useState<Record<string, unknown>>({});
  const [representations, setRepresentations] = useState<RepresentationDraft[]>([
    { id: crypto.randomUUID(), originalName: 'representation-1', files: [] },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateDepositionJobResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [submitted, setSubmitted] = useState(false);

  const entityTypesQuery = useQuery({
    queryKey: ['intellectual-entity-types', 'list'],
    queryFn: () => listIntellectualEntityTypes(),
    staleTime: 60_000,
  });

  const entityTypes = entityTypesQuery.data ?? [];

  // Avoid setState in effects (lint rule react-hooks/set-state-in-effect).
  // Treat first loaded entity type as a default selection.
  const effectiveEntityTypeName = entityTypeName || entityTypes[0]?.name || '';

  const schemasQuery = useQuery({
    queryKey: ['descriptive-metadata', 'schemas', { entityTypeName: effectiveEntityTypeName, active: true }],
    queryFn: () => getDescriptiveMetadataSchemas({ entityType: effectiveEntityTypeName, active: true }),
    enabled: Boolean(effectiveEntityTypeName),
    staleTime: 60_000,
  });

  const activeSchemaId = schemasQuery.data?.[0]?.id;

  const schemaQuery = useQuery({
    queryKey: ['descriptive-metadata', 'schema', activeSchemaId],
    queryFn: async () => {
      if (!activeSchemaId) return null;
      return getDescriptiveMetadataJsonSchema(activeSchemaId);
    },
    enabled: Boolean(activeSchemaId),
    staleTime: 60_000,
  });

  const schema: JsonSchema | null = useMemo(() => {
    try {
      return (schemaQuery.data ?? null) as JsonSchema | null;
    } catch {
      return null;
    }
  }, [schemaQuery.data]);

  const allFiles = useMemo(() => representations.flatMap((r) => r.files), [representations]);

  const totalBytes = useMemo(() => allFiles.reduce((acc, f) => acc + f.size, 0), [allFiles]);
  const loadedBytes = useMemo(
    () => Object.values(uploadProgress).reduce((acc, p) => acc + (p.loaded ?? 0), 0),
    [uploadProgress],
  );

  const overallPct = useMemo(() => {
    if (totalBytes <= 0) return 0;
    return Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
  }, [loadedBytes, totalBytes]);

  async function handleStart() {
    setError(null);
    setResult(null);
    setSubmitted(false);

    const nonEmptyReps = representations.filter((r) => r.files.length > 0);
    if (nonEmptyReps.length === 0) {
      setError('Добавьте хотя бы одну репрезентацию с файлами.');
      return;
    }

    const finalEntityTypeName = effectiveEntityTypeName;
    if (!finalEntityTypeName.trim()) {
      setError('Не выбран тип интеллектуальной сущности (intellectualEntityTypeName).');
      return;
    }

    setIsSubmitting(true);
    try {
      const relationshipItems: NonNullable<CreateJobRequest['intellectualEntityMetadata']>['relationships'] = relationships
        .filter((item) => item.objectId.trim().length > 0)
        .map((item) => ({
          type: item.type,
          subType: item.subType,
          relatedObjects: [{ type: 'SYSTEM', value: item.objectId.trim() }],
        }));

      const intellectualEntityMetadata: CreateJobRequest['intellectualEntityMetadata'] = {
        originalName: premisOriginalName || nonEmptyReps[0]?.originalName || 'object',
        identifiers: premisIdentifiers
          .filter((x) => x.value.trim().length > 0)
          .map((x) => ({ type: x.type, value: x.value })),
        relationships: relationshipItems,
      };

      const body: CreateJobRequest = {
        intellectualEntityTypeName: finalEntityTypeName,
        intellectualEntityMetadata,
        descriptiveMetadata: JSON.stringify(descriptiveMetadataValue),
        representations: nonEmptyReps.map((r) => ({
          representationMetadata: { originalName: r.originalName },
          files: r.files.map((f) => ({
            originalName: f.name,
            contentType: f.type || undefined,
            sizeBytes: f.size,
          })),
        })),
      };

      const created = await createDeponeJob(body);
      setResult(created);

      // Upload files by presigned URLs
      const fileByName = new Map(allFiles.map((f) => [f.name, f] as const));

      // initialize progress
      const initial: Record<string, UploadProgress> = {};
      for (const f of allFiles) {
        initial[f.name] = { fileName: f.name, loaded: 0, total: f.size, status: 'PENDING' };
      }
      setUploadProgress(initial);

      for (const up of created.uploads) {
        const file = fileByName.get(up.contentLocation) ?? fileByName.get(up.objectKey) ?? fileByName.get(up.fileId);

        const byObjectKeyBase = up.objectKey ? fileByName.get(basenameFromPath(up.objectKey)) : undefined;
        const byContentLocationBase = up.contentLocation ? fileByName.get(basenameFromPath(up.contentLocation)) : undefined;

        // Fallback: match by originalName (most typical) — backend likely stores it in objectKey or contentLocation.
        const matched =
          file ??
          byObjectKeyBase ??
          byContentLocationBase ??
          allFiles.find((f) => f.name === up.objectKey) ??
          allFiles.find((f) => f.name === up.contentLocation);
        if (!matched) {
          throw new Error(`Не удалось сопоставить presigned upload с выбранным файлом (fileId=${up.fileId}).`);
        }

        setUploadProgress((prev) => ({
          ...prev,
          [matched.name]: { ...prev[matched.name], status: 'UPLOADING' },
        }));

        await uploadToPresignedUrl({
          file: matched,
          presigned: up,
          onProgress: (loaded, total) => {
            setUploadProgress((prev) => ({
              ...prev,
              [matched.name]: { ...prev[matched.name], loaded, total, status: 'UPLOADING' },
            }));
          },
        });

        setUploadProgress((prev) => ({
          ...prev,
          [matched.name]: { ...prev[matched.name], loaded: matched.size, total: matched.size, status: 'DONE' },
        }));
      }

      // Submit job to processing
      await submitDeponeJob(created.jobId);
      setSubmitted(true);
    } catch (e) {
      const ue = toUserFacingError(e);
      setError(`${ue.title}${ue.description ? `: ${ue.description}` : ''}${debug && e instanceof Error ? ` (debug: ${e.message})` : ''}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5">Депонирование</Typography>
          <Typography variant="body2" color="text.secondary">
            Создайте депонирование, загрузите файлы по выданным ссылкам и отправьте депонирование на обработку.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">1) Основные параметры</Typography>

              {entityTypesQuery.isLoading && <Alert severity="info">Загружаю доступные типы интеллектуальной сущности…</Alert>}
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

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="entityType-label">Тип сущности</InputLabel>
                  <Select
                    labelId="entityType-label"
                    label="Тип сущности"
                    value={effectiveEntityTypeName}
                    onChange={(e) => setEntityTypeName(String(e.target.value))}
                    disabled={isSubmitting || entityTypesQuery.isLoading || entityTypesQuery.isError}
                  >
                    {entityTypes.map((t) => (
                      <MenuItem key={t.id} value={t.name}>
                        {t.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <TextField
                label="Оригинальное имя (ИС)"
                value={premisOriginalName}
                onChange={(e) => setPremisOriginalName(e.target.value)}
                fullWidth
                size="small"
                disabled={isSubmitting}
                helperText="Если не заполнить — будет использовано название первой репрезентации"
              />

              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Идентификаторы (ИС)
                </Typography>

                {premisIdentifiers.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Идентификаторов нет. Нажмите «Добавить идентификатор», если нужно.
                  </Typography>
                )}

                {premisIdentifiers.map((id, idx) => (
                  <Stack
                    key={idx}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: 'center' } }}
                  >
                    <FormControl sx={{ minWidth: 160 }} size="small">
                      <InputLabel id={`premis-id-type-${idx}`}>Тип</InputLabel>
                      <Select
                        labelId={`premis-id-type-${idx}`}
                        label="Тип"
                        value={id.type}
                        onChange={(e) => {
                          const v = (e.target.value === 'OTHER' ? 'OTHER' : 'SYSTEM') as 'SYSTEM' | 'OTHER';
                          setPremisIdentifiers((prev) => prev.map((x, i) => (i === idx ? { ...x, type: v } : x)));
                        }}
                        disabled={isSubmitting}
                      >
                        <MenuItem value="SYSTEM">SYSTEM</MenuItem>
                        <MenuItem value="OTHER">OTHER</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Значение"
                      value={id.value}
                      onChange={(e) =>
                        setPremisIdentifiers((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))
                      }
                      fullWidth
                      size="small"
                      disabled={isSubmitting}
                    />
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={isSubmitting}
                      onClick={() => setPremisIdentifiers((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Удалить
                    </Button>
                  </Stack>
                ))}
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isSubmitting}
                    onClick={() => setPremisIdentifiers((prev) => [...prev, { type: 'SYSTEM', value: '' }])}
                  >
                    Добавить идентификатор
                  </Button>
                </Box>
              </Stack>
            </Stack>
          </CardContent>
        </Card>


        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">2) Описательные метаданные</Typography>

              {schemasQuery.isLoading && <Alert severity="info">Загружаю список схем…</Alert>}
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

              {!schemasQuery.isLoading && !schemasQuery.isError && !activeSchemaId && (
                <Alert severity="warning">
                  Не найдена активная схема для entityType={effectiveEntityTypeName}. Проверьте настройки схем на бэке.
                </Alert>
              )}

              {schemaQuery.isLoading && activeSchemaId && <Alert severity="info">Загружаю JsonSchema…</Alert>}
              {schemaQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const ue = toUserFacingError(schemaQuery.error);
                    return (
                      <>
                        {ue.title}{ue.description ? `: ${ue.description}` : ''}
                        {debug && schemaQuery.error instanceof Error ? ` (debug: ${schemaQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              {activeSchemaId && schemaQuery.data && !schema && (
                <Alert severity="error">JsonSchema пришла в некорректном формате.</Alert>
              )}

              {schema && (
                <JsonSchemaForm
                  schema={schema}
                  value={descriptiveMetadataValue}
                  onChange={(next) => setDescriptiveMetadataValue((next ?? {}) as Record<string, unknown>)}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">3) Связи с объектами</Typography>

              <Stack spacing={1.5}>
                {relationships.map((relationship, idx) => (
                  <Stack
                    key={idx}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: 'center' } }}
                  >
                    <FormControl sx={{ minWidth: 180 }} size="small">
                      <InputLabel id={`relationship-type-${idx}`}>Вид связи</InputLabel>
                      <Select
                        labelId={`relationship-type-${idx}`}
                        label="Вид связи"
                        value={relationship.type}
                        onChange={(e) => {
                          const value = e.target.value as NonNullable<Relationship['type']>;
                          setRelationships((prev) => prev.map((item, i) => (i === idx ? { ...item, type: value } : item)));
                        }}
                        disabled={isSubmitting}
                      >
                        {RELATIONSHIP_TYPE_OPTIONS.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 220 }} size="small">
                      <InputLabel id={`relationship-subtype-${idx}`}>Подтип связи</InputLabel>
                      <Select
                        labelId={`relationship-subtype-${idx}`}
                        label="Подтип связи"
                        value={relationship.subType}
                        onChange={(e) => {
                          const value = e.target.value as NonNullable<Relationship['subType']>;
                          setRelationships((prev) => prev.map((item, i) => (i === idx ? { ...item, subType: value } : item)));
                        }}
                        disabled={isSubmitting}
                      >
                        {RELATIONSHIP_SUBTYPE_OPTIONS.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <RelationshipObjectAutocomplete
                      value={relationship}
                      disabled={isSubmitting}
                      onChange={(nextRelationship) =>
                        setRelationships((prev) => prev.map((item, i) => (i === idx ? nextRelationship : item)))
                      }
                    />

                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={isSubmitting}
                      onClick={() => setRelationships((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Удалить
                    </Button>
                  </Stack>
                ))}

                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isSubmitting}
                    onClick={() =>
                      setRelationships((prev) => [
                        ...prev,
                        { type: 'STRUCTURAL', subType: 'HAS_PART', objectId: '', objectQuery: '', objectLabel: '' },
                      ])
                    }
                  >
                    Добавить связь
                  </Button>
                </Box>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">4) Представления и файлы</Typography>

              <Stack spacing={2}>
                {representations.map((rep, idx) => (
                  <Card key={rep.id} variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Репрезентация #{idx + 1}
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={isSubmitting || representations.length <= 1}
                            onClick={() => setRepresentations((prev) => prev.filter((r) => r.id !== rep.id))}
                          >
                            Удалить
                          </Button>
                        </Stack>

                        <TextField
                          label="Название представления"
                          value={rep.originalName}
                          onChange={(e) =>
                            setRepresentations((prev) =>
                              prev.map((r) => (r.id === rep.id ? { ...r, originalName: e.target.value } : r)),
                            )
                          }
                          fullWidth
                          size="small"
                          disabled={isSubmitting}
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                          <Button variant="outlined" component="label" disabled={isSubmitting}>
                            Выбрать файлы
                            <input
                              type="file"
                              hidden
                              multiple
                              onChange={(e) => {
                                const list = Array.from(e.target.files ?? []);
                                setRepresentations((prev) =>
                                  prev.map((r) => (r.id === rep.id ? { ...r, files: list } : r)),
                                );
                              }}
                            />
                          </Button>
                          <Typography variant="body2" color="text.secondary">
                            Выбрано: {rep.files.length}
                          </Typography>
                        </Stack>

                        {rep.files.length > 0 && (
                          <List dense disablePadding>
                            {rep.files.map((f) => (
                              <ListItem key={`${rep.id}:${f.name}`} divider disableGutters>
                                <ListItemText primary={f.name} secondary={`${f.size.toLocaleString()} байт`} />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}

                <Box>
                  <Button
                    variant="outlined"
                    disabled={isSubmitting}
                    onClick={() =>
                      setRepresentations((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), originalName: `representation-${prev.length + 1}`, files: [] },
                      ])
                    }
                  >
                    Добавить репрезентацию
                  </Button>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  Всего файлов: {allFiles.length} • Размер: {totalBytes.toLocaleString()} байт
                </Typography>
              </Stack>

              <Button
                variant="contained"
                onClick={() => void handleStart()}
                disabled={isSubmitting || allFiles.length === 0}
              >
                {isSubmitting ? 'Выполняется…' : 'Начать депонирование'}
              </Button>

              {isSubmitting && (
                <Stack spacing={1}>
                  <LinearProgress variant={totalBytes > 0 ? 'determinate' : 'indeterminate'} value={overallPct} />
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      {loadedBytes.toLocaleString()} / {totalBytes.toLocaleString()} байт ({overallPct}%)
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {Object.keys(uploadProgress).length > 0 && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Статус загрузки</Typography>
                <Typography variant="body2" color="text.secondary">
                  Загружено: {loadedBytes.toLocaleString()} / {totalBytes.toLocaleString()} байт
                </Typography>
                <List dense disablePadding>
                  {Object.values(uploadProgress).map((p) => {
                    const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
                    return (
                      <ListItem key={p.fileName} divider sx={{ alignItems: 'flex-start' }}>
                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {p.fileName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {p.status}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                              <LinearProgress
                                variant={p.total ? 'determinate' : 'indeterminate'}
                                value={pct}
                                color={p.status === 'FAILED' ? 'error' : 'primary'}
                              />
                              <Typography variant="caption" color={p.status === 'FAILED' ? 'error' : 'text.secondary'}>
                                {p.error ? p.error : `${p.loaded.toLocaleString()} / ${(p.total ?? 0).toLocaleString()} байт`}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Stack>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">Результат</Typography>
                  {submitted && <Alert severity="success">Депонирование отправлено на обработку.</Alert>}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Typography variant="body2">
                      <b>ID депонирования:</b> {result.jobId}
                    </Typography>
                    <Typography variant="body2">
                      <b>objectId:</b> {result.objectId}
                    </Typography>
                    <Typography variant="body2">
                      <b>status:</b> {result.status}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  );
}
