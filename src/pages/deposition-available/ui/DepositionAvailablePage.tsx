import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  getDescriptiveMetadataJsonSchema,
  getDescriptiveMetadataSchemas,
  listIntellectualEntityTypes,
} from '@shared/api';
import { useIsAdmin } from '@shared/auth/useIsAdmin';
import { isDebugEnabled, JsonSchemaFieldsTable, JsonSchemaViewer, toUserFacingError } from '@shared/ui';

export function DepositionAvailablePage() {
  const isAdmin = useIsAdmin();
  const debug = isDebugEnabled();
  const [entityTypeName, setEntityTypeName] = useState<string>('');
  const [tab, setTab] = useState<'fields' | 'schema'>('fields');

  const entityTypesQuery = useQuery({
    queryKey: ['intellectual-entity-types', 'list'],
    queryFn: () => listIntellectualEntityTypes(),
    staleTime: 60_000,
  });

  const entityTypes = entityTypesQuery.data ?? [];

  // Avoid setState in effects (lint rule react-hooks/set-state-in-effect).
  // We treat the first loaded entity type as a default selection until user explicitly picks one.
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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5">Доступные объекты депонирования</Typography>
          <Typography variant="body2" color="text.secondary">
            Выберите тип интеллектуальной сущности — загрузим и покажем активную схему описательных метаданных.
          </Typography>
        </Box>

        {isAdmin && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" href="/deposition/object-types">
                Открыть
              </Button>
            }
          >
            Вам доступно управление типами объектов депонирования
          </Alert>
        )}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Тип интеллектуальной сущности</Typography>

              {entityTypesQuery.isLoading && (
                <Alert severity="info">Загружаю список типов…</Alert>
              )}
              {entityTypesQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const e = toUserFacingError(entityTypesQuery.error);
                    return (
                      <>
                        {e.title}{e.description ? `: ${e.description}` : ''}
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
                  onChange={(e) => setEntityTypeName(String(e.target.value))}
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
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Активная схема descriptive-metadata</Typography>

              {!effectiveEntityTypeName && <Alert severity="info">Выберите тип, чтобы загрузить схему.</Alert>}

              {schemasQuery.isLoading && effectiveEntityTypeName && (
                <Alert severity="info">Загружаю список схем…</Alert>
              )}
              {schemasQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const e = toUserFacingError(schemasQuery.error);
                    return (
                      <>
                        {e.title}{e.description ? `: ${e.description}` : ''}
                        {debug && schemasQuery.error instanceof Error ? ` (debug: ${schemasQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}
              {!schemasQuery.isLoading && !schemasQuery.isError && effectiveEntityTypeName && !activeSchemaId && (
                <Alert severity="warning">
                  Для entityType={effectiveEntityTypeName} не найдена активная схема.
                </Alert>
              )}

              {schemaQuery.isLoading && activeSchemaId && <Alert severity="info">Загружаю JsonSchema…</Alert>}
              {schemaQuery.isError && (
                <Alert severity="error">
                  {(() => {
                    const e = toUserFacingError(schemaQuery.error);
                    return (
                      <>
                        {e.title}{e.description ? `: ${e.description}` : ''}
                        {debug && schemaQuery.error instanceof Error ? ` (debug: ${schemaQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              {schemaQuery.data && (
                <>
                  <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Tab value="fields" label="Поля" />
                    <Tab value="schema" label="JSON Schema" />
                  </Tabs>

                  {tab === 'fields' && (
                    (() => {
                      return <JsonSchemaFieldsTable schema={schemaQuery.data} />;
                    })()
                  )}

                  {tab === 'schema' && (
                    <JsonSchemaViewer value={schemaQuery.data as object} collapsed={1} />
                  )}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
