import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery } from '@tanstack/react-query';
import { getEthereumBlockByNumber, getEthereumTransaction, getEthereumTransactionReceipt } from '@shared/eth/ethereumRpc';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';

function safeJsonStringify(value: unknown) {
  return JSON.stringify(
    value,
    (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      return v;
    },
    2,
  );
}

function hexToBigInt(hex: string | null | undefined): bigint | null {
  if (!hex) return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

function hexToNumber(hex: string | null | undefined): number | null {
  const bi = hexToBigInt(hex);
  if (bi === null) return null;
  if (bi > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(bi);
}

function formatUnixSecondsHexToLocal(hexSeconds: string | null | undefined): string {
  const sec = hexToNumber(hexSeconds);
  if (sec === null) return '—';
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function TransactionDetailsDialog(props: {
  open: boolean;
  txHash: string | null | undefined;
  onClose: () => void;
}) {
  const { open, txHash, onClose } = props;
  const hash = String(txHash ?? '').trim();
  const debug = isDebugEnabled();

  const txQuery = useQuery({
    queryKey: ['ethereum', 'tx', hash],
    queryFn: () => getEthereumTransaction(hash),
    enabled: open && Boolean(hash),
    staleTime: 30_000,
  });

  const txReceiptQuery = useQuery({
    queryKey: ['ethereum', 'tx-receipt', hash],
    queryFn: () => getEthereumTransactionReceipt(hash),
    enabled: open && Boolean(hash),
    staleTime: 30_000,
  });

  const effectiveBlockNumber = txQuery.data?.blockNumber ?? txReceiptQuery.data?.blockNumber ?? null;

  const txBlockQuery = useQuery({
    queryKey: ['ethereum', 'block', effectiveBlockNumber],
    queryFn: async () => {
      const bn = effectiveBlockNumber;
      if (!bn) return null;
      return getEthereumBlockByNumber(bn);
    },
    enabled: open && Boolean(effectiveBlockNumber),
    staleTime: 30_000,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Данные транзакции</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            txHash: {hash || '—'}
          </Typography>

          {!hash && <Alert severity="warning">Не задан hash транзакции.</Alert>}

          {(txQuery.isLoading || txReceiptQuery.isLoading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={22} />
            </Box>
          )}

          {(txQuery.isError || txReceiptQuery.isError) && (
            <Alert severity="error" sx={{ mb: 0 }}>
              {(() => {
                const err = (txQuery.isError ? txQuery.error : txReceiptQuery.error) as unknown;
                const e = toUserFacingError(err);
                const msg = err instanceof Error ? err.message : '';
                return (
                  <>
                    {e.title}{e.description ? `: ${e.description}` : ''}
                    {debug && msg ? ` (debug: ${msg})` : null}
                  </>
                );
              })()}
            </Alert>
          )}

          {txQuery.isSuccess && txQuery.data && (
            <>
              <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    <b>Время:</b>{' '}
                    {txBlockQuery.data?.timestamp
                      ? formatUnixSecondsHexToLocal(txBlockQuery.data.timestamp)
                      : effectiveBlockNumber
                        ? 'Загрузка времени блока…'
                        : 'Ожидает включения в блок'}
                  </Typography>
                  <Typography variant="body2">
                    <b>Отправитель:</b> {txQuery.data.from}
                  </Typography>
                  <Typography variant="body2">
                    <b>Получатель:</b> {txQuery.data.to ?? '—'}
                  </Typography>
                  <Typography variant="body2">
                    <b>Номер блока:</b> {effectiveBlockNumber ?? '—'}
                  </Typography>
                </Stack>
              </Box>

              {debug && (
                <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">Raw JSON</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box
                      component="pre"
                      sx={{
                        p: 1.25,
                        m: 0,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 12,
                        maxHeight: 420,
                        overflow: 'auto',
                      }}
                    >
                      {safeJsonStringify({ tx: txQuery.data, receipt: txReceiptQuery.data, block: txBlockQuery.data })}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(hash);
            } catch {
              // ignore
            }
          }}
          disabled={!hash}
        >
          Скопировать hash
        </Button>
        <Button variant="contained" onClick={onClose}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
