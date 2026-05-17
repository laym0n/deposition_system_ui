import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  return true;
}

export function MetadataTree(props: { value: unknown; level?: number }) {
  const { value, level = 0 } = props;

  if (value === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <Typography variant="body2">{String(value)}</Typography>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          (пусто)
        </Typography>
      );
    }

    return (
      <Stack spacing={1} sx={{ pl: level > 0 ? 2 : 0 }}>
        {value.map((item, idx) => (
          <Box key={idx} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <MetadataTree value={item} level={level + 1} />
          </Box>
        ))}
      </Stack>
    );
  }

  if (isPlainRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          (пусто)
        </Typography>
      );
    }

    return (
      <Stack spacing={1} sx={{ pl: level > 0 ? 2 : 0 }}>
        {entries.map(([k, v]) => (
          <Box key={k}>
            <Typography variant="caption" color="text.secondary">
              {k}
            </Typography>
            <Box sx={{ pl: 1 }}>
              <MetadataTree value={v} level={level + 1} />
            </Box>
          </Box>
        ))}
      </Stack>
    );
  }

  return <Typography variant="body2">{String(value)}</Typography>;
}
