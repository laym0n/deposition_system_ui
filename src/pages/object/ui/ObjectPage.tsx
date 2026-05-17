import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { components } from '@shared/api/generated/api-types';
import { fetchJson } from '@shared/api/fetchJson';
import { fetchText } from '@shared/api/fetchText';
import { getStatisticsEvents } from '@shared/api/statistics';
import { getDescriptiveMetadataSchemas, getDescriptiveMetadataJsonSchema, upsertObjectDescriptiveMetadata } from '@shared/api';
import { searchUsers, upsertUserAclEntry } from '@shared/api';
import { updateObjectVisibility } from '@shared/api';
import { upsertRightsStatement } from '@shared/api';
import { recordObjectEvent } from '@shared/api';
import { presignSourceFilesDownload } from '@shared/api';
import { verifyObjectPremis } from '@shared/api';
import { getEthereumBlockByNumber, getEthereumTransaction, getEthereumTransactionReceipt } from '@shared/eth/ethereumRpc';
import type { JsonSchema } from '@shared/ui';
import { isDebugEnabled, toUserFacingError, JsonSchemaForm, JsonSchemaViewer } from '@shared/ui';
import { useUserId } from '@shared/auth/useUserId';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts';

import { maskId } from './components/maskId';
import { prettyDate } from './components/prettyDate';
import { MetadataTree } from './components/MetadataTree';
import { PremisXmlViewer } from './components/PremisXmlViewer';

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

function decodeHexJsonInput(input: string):
  | { kind: 'empty' }
  | { kind: 'decoded'; text: string; json: unknown | null }
  | { kind: 'invalid' } {
  const raw = (input ?? '').trim();
  if (!raw || raw === '0x') return { kind: 'empty' };
  if (!raw.startsWith('0x')) return { kind: 'invalid' };

  const hex = raw.slice(2);
  if (hex.length % 2 !== 0) return { kind: 'invalid' };

  try {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = Number.parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) return { kind: 'invalid' };
      bytes[i / 2] = byte;
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
    let json: unknown | null = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { kind: 'decoded', text, json };
  } catch {
    return { kind: 'invalid' };
  }
}

type CachedObjectMetadataResponse = components['schemas']['CachedObjectMetadataResponse'];

type ObjectAcl = components['schemas']['ObjectAcl'];

type AclEntry = components['schemas']['AclEntry'];

type Anchor = components['schemas']['Anchor'];

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

type ObjectVisibility = NonNullable<CachedObjectMetadataResponse['visibility']>;

const VISIBILITY_LABEL: Record<ObjectVisibility, string> = {
  PUBLIC: 'Публичный',
  PRIVATE: 'Приватный',
};

type RightsBasis = components['schemas']['UpsertRightsStatementRequest']['rightsBasis'];
type RightsStatementPayload = components['schemas']['RightsStatementPayload'];
type AgentGrant = components['schemas']['AgentGrant'];

type RecordObjectEventRequest = components['schemas']['RecordObjectEventRequest'];
type ObjectEventType = RecordObjectEventRequest['type'];
type EventOutcome = NonNullable<components['schemas']['EventOutcomeInformation']['outcome']>;

const EVENT_TYPE_CREATE_LABEL: Record<ObjectEventType, string> = {
  ACCESSION: 'ACCESSION',
  CREATION: 'CREATION',
  DEACCESSION: 'DEACCESSION',
  DELETION: 'DELETION',
  METADATA_MODIFICATION: 'METADATA_MODIFICATION',
  MIGRATION: 'MIGRATION',
  OTHER: 'OTHER',
};

const RIGHTS_BASIS_LABEL: Record<RightsBasis, string> = {
  COPYRIGHT: 'Авторское право',
  LICENSE: 'Лицензия',
  STATUTE: 'Закон / нормативный акт',
  OTHER: 'Другое',
};

function toStringArray(input: string): string[] {
  return input
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function toOptionalIsoDate(input: string): string | undefined {
  const v = input.trim();
  if (!v) return undefined;
  // backend expects format: date for some fields, keep as-is.
  return v;
}

function extractRightsStatementXml(xml: string): string | null {
  // Heuristic: extract first <rightsStatement>...</rightsStatement> block.
  // We avoid full XML namespace parsing here because PREMIS namespaces may vary.
  const re = /<[^>]*rightsStatement\b[\s\S]*?<\/[^>]*rightsStatement\s*>/i;
  const m = xml.match(re);
  return m ? m[0] : null;
}

function extractRightsStatementIds(xml: string): string[] {
  // Heuristic: look for attributes that end with "rightsStatementIdentifierValue" and collect their text content.
  // This is based on typical PREMIS serialization.
  const ids: string[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) return [];

    const all = Array.from(doc.getElementsByTagName('*')) as Element[];
    for (const el of all) {
      const local = el.localName || el.tagName;
      if (!String(local).toLowerCase().endsWith('rightsstatementidentifiervalue')) continue;
      const v = (el.textContent ?? '').trim();
      if (!v) continue;
      // В PREMIS также могут попадать технические rightsstatement'ы (например для visibility).
      // Их не показываем в UI-списке.
      if (/^visibility_/i.test(v)) continue;
      ids.push(v);
    }
  } catch {
    return [];
  }
  return Array.from(new Set(ids));
}

type PremisSystemFile = {
  fileId: string;
  objectKey?: string;
  originalName?: string;
};

function extractSystemFileIdsFromPremis(xml: string): PremisSystemFile[] {
  // We only consider PREMIS objects where object@xsi:type == "file" (i.e. object.type=FILE).
  // Inside each such <object>, we take <objectIdentifier> with <objectIdentifierType>SYSTEM</objectIdentifierType>
  // and use its <objectIdentifierValue> as fileId.
  // PREMIS namespaces may vary, so we rely on localName comparisons.
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) return [];

    const out: PremisSystemFile[] = [];

    const objects = Array.from(doc.getElementsByTagName('*')).filter((el) => {
      const ln = (el.localName || el.tagName).toLowerCase();
      return ln === 'object';
    }) as Element[];

    for (const obj of objects) {
      // xsi:type="file" (case-insensitive)
      const xsiType = obj.getAttribute('xsi:type') || obj.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type');
      if (!xsiType) continue;
      if (String(xsiType).toLowerCase() !== 'file') continue;

      // originalName (optional)
      const originalNameEl = Array.from(obj.getElementsByTagName('*')).find((x) => {
        const ln = (x.localName || x.tagName).toLowerCase();
        return ln === 'originalname';
      });
      const originalName = (originalNameEl?.textContent ?? '').trim() || undefined;

      // find objectIdentifier blocks and pick SYSTEM
      const objectIdentifierEls = Array.from(obj.getElementsByTagName('*')).filter((x) => {
        const ln = (x.localName || x.tagName).toLowerCase();
        return ln === 'objectidentifier';
      }) as Element[];

      for (const oi of objectIdentifierEls) {
        const typeEl = Array.from(oi.getElementsByTagName('*')).find((x) => {
          const ln = (x.localName || x.tagName).toLowerCase();
          return ln === 'objectidentifiertype';
        });
        const typeValue = (typeEl?.textContent ?? '').trim();
        if (typeValue !== 'SYSTEM') continue;

        const valueEl = Array.from(oi.getElementsByTagName('*')).find((x) => {
          const ln = (x.localName || x.tagName).toLowerCase();
          return ln === 'objectidentifiervalue';
        });
        const fileId = (valueEl?.textContent ?? '').trim();
        if (!fileId) continue;
        out.push({ fileId, originalName });
      }
    }

    // Deduplicate by fileId.
    const map = new Map<string, PremisSystemFile>();
    for (const x of out) map.set(x.fileId, x);
    return [...map.values()];
  } catch {
    return [];
  }
}

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

const CHART_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#0288d1', '#6d4c41'];

function sortAnchors(anchors: Anchor[]) {
  return [...anchors].sort((a, b) => String(b.anchoredAt).localeCompare(String(a.anchoredAt)));
}

async function getCachedMetadata(objectId: string) {
  return fetchJson<CachedObjectMetadataResponse>(`/objects/${objectId}/cached-metadata`, {
    method: 'GET',
  });
}

function hasWritePermission(params: { acl?: ObjectAcl; userId: string | null | undefined }): boolean {
  const { acl, userId } = params;
  if (!userId) return false;
  const entries = acl?.entries ?? [];
  for (const e of entries) {
    const principalId = e.principal?.id;
    if (principalId !== userId) continue;
    const perms = e.permissions ?? [];
    if (perms.includes('WRITE')) return true;
  }
  return false;
}

function hasReadSourceFilePermission(params: { acl?: ObjectAcl; userId: string | null | undefined }): boolean {
  const { acl, userId } = params;
  if (!userId) return false;
  const entries = acl?.entries ?? [];
  for (const e of entries) {
    const principalId = e.principal?.id;
    if (principalId !== userId) continue;
    const perms = e.permissions ?? [];
    if (perms.includes('READ_SOURCE_FILE')) return true;
  }
  return false;
}

function formatAclEntryTitle(e: AclEntry): string {
  const id = e.principal?.id ?? '—';
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

async function getPremisMetadataXml(objectId: string) {
  // Endpoint returns application/xml.
  return fetchText(`/objects/${objectId}/metadata`, { method: 'GET' });
}

async function getPremisMetadataXmlForVersion(params: { objectId: string; versionId: string }) {
  const { objectId, versionId } = params;
  const v = versionId.trim();
  if (!v) throw new Error('versionId is empty');
  const qs = new URLSearchParams({ versionId: v });
  // Backend supports querying PREMIS for a specific version via versionId.
  return fetchText(`/objects/${objectId}/metadata?${qs.toString()}`, { method: 'GET' });
}

export function ObjectPage() {
  const { objectId } = useParams({ from: '/objects/$objectId/edit' });

  const debug = isDebugEnabled();

  const queryClient = useQueryClient();
  const userId = useUserId();

  const [premisExpanded, setPremisExpanded] = useState(false);

  const [premisVersionDialogOpen, setPremisVersionDialogOpen] = useState(false);
  const [premisVersionId, setPremisVersionId] = useState<string>('');

  // Rights statement editor (state is used to trigger PREMIS preload too)
  const [rightsExpanded, setRightsExpanded] = useState(false);

  // Object event editor (state is used to trigger PREMIS preload too)
  const [eventExpanded, setEventExpanded] = useState(false);

  // Source files download (state is used to trigger PREMIS preload too)
  const [sourceFilesExpanded, setSourceFilesExpanded] = useState(false);

  const [statsExpanded, setStatsExpanded] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [statsEventType, setStatsEventType] = useState<StatisticsEventType | 'ALL'>('ALL');

  const query = useQuery({
    queryKey: ['objects', 'cached-metadata', objectId],
    queryFn: () => getCachedMetadata(objectId),
    enabled: Boolean(objectId),
    staleTime: 10_000,
  });

  const premisQuery = useQuery({
    queryKey: ['objects', 'premis-metadata-xml', objectId],
    queryFn: () => getPremisMetadataXml(objectId),
    enabled: Boolean(objectId) && (premisExpanded || rightsExpanded || eventExpanded || sourceFilesExpanded),
    staleTime: 10_000,
  });

  const premisVersionQuery = useQuery({
    queryKey: ['objects', 'premis-metadata-xml', objectId, 'version', premisVersionId],
    queryFn: () => getPremisMetadataXmlForVersion({ objectId, versionId: premisVersionId }),
    enabled: Boolean(objectId) && premisVersionDialogOpen && Boolean(premisVersionId.trim()),
    staleTime: 10_000,
  });

  const premisRightsStatementIds = useMemo(() => {
    if (!premisQuery.data) return [] as string[];
    return extractRightsStatementIds(premisQuery.data);
  }, [premisQuery.data]);

  const { fromIso, toIso } = (() => {
    const now = new Date();
    const days = statsPeriod === '7d' ? 7 : statsPeriod === '90d' ? 90 : 30;
    const from = new Date(now);
    from.setDate(from.getDate() - (days - 1));
    return { fromIso: toIsoStartOfDay(from), toIso: toIsoEndOfDay(now) };
  })();

  const statsQuery = useQuery({
    queryKey: ['statistics', 'events', { objectId, fromIso, toIso, statsEventType }],
    queryFn: () =>
      getStatisticsEvents({
        objectId,
        from: fromIso,
        to: toIso,
        eventType: statsEventType === 'ALL' ? undefined : statsEventType,
      }),
    enabled: Boolean(objectId) && statsExpanded,
    staleTime: 10_000,
  });

  const data = query.data;
  const originalName = data?.premisMetadata?.originalName;
  const anchors = sortAnchors(data?.premisMetadata?.anchors ?? []);
  const descriptive = data?.descriptiveMetadata ?? null;
  const latestAnchor = anchors[0];
  const visibility = data?.visibility ?? 'PRIVATE';

  const entityTypeName = data?.intellectualEntityType?.name ?? '';
  const canWrite = hasWritePermission({ acl: data?.acl, userId });
  const canReadSourceFiles = hasReadSourceFilePermission({ acl: data?.acl, userId });

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // ACL editor
  const [aclExpanded, setAclExpanded] = useState(false);
  const [aclUsername, setAclUsername] = useState('');
  const [aclSelectedUserId, setAclSelectedUserId] = useState<string | null>(null);
  const [aclPermRead, setAclPermRead] = useState(true);
  const [aclPermWrite, setAclPermWrite] = useState(false);
  const [aclPermReadSource, setAclPermReadSource] = useState(false);
  const [aclError, setAclError] = useState<string | null>(null);

  // Visibility editor
  const [visibilityExpanded, setVisibilityExpanded] = useState(false);
  const [visibilityDraft, setVisibilityDraft] = useState<ObjectVisibility>(visibility);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  // Rights statement editor
  const [rightsBasis, setRightsBasis] = useState<RightsBasis>('COPYRIGHT');
  const [rightsStatementId, setRightsStatementId] = useState<string>('');
  const [selectedExistingRightsId, setSelectedExistingRightsId] = useState<string>('');

  // Simple mode fields (covers the most common payload fields)
  const [rightsSimpleMode, setRightsSimpleMode] = useState(true);

  const [copyrightStatus, setCopyrightStatus] = useState('');
  const [copyrightJurisdiction, setCopyrightJurisdiction] = useState('');
  const [copyrightStatusDeterminationDate, setCopyrightStatusDeterminationDate] = useState('');
  const [copyrightNote, setCopyrightNote] = useState('');

  const [licenseTerms, setLicenseTerms] = useState('');
  const [licenseNote, setLicenseNote] = useState('');

  const [otherRightsBasis, setOtherRightsBasis] = useState('');
  const [otherRightsNote, setOtherRightsNote] = useState('');

  const [statuteJurisdiction, setStatuteJurisdiction] = useState('');
  const [statuteCitation, setStatuteCitation] = useState('');
  const [statuteDeterminationDate, setStatuteDeterminationDate] = useState('');
  const [statuteNote, setStatuteNote] = useState('');

  // Advanced mode raw JSON (optional)
  const [rightsPayloadJson, setRightsPayloadJson] = useState<string>('');
  const [rightsAgentsJson, setRightsAgentsJson] = useState<string>('');
  const [rightsError, setRightsError] = useState<string | null>(null);

  // Object event editor
  const [eventSimpleMode, setEventSimpleMode] = useState(true);
  const [eventType, setEventType] = useState<ObjectEventType>('OTHER');
  const [eventDetail, setEventDetail] = useState('');
  const [eventOutcome, setEventOutcome] = useState<EventOutcome | ''>('');
  const [eventOutcomeNote, setEventOutcomeNote] = useState('');
  const [eventAdvancedJson, setEventAdvancedJson] = useState('');
  const [eventError, setEventError] = useState<string | null>(null);

  const systemSourceFiles = useMemo(() => {
    if (!premisQuery.data) return [] as PremisSystemFile[];
    return extractSystemFileIdsFromPremis(premisQuery.data);
  }, [premisQuery.data]);

  const presignedSourceFilesQuery = useQuery({
    queryKey: ['objects', 'source-files', 'presigned', { objectId, fileIds: systemSourceFiles.map((x) => x.fileId) }],
    queryFn: async () => {
      const ids = systemSourceFiles.map((x) => x.fileId);
      if (ids.length === 0) return [];
      return presignSourceFilesDownload({ objectId, fileId: ids });
    },
    enabled: Boolean(objectId) && sourceFilesExpanded && canReadSourceFiles && systemSourceFiles.length > 0,
    staleTime: 10_000,
  });

  // Load active schema for object's entity type (same as deposition page).
  const schemasQuery = useQuery({
    queryKey: ['descriptive-metadata', 'schemas', { entityTypeName, active: true }],
    queryFn: () => getDescriptiveMetadataSchemas({ entityType: entityTypeName, active: true }),
    enabled: Boolean(entityTypeName) && canWrite,
    staleTime: 60_000,
  });

  const activeSchemaId = schemasQuery.data?.[0]?.id;

  const schemaQuery = useQuery({
    queryKey: ['descriptive-metadata', 'schema', activeSchemaId],
    queryFn: async () => {
      if (!activeSchemaId) return null;
      return getDescriptiveMetadataJsonSchema(activeSchemaId);
    },
    enabled: Boolean(activeSchemaId) && canWrite,
    staleTime: 60_000,
  });

  const schema: JsonSchema | null = useMemo(() => {
    try {
      return (schemaQuery.data ?? null) as JsonSchema | null;
    } catch {
      return null;
    }
  }, [schemaQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!entityTypeName) throw new Error('Не определён тип интеллектуальной сущности.');
      return upsertObjectDescriptiveMetadata({ objectId, entityType: entityTypeName, value: editValue });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['objects', 'cached-metadata', objectId] });
      setIsEditing(false);
    },
    onError: (e) => {
      setSaveError(e instanceof Error ? e.message : 'Не удалось сохранить изменения.');
    },
  });

  const userSearchQuery = useQuery({
    queryKey: ['users', 'search', { q: aclUsername }],
    queryFn: () => searchUsers({ searchQuery: aclUsername, offset: 0, limit: 10 }),
    enabled: aclExpanded && aclUsername.trim().length >= 2 && canWrite,
    staleTime: 10_000,
  });

  const upsertAclMutation = useMutation({
    mutationFn: async () => {
      if (!aclSelectedUserId) throw new Error('Выберите пользователя.');
      const permissions: Array<'READ' | 'WRITE' | 'READ_SOURCE_FILE'> = [];
      if (aclPermRead) permissions.push('READ');
      if (aclPermWrite) permissions.push('WRITE');
      if (aclPermReadSource) permissions.push('READ_SOURCE_FILE');
      if (permissions.length === 0) throw new Error('Нужно выбрать хотя бы одно право.');

      return upsertUserAclEntry(objectId, { userId: aclSelectedUserId, permissions });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['objects', 'cached-metadata', objectId] });
      setAclError(null);
      setAclUsername('');
      setAclSelectedUserId(null);
      setAclPermRead(true);
      setAclPermWrite(false);
      setAclPermReadSource(false);
    },
    onError: (e) => {
      setAclError(e instanceof Error ? e.message : 'Не удалось обновить ACL.');
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: async () => {
      return updateObjectVisibility(objectId, { visibility: visibilityDraft });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['objects', 'cached-metadata', objectId] });
      setVisibilityError(null);
    },
    onError: (e) => {
      setVisibilityError(e instanceof Error ? e.message : 'Не удалось обновить видимость.');
    },
  });

  const upsertRightsMutation = useMutation({
    mutationFn: async () => {
      let payload: RightsStatementPayload | undefined;
      let agents: AgentGrant[] | undefined;

      if (rightsSimpleMode) {
        // Build payload from simple fields.
        payload = {};

        if (rightsBasis === 'COPYRIGHT') {
          payload.copyrightInformation = {
            copyrightStatus: copyrightStatus.trim() || undefined,
            copyrightJurisdiction: copyrightJurisdiction.trim() || undefined,
            copyrightStatusDeterminationDate: toOptionalIsoDate(copyrightStatusDeterminationDate),
            copyrightNote: toStringArray(copyrightNote),
          };
        }

        if (rightsBasis === 'LICENSE') {
          payload.licenseInformation = {
            licenseTerms: licenseTerms.trim() || undefined,
            licenseNote: toStringArray(licenseNote),
          };
        }

        if (rightsBasis === 'STATUTE') {
          payload.statuteInformation = [
            {
              statuteJurisdiction: statuteJurisdiction.trim() || undefined,
              statuteCitation: statuteCitation.trim() || undefined,
              statuteInformationDeterminationDate: toOptionalIsoDate(statuteDeterminationDate),
              statuteNote: toStringArray(statuteNote),
            },
          ];
        }

        if (rightsBasis === 'OTHER') {
          payload.otherRightsInformation = {
            otherRightsBasis: otherRightsBasis.trim() || undefined,
            otherRightsNote: toStringArray(otherRightsNote),
          };
        }

        // Remove empty sections to avoid sending noisy payload.
        const prune = (obj: Record<string, unknown>) => {
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (v === undefined) {
              delete obj[k];
              continue;
            }
            if (Array.isArray(v) && v.length === 0) {
              delete obj[k];
              continue;
            }
            if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) {
              delete obj[k];
              continue;
            }
          }
        };
        prune(payload as unknown as Record<string, unknown>);
      } else {
        // Advanced mode: JSON input.
        if (rightsPayloadJson.trim()) {
          payload = JSON.parse(rightsPayloadJson) as RightsStatementPayload;
        }
        if (rightsAgentsJson.trim()) {
          agents = JSON.parse(rightsAgentsJson) as AgentGrant[];
        }
      }

      return upsertRightsStatement(objectId, {
        rightsStatementId: selectedExistingRightsId.trim() || rightsStatementId.trim() ? (selectedExistingRightsId.trim() || rightsStatementId.trim()) : undefined,
        rightsBasis,
        payload,
        agents,
      });
    },
    onSuccess: async () => {
      // rights statement отражается в PREMIS XML и иногда в cached-metadata (события/статистика),
      // поэтому обновляем обе выборки.
      await queryClient.invalidateQueries({ queryKey: ['objects', 'premis-metadata-xml', objectId] });
      await queryClient.invalidateQueries({ queryKey: ['objects', 'cached-metadata', objectId] });
      setRightsError(null);
    },
    onError: (e) => {
      setRightsError(e instanceof Error ? e.message : 'Не удалось сохранить rights-statement.');
    },
  });

  const recordEventMutation = useMutation({
    mutationFn: async () => {
      let body: RecordObjectEventRequest;
      if (eventSimpleMode) {
        const detail = eventDetail.trim() ? [{ detail: eventDetail.trim() }] : undefined;
        const outcome = eventOutcome
          ? [
              {
                outcome: eventOutcome as EventOutcome,
                outcomeDetail: eventOutcomeNote.trim() ? [{ eventOutcomeDetailNote: eventOutcomeNote.trim() }] : undefined,
              },
            ]
          : undefined;
        body = { type: eventType, detail, outcome };
      } else {
        body = JSON.parse(eventAdvancedJson) as RecordObjectEventRequest;
      }

      return recordObjectEvent(objectId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['objects', 'premis-metadata-xml', objectId] });
      await queryClient.invalidateQueries({ queryKey: ['objects', 'cached-metadata', objectId] });
      setEventError(null);

      // reset simple fields for convenience
      setEventType('OTHER');
      setEventDetail('');
      setEventOutcome('');
      setEventOutcomeNote('');
      setEventAdvancedJson('');
      setEventSimpleMode(true);
    },
    onError: (e) => {
      setEventError(e instanceof Error ? e.message : 'Не удалось записать событие.');
    },
  });

  const [verifyAnchorError, setVerifyAnchorError] = useState<string | null>(null);
  const verifyMutation = useMutation({
    mutationFn: async () => {
      // Backend verifies PREMIS anchors/tx for the whole object.
      return verifyObjectPremis(objectId);
    },
    onSuccess: async () => {
      // verification may update cached-metadata (anchors status) or premis.
      await queryClient.invalidateQueries({ queryKey: ['objects', 'cached-metadata', objectId] });
      await queryClient.invalidateQueries({ queryKey: ['objects', 'premis-metadata-xml', objectId] });
      setVerifyAnchorError(null);
    },
    onError: (e) => {
      setVerifyAnchorError(e instanceof Error ? e.message : 'Не удалось выполнить верификацию.');
    },
  });

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txDialogHash, setTxDialogHash] = useState<string>('');

  const txQuery = useQuery({
    queryKey: ['ethereum', 'tx', txDialogHash],
    queryFn: () => getEthereumTransaction(txDialogHash),
    enabled: txDialogOpen && Boolean(txDialogHash),
    staleTime: 30_000,
  });

  const txReceiptQuery = useQuery({
    queryKey: ['ethereum', 'tx-receipt', txDialogHash],
    queryFn: () => getEthereumTransactionReceipt(txDialogHash),
    enabled: txDialogOpen && Boolean(txDialogHash),
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
    enabled: txDialogOpen && Boolean(effectiveBlockNumber),
    staleTime: 30_000,
  });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" noWrap>
                    {originalName?.trim() ? originalName : 'Объект'}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      ID: {maskId(objectId)}
                    </Typography>
                    <Tooltip title="Скопировать полный ID">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(objectId);
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                {/* Навигационные кнопки вынесены из страницы объекта, чтобы не перегружать UI */}
              </Stack>

              {latestAnchor ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                  <Chip size="small" color="success" label="Депонирован" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Последний якорь: {prettyDate(latestAnchor.anchoredAt)}
                  </Typography>
                </Stack>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                  <Chip size="small" color="warning" label="Не депонирован" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Якорей депонирования пока нет.
                  </Typography>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {query.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {query.isError && (
          <Alert severity="error">
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
          <>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.25}>
                  <Box>
                    <Typography variant="h6">Депонирование</Typography>
                    <Typography variant="body2" color="text.secondary">
                      История фиксации версий в хранилище и транзакции в блокчейне.
                    </Typography>
                  </Box>

                  {anchors.length === 0 ? (
                    <Alert severity="info">Нет якорей депонирования.</Alert>
                  ) : (
                    <List dense disablePadding>
                      {anchors.slice(0, 5).map((a, idx) => (
                        <ListItem key={`${a.storageVersionId}-${idx}`} divider disableGutters sx={{ py: 1 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {prettyDate(a.anchoredAt)}
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                  <Chip size="small" label="Подтверждено" color="success" variant="outlined" />
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={verifyMutation.isPending}
                                    onClick={() => {
                                      setVerifyAnchorError(null);
                                      verifyMutation.mutate();
                                    }}
                                  >
                                    {verifyMutation.isPending ? 'Верификация…' : 'Верифицировать'}
                                  </Button>
                                </Stack>
                              </Stack>
                            }
                            secondary={
                              <Accordion disableGutters elevation={0} sx={{ mt: 0.5, '&:before': { display: 'none' } }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 32 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Показать детали
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                  <Stack spacing={0.75}>
                                    {verifyAnchorError && (
                                      <Alert severity="error" sx={{ mb: 0 }}>
                                        {verifyAnchorError}
                                      </Alert>
                                    )}
                                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                        Версия в хранилище: {maskId(a.storageVersionId)}
                                      </Typography>
                                      <Tooltip title="Скопировать">
                                        <IconButton
                                          size="small"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(a.storageVersionId ?? '');
                                            } catch {
                                              // ignore
                                            }
                                          }}
                                        >
                                          <ContentCopyIcon fontSize="inherit" />
                                        </IconButton>
                                      </Tooltip>
                                      <Button
                                        size="small"
                                        variant="text"
                                        disabled={!a.storageVersionId}
                                        onClick={() => {
                                          const v = String(a.storageVersionId ?? '').trim();
                                          if (!v) return;
                                          setPremisVersionId(v);
                                          setPremisVersionDialogOpen(true);
                                        }}
                                      >
                                        PREMIS этой версии
                                      </Button>
                                    </Stack>
                                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                        Транзакция в блокчейне: {maskId(a.blockchainTxId)}
                                      </Typography>
                                      <Tooltip title="Скопировать">
                                        <IconButton
                                          size="small"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(a.blockchainTxId ?? '');
                                            } catch {
                                              // ignore
                                            }
                                          }}
                                        >
                                          <ContentCopyIcon fontSize="inherit" />
                                        </IconButton>
                                      </Tooltip>
                                      <Button
                                        size="small"
                                        variant="text"
                                        disabled={!a.blockchainTxId}
                                        onClick={() => {
                                          const hash = String(a.blockchainTxId ?? '').trim();
                                          if (!hash) return;
                                          setTxDialogHash(hash);
                                          setTxDialogOpen(true);
                                        }}
                                      >
                                        Просмотреть данные транзакции
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </AccordionDetails>
                              </Accordion>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {anchors.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      Показаны последние 5 якорей.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h6">Метаданные</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Описательные метаданные (человекочитаемо) и PREMIS.
                    </Typography>
                  </Box>

                  {!canWrite && (
                    <Alert severity="info" sx={{ mb: 0 }}>
                      У вас нет прав на редактирование описательных метаданных (нужно право WRITE в ACL).
                    </Alert>
                  )}

                  {canWrite && !isEditing && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSaveError(null);
                          setEditValue((descriptive ?? {}) as Record<string, unknown>);
                          setIsEditing(true);
                        }}
                      >
                        Редактировать
                      </Button>
                      <Box sx={{ flex: 1 }} />
                    </Stack>
                  )}

                  {canWrite && isEditing && (
                    <Stack spacing={1.25}>
                      {saveError && (
                        <Alert severity="error" sx={{ mb: 0 }}>
                          {saveError}
                        </Alert>
                      )}

                      {schema ? (
                        <JsonSchemaForm value={editValue} schema={schema} onChange={(v) => setEditValue((v ?? {}) as Record<string, unknown>)} />
                      ) : (
                        <Alert severity="warning" sx={{ mb: 0 }}>
                          Не удалось загрузить активную схему описательных метаданных — редактирование недоступно.
                        </Alert>
                      )}

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                          variant="contained"
                          disabled={saveMutation.isPending || !schema}
                          onClick={() => {
                            setSaveError(null);
                            saveMutation.mutate();
                          }}
                        >
                          {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                        <Button
                          variant="outlined"
                          disabled={saveMutation.isPending}
                          onClick={() => {
                            setSaveError(null);
                            setIsEditing(false);
                          }}
                        >
                          Отмена
                        </Button>
                      </Stack>

                      <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2">Предпросмотр JSON</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <JsonSchemaViewer value={editValue as unknown as object} collapsed={2} />
                        </AccordionDetails>
                      </Accordion>
                    </Stack>
                  )}

                  {!isEditing && (
                    <>
                      {descriptive ? (
                        <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <MetadataTree value={descriptive} />
                        </Box>
                      ) : (
                        <Alert severity="info">Описательные метаданные отсутствуют.</Alert>
                      )}
                    </>
                  )}

                  <Divider />

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={visibilityExpanded}
                    onChange={(_, next) => {
                      setVisibilityExpanded(next);
                      if (next) {
                        setVisibilityDraft(visibility);
                        setVisibilityError(null);
                      }
                    }}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography variant="body2">Видимость</Typography>
                        <Chip size="small" variant="outlined" label={VISIBILITY_LABEL[visibility] ?? visibility} />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Настройка публичности объекта.
                        </Typography>

                        {visibilityError && (
                          <Alert severity="error" sx={{ mb: 0 }}>
                            {visibilityError}
                          </Alert>
                        )}

                        {!canWrite && (
                          <Alert severity="info" sx={{ mb: 0 }}>
                            Изменять видимость может только пользователь с правом WRITE.
                          </Alert>
                        )}

                        {canWrite && (
                          <Stack spacing={1.25}>
                            <FormControl size="small" fullWidth>
                              <InputLabel id="object-visibility">Видимость</InputLabel>
                              <Select
                                labelId="object-visibility"
                                label="Видимость"
                                value={visibilityDraft}
                                onChange={(e) => setVisibilityDraft(e.target.value as ObjectVisibility)}
                              >
                                <MenuItem value="PRIVATE">{VISIBILITY_LABEL.PRIVATE}</MenuItem>
                                <MenuItem value="PUBLIC">{VISIBILITY_LABEL.PUBLIC}</MenuItem>
                              </Select>
                            </FormControl>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Button
                                variant="contained"
                                disabled={
                                  updateVisibilityMutation.isPending ||
                                  visibilityDraft === visibility
                                }
                                onClick={() => {
                                  setVisibilityError(null);
                                  updateVisibilityMutation.mutate();
                                }}
                              >
                                {updateVisibilityMutation.isPending ? 'Сохранение…' : 'Сохранить'}
                              </Button>
                              <Button
                                variant="outlined"
                                disabled={updateVisibilityMutation.isPending}
                                onClick={() => {
                                  setVisibilityError(null);
                                  setVisibilityDraft(visibility);
                                }}
                              >
                                Сбросить
                              </Button>
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={rightsExpanded}
                    onChange={(_, next) => {
                      setRightsExpanded(next);
                      if (next) setRightsError(null);
                    }}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Rights statement</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Создание/изменение rights-statement. Текущие значения можно увидеть в PREMIS.
                        </Typography>

                        {premisQuery.isSuccess && premisQuery.data && (
                          <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="body2">Текущий rightsStatement (из PREMIS XML)</Typography>
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
                                }}
                              >
                                {extractRightsStatementXml(premisQuery.data) ?? 'rightsStatement не найден в PREMIS XML.'}
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        )}

                        {rightsError && (
                          <Alert severity="error" sx={{ mb: 0 }}>
                            {rightsError}
                          </Alert>
                        )}

                        {!canWrite && (
                          <Alert severity="info" sx={{ mb: 0 }}>
                            Изменять rights-statement может только пользователь с правом WRITE.
                          </Alert>
                        )}

                        {canWrite && (
                          <Stack spacing={1.25}>
                            <FormControlLabel
                              control={<Checkbox checked={rightsSimpleMode} onChange={(e) => setRightsSimpleMode(e.target.checked)} />}
                              label="Простой режим (рекомендуется)"
                            />

                            <FormControl size="small" fullWidth>
                              <InputLabel id="rights-basis">Rights basis</InputLabel>
                              <Select
                                labelId="rights-basis"
                                label="Rights basis"
                                value={rightsBasis}
                                onChange={(e) => setRightsBasis(e.target.value as RightsBasis)}
                              >
                                {(Object.keys(RIGHTS_BASIS_LABEL) as RightsBasis[]).map((k) => (
                                  <MenuItem key={k} value={k}>
                                    {RIGHTS_BASIS_LABEL[k]}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            <FormControl size="small" fullWidth>
                              <InputLabel id="rights-statement-id">Что редактируем</InputLabel>
                              <Select
                                labelId="rights-statement-id"
                                label="Что редактируем"
                                value={selectedExistingRightsId}
                                onChange={(e) => {
                                  const v = String(e.target.value);
                                  setSelectedExistingRightsId(v);
                                  if (v) setRightsStatementId('');
                                }}
                              >
                                <MenuItem value="">Создать новый rights-statement</MenuItem>
                                {premisRightsStatementIds.map((id) => (
                                  <MenuItem key={id} value={id}>
                                    {maskId(id, 12, 6)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            {selectedExistingRightsId ? (
                              <Alert severity="info" sx={{ mb: 0 }}>
                                Будет изменён существующий rights-statement: {selectedExistingRightsId}
                              </Alert>
                            ) : (
                              <Alert severity="info" sx={{ mb: 0 }}>
                                Будет создан новый rights-statement.
                              </Alert>
                            )}

                            {rightsSimpleMode && rightsBasis === 'COPYRIGHT' && (
                              <Stack spacing={1.25}>
                                <TextField size="small" label="Статус" value={copyrightStatus} onChange={(e) => setCopyrightStatus(e.target.value)} />
                                <TextField size="small" label="Юрисдикция" value={copyrightJurisdiction} onChange={(e) => setCopyrightJurisdiction(e.target.value)} />
                                <TextField
                                  size="small"
                                  label="Дата определения статуса (YYYY-MM-DD)"
                                  value={copyrightStatusDeterminationDate}
                                  onChange={(e) => setCopyrightStatusDeterminationDate(e.target.value)}
                                />
                                <TextField
                                  size="small"
                                  label="Примечания (по одной строке)"
                                  value={copyrightNote}
                                  onChange={(e) => setCopyrightNote(e.target.value)}
                                  multiline
                                  minRows={3}
                                />
                              </Stack>
                            )}

                            {rightsSimpleMode && rightsBasis === 'LICENSE' && (
                              <Stack spacing={1.25}>
                                <TextField size="small" label="Условия лицензии" value={licenseTerms} onChange={(e) => setLicenseTerms(e.target.value)} multiline minRows={3} />
                                <TextField size="small" label="Примечания (по одной строке)" value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} multiline minRows={3} />
                              </Stack>
                            )}

                            {rightsSimpleMode && rightsBasis === 'STATUTE' && (
                              <Stack spacing={1.25}>
                                <TextField size="small" label="Юрисдикция" value={statuteJurisdiction} onChange={(e) => setStatuteJurisdiction(e.target.value)} />
                                <TextField size="small" label="Ссылка/цитирование" value={statuteCitation} onChange={(e) => setStatuteCitation(e.target.value)} />
                                <TextField
                                  size="small"
                                  label="Дата определения (YYYY-MM-DD)"
                                  value={statuteDeterminationDate}
                                  onChange={(e) => setStatuteDeterminationDate(e.target.value)}
                                />
                                <TextField size="small" label="Примечания (по одной строке)" value={statuteNote} onChange={(e) => setStatuteNote(e.target.value)} multiline minRows={3} />
                              </Stack>
                            )}

                            {rightsSimpleMode && rightsBasis === 'OTHER' && (
                              <Stack spacing={1.25}>
                                <TextField size="small" label="Основание" value={otherRightsBasis} onChange={(e) => setOtherRightsBasis(e.target.value)} />
                                <TextField size="small" label="Примечания (по одной строке)" value={otherRightsNote} onChange={(e) => setOtherRightsNote(e.target.value)} multiline minRows={3} />
                              </Stack>
                            )}

                            {!rightsSimpleMode && (
                              <Stack spacing={1.25}>
                                <Alert severity="info" sx={{ mb: 0 }}>
                                  Расширенный режим: можно передать payload/agents напрямую JSON.
                                </Alert>
                                <TextField
                                  size="small"
                                  label="payload (JSON)"
                                  value={rightsPayloadJson}
                                  onChange={(e) => setRightsPayloadJson(e.target.value)}
                                  multiline
                                  minRows={6}
                                />
                                <TextField
                                  size="small"
                                  label="agents (JSON array)"
                                  value={rightsAgentsJson}
                                  onChange={(e) => setRightsAgentsJson(e.target.value)}
                                  multiline
                                  minRows={4}
                                />
                              </Stack>
                            )}

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Button
                                variant="contained"
                                disabled={upsertRightsMutation.isPending}
                                onClick={() => {
                                  setRightsError(null);
                                  upsertRightsMutation.mutate();
                                }}
                              >
                                {upsertRightsMutation.isPending ? 'Сохранение…' : 'Сохранить rights-statement'}
                              </Button>
                              <Button
                                variant="outlined"
                                disabled={upsertRightsMutation.isPending}
                                onClick={() => {
                                  setRightsError(null);
                                  setRightsStatementId('');
                                  setSelectedExistingRightsId('');
                                  setRightsBasis('COPYRIGHT');
                                  setRightsSimpleMode(true);
                                  setCopyrightStatus('');
                                  setCopyrightJurisdiction('');
                                  setCopyrightStatusDeterminationDate('');
                                  setCopyrightNote('');
                                  setLicenseTerms('');
                                  setLicenseNote('');
                                  setOtherRightsBasis('');
                                  setOtherRightsNote('');
                                  setStatuteJurisdiction('');
                                  setStatuteCitation('');
                                  setStatuteDeterminationDate('');
                                  setStatuteNote('');
                                  setRightsPayloadJson('');
                                  setRightsAgentsJson('');
                                }}
                              >
                                Очистить форму
                              </Button>
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={eventExpanded}
                    onChange={(_, next) => {
                      setEventExpanded(next);
                      if (next) setEventError(null);
                    }}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Событие (PREMIS event)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Создание события объекта (POST /objects/&lt;id&gt;/events). После записи событие появится в PREMIS.
                        </Typography>

                        {premisQuery.isSuccess && premisQuery.data && (
                          <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="body2">PREMIS (для сверки)</Typography>
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
                                  maxHeight: 260,
                                  overflow: 'auto',
                                }}
                              >
                                {premisQuery.data}
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        )}

                        {eventError && (
                          <Alert severity="error" sx={{ mb: 0 }}>
                            {eventError}
                          </Alert>
                        )}

                        {!canWrite && (
                          <Alert severity="info" sx={{ mb: 0 }}>
                            Записывать события может только пользователь с правом WRITE.
                          </Alert>
                        )}

                        {canWrite && (
                          <Stack spacing={1.25}>
                            <FormControlLabel
                              control={<Checkbox checked={eventSimpleMode} onChange={(e) => setEventSimpleMode(e.target.checked)} />}
                              label="Простой режим (рекомендуется)"
                            />

                            {eventSimpleMode ? (
                              <Stack spacing={1.25}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id="event-type">Тип события</InputLabel>
                                  <Select
                                    labelId="event-type"
                                    label="Тип события"
                                    value={eventType}
                                    onChange={(e) => setEventType(e.target.value as ObjectEventType)}
                                  >
                                    {(Object.keys(EVENT_TYPE_CREATE_LABEL) as ObjectEventType[]).map((k) => (
                                      <MenuItem key={k} value={k}>
                                        {EVENT_TYPE_CREATE_LABEL[k]}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>

                                <TextField
                                  size="small"
                                  label="Описание (detail)"
                                  value={eventDetail}
                                  onChange={(e) => setEventDetail(e.target.value)}
                                  multiline
                                  minRows={3}
                                  helperText="Опционально. Будет записано в EventDetailInformation.detail"
                                />

                                <FormControl size="small" fullWidth>
                                  <InputLabel id="event-outcome">Результат (outcome)</InputLabel>
                                  <Select
                                    labelId="event-outcome"
                                    label="Результат (outcome)"
                                    value={eventOutcome}
                                    onChange={(e) => setEventOutcome((e.target.value as EventOutcome) || '')}
                                  >
                                    <MenuItem value="">
                                      <em>Не указывать</em>
                                    </MenuItem>
                                    <MenuItem value="SUCCESS">SUCCESS</MenuItem>
                                    <MenuItem value="FAILURE">FAILURE</MenuItem>
                                  </Select>
                                </FormControl>

                                <TextField
                                  size="small"
                                  label="Примечание к результату (outcomeDetailNote)"
                                  value={eventOutcomeNote}
                                  onChange={(e) => setEventOutcomeNote(e.target.value)}
                                  disabled={!eventOutcome}
                                  helperText={eventOutcome ? 'Опционально.' : 'Сначала выберите outcome.'}
                                />
                              </Stack>
                            ) : (
                              <Stack spacing={1.25}>
                                <Alert severity="info" sx={{ mb: 0 }}>
                                  Расширенный режим: передайте тело запроса целиком (RecordObjectEventRequest) в JSON.
                                </Alert>
                                <TextField
                                  size="small"
                                  label="event body (JSON)"
                                  value={eventAdvancedJson}
                                  onChange={(e) => setEventAdvancedJson(e.target.value)}
                                  multiline
                                  minRows={8}
                                  placeholder={'{\n  "type": "OTHER",\n  "detail": [{"detail": "..."}],\n  "outcome": [{"outcome": "SUCCESS"}]\n}'}
                                />
                              </Stack>
                            )}

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Button
                                variant="contained"
                                disabled={recordEventMutation.isPending || (!eventSimpleMode && !eventAdvancedJson.trim())}
                                onClick={() => {
                                  setEventError(null);
                                  recordEventMutation.mutate();
                                }}
                              >
                                {recordEventMutation.isPending ? 'Сохранение…' : 'Записать событие'}
                              </Button>
                              <Button
                                variant="outlined"
                                disabled={recordEventMutation.isPending}
                                onClick={() => {
                                  setEventError(null);
                                  setEventSimpleMode(true);
                                  setEventType('OTHER');
                                  setEventDetail('');
                                  setEventOutcome('');
                                  setEventOutcomeNote('');
                                  setEventAdvancedJson('');
                                }}
                              >
                                Очистить форму
                              </Button>
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={sourceFilesExpanded}
                    onChange={(_, next) => setSourceFilesExpanded(next)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Исходные файлы</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Скачивание исходных файлов через presigned URL. Идентификаторы берутся из PREMIS (objectIdentifierType = SYSTEM).
                        </Typography>

                        {!canReadSourceFiles && (
                          <Alert severity="info" sx={{ mb: 0 }}>
                            Для выгрузки исходных файлов нужно право READ_SOURCE_FILE.
                          </Alert>
                        )}

                        {premisQuery.isLoading && sourceFilesExpanded && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                            <CircularProgress size={20} />
                          </Box>
                        )}

                        {premisQuery.isError && sourceFilesExpanded && (
                          <Alert severity="error" sx={{ mb: 0 }}>
                          {(() => {
                            const e = toUserFacingError(premisQuery.error);
                            return (
                              <>
                                {e.title}{e.description ? `: ${e.description}` : ''}
                                {debug && premisQuery.error instanceof Error ? ` (debug: ${premisQuery.error.message})` : null}
                              </>
                            );
                          })()}
                          </Alert>
                        )}

                        {canReadSourceFiles && sourceFilesExpanded && premisQuery.isSuccess && (
                          (() => {
                            if (systemSourceFiles.length === 0) {
                              return <Alert severity="info">В PREMIS не найдено исходных файлов (SYSTEM).</Alert>;
                            }

                            const presigned = presignedSourceFilesQuery.data ?? [];
                            const byId = new Map(presigned.map((x) => [x.fileId, x] as const));

                            return (
                              <Stack spacing={1}>
                                {presignedSourceFilesQuery.isLoading && (
                                  <Typography variant="caption" color="text.secondary">
                                    Получаем ссылки для скачивания…
                                  </Typography>
                                )}

                                {presignedSourceFilesQuery.isError && (
                                  <Alert severity="error" sx={{ mb: 0 }}>
                                    Не удалось получить ссылки для скачивания.
                                  </Alert>
                                )}

                                <List dense disablePadding>
                                  {systemSourceFiles.map((f) => {
                                    const pres = byId.get(f.fileId);
                                    return (
                                      <ListItem key={f.fileId} divider disableGutters sx={{ py: 1 }}>
                                        <ListItemText
                                          primary={
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                                              <Stack sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                                  {f.originalName ?? 'Файл'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                                  {f.fileId}
                                                </Typography>
                                              </Stack>
                                              <Stack direction="row" spacing={1}>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  onClick={async () => {
                                                    try {
                                                      await navigator.clipboard.writeText(f.fileId);
                                                    } catch {
                                                      // ignore
                                                    }
                                                  }}
                                                >
                                                  Copy id
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant="contained"
                                                  disabled={!pres?.downloadUrl}
                                                  onClick={() => {
                                                    if (!pres?.downloadUrl) return;
                                                    window.open(pres.downloadUrl, '_blank', 'noopener,noreferrer');
                                                  }}
                                                >
                                                  Скачать
                                                </Button>
                                              </Stack>
                                            </Stack>
                                          }
                                          secondary={pres?.expiresAt ? `URL истекает: ${prettyDate(pres.expiresAt)}` : 'URL ещё не получен.'}
                                        />
                                      </ListItem>
                                    );
                                  })}
                                </List>
                              </Stack>
                            );
                          })()
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={aclExpanded}
                    onChange={(_, next) => setAclExpanded(next)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Доступ (ACL)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Управление доступом пользователей к объекту.
                        </Typography>

                        {aclError && (
                          <Alert severity="error" sx={{ mb: 0 }}>
                            {aclError}
                          </Alert>
                        )}

                        <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Текущие записи</Typography>
                            {(data?.acl?.entries ?? []).length === 0 ? (
                              <Alert severity="info" sx={{ mb: 0 }}>
                                ACL пуст.
                              </Alert>
                            ) : (
                              <List dense disablePadding>
                                {(data?.acl?.entries ?? []).map((e, idx) => (
                                  <ListItem key={`${e.principal?.id ?? idx}-${idx}`} divider disableGutters>
                                    <ListItemText
                                      primary={
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                                            <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                                              U
                                            </Avatar>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                              {formatAclEntryTitle(e)}
                                            </Typography>
                                          </Stack>
                                          <Stack direction="row" spacing={0.75}>
                                            {(e.permissions ?? []).map((p) => (
                                              <Chip key={p} size="small" variant="outlined" label={p} />
                                            ))}
                                          </Stack>
                                        </Stack>
                                      }
                                      secondary={e.role ? `role: ${e.role}` : undefined}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            )}
                          </Stack>
                        </Box>

                        {!canWrite && (
                          <Alert severity="info" sx={{ mb: 0 }}>
                            Редактировать ACL может только пользователь с правом WRITE.
                          </Alert>
                        )}

                        {canWrite && (
                          <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Stack spacing={1.25}>
                              <Typography variant="subtitle2">Добавить/обновить доступ</Typography>

                              <TextField
                                size="small"
                                label="Username"
                                value={aclUsername}
                                onChange={(e) => {
                                  setAclUsername(e.target.value);
                                  setAclSelectedUserId(null);
                                }}
                                helperText="Начните вводить username — подтянем пользователей из Keycloak"
                              />

                              {userSearchQuery.isLoading && (
                                <Typography variant="caption" color="text.secondary">
                                  Ищем пользователей…
                                </Typography>
                              )}

                              {userSearchQuery.isError && (
                                <Alert severity="error" sx={{ mb: 0 }}>
                                  Не удалось выполнить поиск пользователей.
                                </Alert>
                              )}

                              {userSearchQuery.isSuccess && aclUsername.trim().length >= 2 && (
                                <FormControl size="small" fullWidth>
                                  <InputLabel id="acl-user-select">Пользователь</InputLabel>
                                  <Select
                                    labelId="acl-user-select"
                                    label="Пользователь"
                                    value={aclSelectedUserId ?? ''}
                                    onChange={(e) => setAclSelectedUserId(String(e.target.value) || null)}
                                  >
                                    <MenuItem value="">
                                      <em>—</em>
                                    </MenuItem>
                                    {(userSearchQuery.data ?? []).map((u) => (
                                      <MenuItem key={u.id ?? u.username} value={u.id ?? ''}>
                                        {u.username ?? '—'} ({u.id ?? 'no-id'})
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}

                              {userSearchQuery.isSuccess && aclUsername.trim().length >= 2 && (userSearchQuery.data ?? []).length === 0 && (
                                <Alert severity="info" sx={{ mb: 0 }}>
                                  Пользователи не найдены.
                                </Alert>
                              )}

                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <FormControlLabel
                                  control={<Checkbox checked={aclPermRead} onChange={(e) => setAclPermRead(e.target.checked)} />}
                                  label="READ"
                                />
                                <FormControlLabel
                                  control={<Checkbox checked={aclPermWrite} onChange={(e) => setAclPermWrite(e.target.checked)} />}
                                  label="WRITE"
                                />
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={aclPermReadSource}
                                      onChange={(e) => setAclPermReadSource(e.target.checked)}
                                    />
                                  }
                                  label="READ_SOURCE_FILE"
                                />
                              </Stack>

                              <Button
                                variant="contained"
                                disabled={upsertAclMutation.isPending || !aclSelectedUserId}
                                onClick={() => {
                                  setAclError(null);
                                  upsertAclMutation.mutate();
                                }}
                              >
                                {upsertAclMutation.isPending ? 'Сохранение…' : 'Сохранить доступ'}
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={premisExpanded}
                    onChange={(_, next) => setPremisExpanded(next)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">PREMIS (подробно)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {premisQuery.isLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                          <CircularProgress size={20} />
                        </Box>
                      )}

                      {premisQuery.isError && (
                        <Alert severity="error" sx={{ mb: 0 }}>
                          {(() => {
                            const e = toUserFacingError(premisQuery.error);
                            return (
                              <>
                                {e.title}{e.description ? `: ${e.description}` : ''}
                                {debug && premisQuery.error instanceof Error ? ` (debug: ${premisQuery.error.message})` : null}
                              </>
                            );
                          })()}
                        </Alert>
                      )}

                      {premisQuery.isSuccess && premisQuery.data && <PremisXmlViewer xml={premisQuery.data} />}
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h6">Статистика событий</Typography>
                    <Typography variant="body2" color="text.secondary">
                      События по объекту за выбранный период.
                    </Typography>
                  </Box>

                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={statsExpanded}
                    onChange={(_, next) => setStatsExpanded(next)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Показать графики</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                          <FormControl size="small" fullWidth>
                            <InputLabel id="stats-period">Период</InputLabel>
                            <Select
                              labelId="stats-period"
                              label="Период"
                              value={statsPeriod}
                              onChange={(e) => setStatsPeriod(e.target.value as '7d' | '30d' | '90d')}
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
                              value={statsEventType}
                              onChange={(e) => setStatsEventType(e.target.value as StatisticsEventType | 'ALL')}
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

                        {statsQuery.isLoading && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={20} />
                          </Box>
                        )}

                        {statsQuery.isError && (
                          <Alert severity="error" sx={{ mb: 0 }}>
                            {(() => {
                              const e = toUserFacingError(statsQuery.error);
                              return (
                                <>
                                  {e.title}{e.description ? `: ${e.description}` : ''}
                                  {debug && statsQuery.error instanceof Error ? ` (debug: ${statsQuery.error.message})` : null}
                                </>
                              );
                            })()}
                          </Alert>
                        )}

                        {statsQuery.isSuccess && (
                          (() => {
                            const events = statsQuery.data ?? [];

                            // by day
                            const byDay = new Map<string, number>();
                            for (const ev of events) {
                              const ts = ev.timestamp ? new Date(ev.timestamp) : null;
                              const key = ts && !Number.isNaN(ts.getTime()) ? formatYmd(ts) : 'unknown';
                              byDay.set(key, (byDay.get(key) ?? 0) + 1);
                            }
                            // Fill missing days with 0 to make timeline continuous.
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

                            // Aggregate to avoid horizontal scrollbar and keep chart readable.
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

                            // by type
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
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </CardContent>
            </Card>

            {debug && (
              <Card variant="outlined">
                <CardContent>
                  <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Диагностика</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        <Typography variant="caption" color="text.secondary">
                          objectId: {objectId}
                        </Typography>

                        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2">Raw JSON ответа</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box
                              component="pre"
                              sx={{
                                p: 1.5,
                                m: 0,
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: 12,
                              }}
                            >
                              {JSON.stringify(data, null, 2)}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog
          open={txDialogOpen}
          onClose={() => setTxDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Данные транзакции</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                txHash: {txDialogHash || '—'}
              </Typography>

              {txQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={22} />
                </Box>
              )}

              {txQuery.isError && (
                <Alert severity="error" sx={{ mb: 0 }}>
                  {(() => {
                    const e = toUserFacingError(txQuery.error);
                    return (
                      <>
                        {e.title}{e.description ? `: ${e.description}` : ''}
                        {debug && txQuery.error instanceof Error ? ` (debug: ${txQuery.error.message})` : null}
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
                        <b>time:</b>{' '}
                        {txBlockQuery.data?.timestamp
                          ? formatUnixSecondsHexToLocal(txBlockQuery.data.timestamp)
                          : effectiveBlockNumber
                            ? 'Загрузка времени блока…'
                            : 'pending (ещё не в блоке)'}
                      </Typography>
                      <Typography variant="body2">
                        <b>from:</b> {txQuery.data.from}
                      </Typography>
                      <Typography variant="body2">
                        <b>to:</b> {txQuery.data.to ?? '—'}
                      </Typography>
                      <Typography variant="body2">
                        <b>nonce:</b> {String(txQuery.data.nonce)}
                      </Typography>
                      <Typography variant="body2">
                        <b>value (wei):</b> {txQuery.data.value}
                      </Typography>
                      <Typography variant="body2">
                        <b>gas:</b> {txQuery.data.gas}
                      </Typography>
                      <Typography variant="body2">
                        <b>gasPrice:</b> {txQuery.data.gasPrice ?? '—'}
                      </Typography>
                      <Typography variant="body2">
                        <b>maxFeePerGas:</b> {txQuery.data.maxFeePerGas ?? '—'}
                      </Typography>
                      <Typography variant="body2">
                        <b>maxPriorityFeePerGas:</b> {txQuery.data.maxPriorityFeePerGas ?? '—'}
                      </Typography>
                      <Typography variant="body2">
                        <b>blockNumber:</b> {effectiveBlockNumber ?? '—'}
                      </Typography>
                    </Stack>
                  </Box>

                  <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Decoded input</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {(() => {
                        const decoded = decodeHexJsonInput(txQuery.data.input);
                        if (decoded.kind === 'empty') return <Typography variant="body2">Нет input (0x)</Typography>;
                        if (decoded.kind === 'invalid') {
                          return (
                            <Typography variant="body2" color="text.secondary">
                              Не удалось декодировать input как hex-encoded UTF-8/JSON.
                            </Typography>
                          );
                        }

                        return (
                          <Stack spacing={1}>
                            <Typography variant="body2">
                              <b>text:</b>
                            </Typography>
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
                                maxHeight: 180,
                                overflow: 'auto',
                              }}
                            >
                              {decoded.text || '—'}
                            </Box>

                            {decoded.json !== null && (
                              <>
                                <Typography variant="body2">
                                  <b>json:</b>
                                </Typography>
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
                                    maxHeight: 220,
                                    overflow: 'auto',
                                  }}
                                >
                                  {safeJsonStringify(decoded.json)}
                                </Box>
                              </>
                            )}
                          </Stack>
                        );
                      })()}

                      <Box
                        component="pre"
                        sx={{
                          p: 1.25,
                          mt: 1.25,
                          m: 0,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: 12,
                          maxHeight: 220,
                          overflow: 'auto',
                        }}
                      >
                        {txQuery.data.input}
                      </Box>
                    </AccordionDetails>
                  </Accordion>

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
                        {safeJsonStringify(txQuery.data)}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </>
              )}

              {!txDialogHash && (
                <Alert severity="warning" sx={{ mb: 0 }}>
                  Не задан hash транзакции.
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(txDialogHash);
                } catch {
                  // ignore
                }
              }}
              disabled={!txDialogHash}
            >
              Скопировать hash
            </Button>
            <Button variant="contained" onClick={() => setTxDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={premisVersionDialogOpen}
          onClose={() => setPremisVersionDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>PREMIS метаданные версии</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                versionId: {premisVersionId || '—'}
              </Typography>

              {premisVersionQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              )}

              {premisVersionQuery.isError && (
                <Alert severity="error" sx={{ mb: 0 }}>
                  {(() => {
                    const e = toUserFacingError(premisVersionQuery.error);
                    return (
                      <>
                        {e.title}{e.description ? `: ${e.description}` : ''}
                        {debug && premisVersionQuery.error instanceof Error ? ` (debug: ${premisVersionQuery.error.message})` : null}
                      </>
                    );
                  })()}
                </Alert>
              )}

              {premisVersionQuery.isSuccess && (
                <>{premisVersionQuery.data ? <PremisXmlViewer xml={premisVersionQuery.data} /> : null}</>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              onClick={() => {
                setPremisVersionDialogOpen(false);
              }}
            >
              Закрыть
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}
