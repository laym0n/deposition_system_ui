import type { components, operations } from './generated/api-types';
import { fetchJson } from './fetchJson';

export type GetEventsQuery = operations['getEvents']['parameters']['query'];
export type StatisticsEventResponse = components['schemas']['StatisticsEventResponse'];

export function getStatisticsEvents(query: GetEventsQuery) {
  const params = new URLSearchParams();
  params.set('objectId', query.objectId);
  params.set('from', query.from);
  params.set('to', query.to);
  if (query.eventType) params.set('eventType', query.eventType);

  return fetchJson<StatisticsEventResponse[]>(`/statistics/events?${params.toString()}`, {
    method: 'GET',
  });
}
