import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

type JsonSchemaLike = {
  title?: string;
  description?: string;
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
};

function toTypeLabel(schema: JsonSchemaLike | undefined): string {
  const t = schema?.type;
  if (!t) return '—';
  if (Array.isArray(t)) return t.join(' | ');
  return t;
}

type SchemaTreeNode = {
  id: string;
  path: string;
  type: string;
  required: boolean;
  description: string;
  children?: SchemaTreeNode[];
};

function buildSchemaTree(schema: JsonSchemaLike | null | undefined): SchemaTreeNode[] {
  const root = schema ?? undefined;
  if (!root) return [];

  function mkId(path: string) {
    return path || '<root>';
  }

  function toNode(node: JsonSchemaLike | undefined, path: string, name: string, requiredInParent: Set<string> | null): SchemaTreeNode | null {
    if (!node) return null;
    const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];

    const out: SchemaTreeNode = {
      id: mkId(path),
      path,
      type: toTypeLabel(node),
      required: name ? Boolean(requiredInParent?.has(name)) : false,
      description: node.description ?? node.title ?? '',
    };

    const children: SchemaTreeNode[] = [];

    if (types.includes('object')) {
      const req = new Set(node.required ?? []);
      for (const [k, v] of Object.entries(node.properties ?? {})) {
        const nextPath = path ? `${path}.${k}` : k;
        const childNode = toNode(v, nextPath, k, req);
        if (childNode) children.push(childNode);
      }
    }

    if (types.includes('array')) {
      const itemsPath = path ? `${path}[]` : '[]';
      const itemsNode = toNode(node.items, itemsPath, 'items', null);
      children.push(
        itemsNode ?? {
          id: mkId(itemsPath),
          path: itemsPath,
          type: '—',
          required: false,
          description: '',
        },
      );
    }

    if (children.length) out.children = children;
    return out;
  }

  // Root level: show top-level properties if root is object.
  const rootTypes = Array.isArray(root.type) ? root.type : root.type ? [root.type] : [];
  if (!rootTypes.includes('object')) {
    const asNode = toNode(root, '', '<root>', null);
    return asNode ? [asNode] : [];
  }

  const req = new Set(root.required ?? []);
  const result: SchemaTreeNode[] = [];
  for (const [k, v] of Object.entries(root.properties ?? {})) {
    const n = toNode(v, k, k, req);
    if (n) result.push(n);
  }
  return result;
}

function indentSx(level: number) {
  return { pl: level * 3 };
}

function nestedRowSx(level: number) {
  if (level <= 0) return undefined;
  return {
    backgroundColor: 'action.hover',
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

export type JsonSchemaFieldsTableProps = {
  /** JSON Schema object. Component is tolerant to unknown input. */
  schema: unknown;
  emptyMessage?: React.ReactNode;
};

export function JsonSchemaFieldsTable(props: JsonSchemaFieldsTableProps) {
  const { schema, emptyMessage } = props;
  const tree = useMemo(() => buildSchemaTree(schema as JsonSchemaLike), [schema]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  function toggleExpanded(id: string) {
    setExpandedNodeIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function isExpanded(id: string) {
    return Boolean(expandedNodeIds[id]);
  }

  function renderRows(nodes: SchemaTreeNode[], level: number): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    for (const n of nodes) {
      const hasChildren = Boolean(n.children && n.children.length);
      const expanded = hasChildren ? isExpanded(n.id) : false;

      out.push(
        <TableRow key={n.id} hover sx={nestedRowSx(level)}>
          <TableCell sx={{ width: 44 }}>
            <Box sx={indentSx(level)}>
              {hasChildren ? (
                <IconButton
                  size="small"
                  aria-label={expanded ? 'collapse-node' : 'expand-node'}
                  onClick={() => toggleExpanded(n.id)}
                >
                  {expanded ? <KeyboardArrowDownIcon fontSize="inherit" /> : <KeyboardArrowRightIcon fontSize="inherit" />}
                </IconButton>
              ) : null}
            </Box>
          </TableCell>
          <TableCell sx={{ fontFamily: 'monospace' }}>{n.path}</TableCell>
          <TableCell>{n.type}</TableCell>
          <TableCell>{n.required ? 'Да' : 'Нет'}</TableCell>
          <TableCell>{n.description || '—'}</TableCell>
        </TableRow>,
      );

      if (!hasChildren || !expanded) continue;
      out.push(...renderRows(n.children ?? [], level + 1));
    }
    return out;
  }

  if (tree.length === 0) {
    return <Alert severity="info">{emptyMessage ?? 'В схеме нет описанных полей (properties).'}</Alert>;
  }

  return (
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
            <TableCell sx={{ fontWeight: 700 }}>Путь</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Тип</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 130 }}>Обязательное</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Описание</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{renderRows(tree, 0)}</TableBody>
      </Table>
    </TableContainer>
  );
}
