import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { components } from '@shared/api/generated/api-types';
import { maskId } from './maskId';
import { prettyDate } from './prettyDate';
import { TransactionDetailsDialog } from './TransactionDetailsDialog';
import { PremisVersionDialog } from './PremisVersionDialog';

type Anchor = components['schemas']['Anchor'];

function sortAnchors(anchors: Anchor[]) {
  return [...anchors].sort((a, b) => String(b.anchoredAt).localeCompare(String(a.anchoredAt)));
}

export function ObjectAnchorsHistory(props: {
  objectId: string;
  anchors: Anchor[] | null | undefined;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
}) {
  const { objectId, anchors, pageSizeOptions = [5, 10, 25], defaultPageSize = 5 } = props;
  const sorted = useMemo(() => sortAnchors(anchors ?? []), [anchors]);

  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [page, setPage] = useState<number>(0);

  // If data size changes, keep the page in range.
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sorted.length / pageSize) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [sorted.length, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const start = page * pageSize;
  const end = start + pageSize;
  const shown = sorted.slice(start, end);

  const [txOpen, setTxOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [premisOpen, setPremisOpen] = useState(false);
  const [premisVersionId, setPremisVersionId] = useState<string | null>(null);

  if (sorted.length === 0) {
    return <Alert severity="info">Нет якорей депонирования.</Alert>;
  }

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="caption" color="text.secondary">
          Всего фиксаций: {sorted.length}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="anchors-page-size">На странице</InputLabel>
            <Select
              labelId="anchors-page-size"
              label="На странице"
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPageSize(next);
                setPage(0);
              }}
            >
              {pageSizeOptions.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button size="small" variant="outlined" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Назад
          </Button>
          <Typography variant="caption" color="text.secondary">
            {page + 1} / {totalPages}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Вперёд
          </Button>
        </Stack>
      </Stack>

      {shown.map((a, idx) => (
        <Box key={`${a.storageVersionId}-${idx}`} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {prettyDate(a.anchoredAt)}
            </Typography>
            <Chip size="small" label="Подтверждено" color="success" variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', display: 'block', mt: 0.5 }}>
            Версия в хранилище: {maskId(String(a.storageVersionId ?? ''))}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', display: 'block' }}>
            Транзакция в блокчейне: {maskId(String(a.blockchainTxId ?? ''))}
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              disabled={!a.blockchainTxId}
              onClick={() => {
                const hash = String(a.blockchainTxId ?? '').trim();
                if (!hash) return;
                setTxHash(hash);
                setTxOpen(true);
              }}
            >
              Данные транзакции
            </Button>

            <Button
              size="small"
              variant="outlined"
              disabled={!a.storageVersionId}
              onClick={() => {
                const v = String(a.storageVersionId ?? '').trim();
                if (!v) return;
                setPremisVersionId(v);
                setPremisOpen(true);
              }}
            >
              PREMIS версии
            </Button>
          </Stack>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary">
        Показаны записи {start + 1}–{Math.min(end, sorted.length)} из {sorted.length}.
      </Typography>

      <TransactionDetailsDialog
        open={txOpen}
        txHash={txHash}
        onClose={() => {
          setTxOpen(false);
          setTxHash(null);
        }}
      />

      <PremisVersionDialog
        open={premisOpen}
        objectId={objectId}
        versionId={premisVersionId}
        onClose={() => {
          setPremisOpen(false);
          setPremisVersionId(null);
        }}
      />
    </Stack>
  );
}




