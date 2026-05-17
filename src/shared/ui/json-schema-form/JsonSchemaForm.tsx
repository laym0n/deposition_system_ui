import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minItems?: number;
  enum?: unknown[];
  default?: unknown;
};

function isObjectSchema(schema: JsonSchema): boolean {
  const t = schema.type;
  return t === 'object' || (Array.isArray(t) && t.includes('object'));
}

function isBooleanSchema(schema: JsonSchema): boolean {
  const t = schema.type;
  return t === 'boolean' || (Array.isArray(t) && t.includes('boolean'));
}

function isNumberSchema(schema: JsonSchema): boolean {
  const t = schema.type;
  return (
    t === 'number' ||
    t === 'integer' ||
    (Array.isArray(t) && (t.includes('number') || t.includes('integer')))
  );
}

function isArraySchema(schema: JsonSchema): boolean {
  const t = schema.type;
  return t === 'array' || (Array.isArray(t) && t.includes('array'));
}

function setInIndex(obj: unknown, path: string[], idx: number, value: unknown): unknown {
  const cur = (getIn(obj, path) as unknown[] | undefined) ?? [];
  const next = [...cur];
  next[idx] = value;
  return setIn(obj, path, next);
}

function removeInIndex(obj: unknown, path: string[], idx: number): unknown {
  const cur = (getIn(obj, path) as unknown[] | undefined) ?? [];
  const next = cur.filter((_, i) => i !== idx);
  return setIn(obj, path, next);
}

function normalizeArray(value: unknown, minItems = 0): unknown[] {
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  if (arr.length >= minItems) return arr;
  return [...arr, ...Array.from({ length: minItems - arr.length }, () => '')];
}

function setIn(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  const prev = (obj ?? {}) as Record<string, unknown>;
  return {
    ...prev,
    [head]: setIn(prev[head], tail, value),
  };
}

function getIn(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function Field(props: {
  schema: JsonSchema;
  path: string[];
  value: unknown;
  requiredKeys: Set<string>;
  onChange: (nextRoot: unknown) => void;
  rootValue: unknown;
}) {
  const { schema, path, value, requiredKeys, onChange, rootValue } = props;
  const key = path[path.length - 1] ?? '';
  const label = schema.title ?? key;
  const isReq = requiredKeys.has(key);

  const fieldId = `jsf-${path.join('-')}`;

  if (isObjectSchema(schema)) {
    const propsObj = schema.properties ?? {};
    const req = new Set(schema.required ?? []);

    return (
      <Accordion
        disableGutters
        elevation={0}
        defaultExpanded={path.length <= 1}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography variant="subtitle2">
              {label}
              {isReq ? ' *' : ''}
            </Typography>
            {schema.description && (
              <Typography variant="caption" color="text.secondary">
                {schema.description}
              </Typography>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {Object.entries(propsObj).map(([childKey, childSchema]) => (
              <Field
                key={childKey}
                schema={childSchema}
                path={[...path, childKey]}
                value={getIn(rootValue, [...path, childKey])}
                requiredKeys={req}
                onChange={onChange}
                rootValue={rootValue}
              />
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    );
  }

  if (schema.enum && schema.enum.length > 0) {
    return (
      <FormControl fullWidth size="small">
        <InputLabel id={`enum-${path.join('-')}-label`}>
          {label}
          {isReq ? ' *' : ''}
        </InputLabel>
        <Select
          labelId={`enum-${path.join('-')}-label`}
          label={`${label}${isReq ? ' *' : ''}`}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(setIn(rootValue, path, e.target.value))}
        >
          <MenuItem value="">
            <em>—</em>
          </MenuItem>
          {schema.enum.map((v, idx) => (
            <MenuItem key={idx} value={String(v)}>
              {String(v)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (isArraySchema(schema)) {
    const items = schema.items ?? {};
    const minItems = schema.minItems ?? 0;
    const arr = normalizeArray(value, minItems);

    const itemIsNum = isNumberSchema(items);
    const itemHasEnum = Boolean(items.enum && items.enum.length > 0);

    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle2">
              {label}
              {isReq ? ' *' : ''}
            </Typography>
            {schema.description && (
              <Typography variant="caption" color="text.secondary">
                {schema.description}
              </Typography>
            )}
          </Box>

          <Stack spacing={1.25}>
            {arr.map((itemVal, idx) => (
              <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                {itemHasEnum ? (
                  <FormControl fullWidth size="small">
                    <InputLabel id={`enum-${path.join('-')}-${idx}-label`}>Значение</InputLabel>
                    <Select
                      labelId={`enum-${path.join('-')}-${idx}-label`}
                      label="Значение"
                      value={(itemVal as string | number | undefined) ?? ''}
                      onChange={(e) => onChange(setInIndex(rootValue, path, idx, e.target.value))}
                    >
                      <MenuItem value="">
                        <em>—</em>
                      </MenuItem>
                      {(items.enum ?? []).map((v, vIdx) => (
                        <MenuItem key={vIdx} value={String(v)}>
                          {String(v)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label={`Элемент #${idx + 1}`}
                    value={itemVal === undefined || itemVal === null ? '' : String(itemVal)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!itemIsNum) {
                        onChange(setInIndex(rootValue, path, idx, raw));
                        return;
                      }

                      if (raw.trim() === '') {
                        onChange(setInIndex(rootValue, path, idx, undefined));
                        return;
                      }

                      const n = Number(raw);
                      onChange(setInIndex(rootValue, path, idx, Number.isNaN(n) ? raw : n));
                    }}
                  />
                )}

                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={arr.length <= minItems}
                  onClick={() => onChange(removeInIndex(rootValue, path, idx))}
                >
                  Удалить
                </Button>
              </Stack>
            ))}

            <Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => onChange(setIn(rootValue, path, [...arr, '']))}
              >
                Добавить
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Box>
    );
  }

  if (isBooleanSchema(schema)) {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={Boolean(value)}
            onChange={(e) => onChange(setIn(rootValue, path, e.target.checked))}
          />
        }
        label={`${label}${isReq ? ' *' : ''}`}
      />
    );
  }

  const isNum = isNumberSchema(schema);

  return (
    <TextField
      fullWidth
      size="small"
      id={fieldId}
      label={`${label}${isReq ? ' *' : ''}`}
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (!isNum) {
          onChange(setIn(rootValue, path, raw));
          return;
        }

        // Keep empty string as undefined to not send NaN.
        if (raw.trim() === '') {
          onChange(setIn(rootValue, path, undefined));
          return;
        }

        const n = Number(raw);
        onChange(setIn(rootValue, path, Number.isNaN(n) ? raw : n));
      }}
      helperText={schema.description}
    />
  );
}

export function JsonSchemaForm(props: {
  schema: JsonSchema;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const { schema, value, onChange } = props;

  if (!isObjectSchema(schema)) {
    return (
      <Typography color="error">
        JsonSchemaForm: ожидается schema.type=object (сейчас: {String(schema.type)})
      </Typography>
    );
  }

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  return (
    <Stack spacing={2}>
      {Object.entries(properties).map(([key, propSchema]) => (
        <Field
          key={key}
          schema={propSchema}
          path={[key]}
          value={getIn(value, [key])}
          requiredKeys={required}
          onChange={onChange}
          rootValue={value}
        />
      ))}
    </Stack>
  );
}
