import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@shared/api/generated/api-types';
import { getStatisticsEvents } from '@shared/api/statistics';
import { isDebugEnabled, toUserFacingError } from '@shared/ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

type StatisticsEvent = components['schemas']['StatisticsEventResponse'];
type StatisticsEventType = NonNullable<StatisticsEvent['eventType']>;

const EVENT_TYPE_LABEL: Record<string, string> = {
  OBJECT_VIEW: 'Просмотры объекта',
  FILE_DOWNLOAD: 'Скачивания файлов',
  PROOF_REQUEST: 'Запросы подтверждения',
  OBJECT_DEPOSIT: 'Депонирования',
  OBJECT_VERSION_CREATE: 'Создания версий',
  OBJECT_METADATA_UPDATE: 'Обновления метаданных',
  OBJECT_ACCESS_GRANTED: 'Выдача доступа',
  OBJECT_ACCESS_REVOKED: 'Отзыв доступа',
};

const CHART_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#0288d1', '#6d4c41'];

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toIsoStartOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toIsoEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function ObjectStatistics(props: { objectId: string; enabled: boolean }) {
  const { objectId, enabled } = props;
  const debug = isDebugEnabled();

  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [eventType, setEventType] = useState<StatisticsEventType | 'ALL'>('ALL');

  const { fromIso, toIso } = useMemo(() => {
    const now = new Date();
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const from = new Date(now);
    from.setDate(from.getDate() - (days - 1));
    return { fromIso: toIsoStartOfDay(from), toIso: toIsoEndOfDay(now) };
  }, [period]);

  const query = useQuery({
    queryKey: ['statistics', 'events', { objectId, fromIso, toIso, eventType }],
    queryFn: () =>
      getStatisticsEvents({
        objectId,
        from: fromIso,
        to: toIso,
        eventType: eventType === 'ALL' ? undefined : eventType,
      }),
    enabled: Boolean(objectId) && enabled,
    staleTime: 10_000,
  });

  if (!enabled) return null;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel id="stats-period">Период</InputLabel>
          <Select
            labelId="stats-period"
            label="Период"
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
          >
            <MenuItem value="7d">7 дней</MenuItem>
            <MenuItem value="30d">30 дней</MenuItem>
            <MenuItem value="90d">90 дней</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id="stats-type">Тип события</InputLabel>
          <Select
            labelId="stats-type"
            label="Тип события"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as StatisticsEventType | 'ALL')}
          >
            <MenuItem value="ALL">Все</MenuItem>
            {Object.keys(EVENT_TYPE_LABEL).map((k) => (
              <MenuItem key={k} value={k}>
                {EVENT_TYPE_LABEL[k]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {query.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {query.isError && (
        <Alert severity="error" sx={{ mb: 0 }}>
          {(() => {
            const e = toUserFacingError(query.error);
            return (
              <>
                {e.title}{e.description ? `: ${e.description}` : ''}
                {debug && query.error instanceof Error ? ` (debug: ${query.error.message})` : null}
              </>
            );
          })()}
        </Alert>
      )}

      {query.isSuccess && (
        (() => {
          const events = query.data ?? [];

          const byDay = new Map<string, number>();
          for (const ev of events) {
            const ts = ev.timestamp ? new Date(ev.timestamp) : null;
            const key = ts && !Number.isNaN(ts.getTime()) ? formatYmd(ts) : 'unknown';
            byDay.set(key, (byDay.get(key) ?? 0) + 1);
          }

          const perDay: Array<{ day: Date; value: number }> = [];
          {
            const from = new Date(fromIso);
            const to = new Date(toIso);
            const cur = new Date(from);
            cur.setHours(0, 0, 0, 0);
            const end = new Date(to);
            end.setHours(0, 0, 0, 0);
            while (cur.getTime() <= end.getTime()) {
              const label = formatYmd(cur);
              perDay.push({ day: new Date(cur), value: byDay.get(label) ?? 0 });
              cur.setDate(cur.getDate() + 1);
            }
          }

          const MAX_BARS = 30;
          const bucketSize = Math.max(1, Math.ceil(perDay.length / MAX_BARS));
          const byDayItems: Array<{ label: string; value: number }> = [];
          for (let i = 0; i < perDay.length; i += bucketSize) {
            const bucket = perDay.slice(i, i + bucketSize);
            const start = bucket[0]?.day;
            const end = bucket[bucket.length - 1]?.day;
            const sum = bucket.reduce((acc, x) => acc + x.value, 0);
            const label =
              start && end
                ? bucketSize === 1
                  ? formatYmd(start)
                  : `${formatYmd(start)}…${formatYmd(end)}`
                : '—';
            byDayItems.push({ label, value: sum });
          }

          const byType = new Map<string, number>();
          for (const ev of events) {
            const t = ev.eventType ?? 'UNKNOWN';
            byType.set(t, (byType.get(t) ?? 0) + 1);
          }
          const byTypeItems = [...byType.entries()]
            .sort(([, av], [, bv]) => bv - av)
            .map(([k, v]) => ({ label: EVENT_TYPE_LABEL[k] ?? k, value: v }));

          return (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Всего событий: {events.length}
              </Typography>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  События по дням
                </Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={byDayItems.map((x) => ({ day: x.label, count: x.value }))} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" angle={-35} textAnchor="end" height={50} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  События по типам
                </Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTypeItems.map((x) => ({ type: x.label, count: x.value }))} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" angle={-25} textAnchor="end" height={60} interval={0} />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#1976d2">
                        {byTypeItems.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            </Stack>
          );
        })()
      )}
    </Stack>
  );
}
