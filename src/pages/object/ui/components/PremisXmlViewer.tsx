import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

type XmlTreeNode = {
  name: string;
  attributes?: Record<string, string>;
  text?: string;
  children?: XmlTreeNode[];
};

function parseXmlToTree(xml: string): XmlTreeNode | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) return null;

    const root = doc.documentElement;

    const toNode = (el: Element): XmlTreeNode => {
      const attrs: Record<string, string> = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes.item(i);
        if (!a) continue;
        attrs[a.name] = a.value;
      }

      const childrenEls = Array.from(el.childNodes).filter((n) => n.nodeType === Node.ELEMENT_NODE) as Element[];
      const textNodes = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? '').trim())
        .filter(Boolean);
      const text = textNodes.join(' ');

      return {
        name: el.localName || el.nodeName,
        attributes: Object.keys(attrs).length ? attrs : undefined,
        text: text.length ? text : undefined,
        children: childrenEls.length ? childrenEls.map(toNode) : undefined,
      };
    };

    return toNode(root);
  } catch {
    return null;
  }
}

function NodeSummary(props: { node: XmlTreeNode }) {
  const { node } = props;
  const attrs = node.attributes ?? {};
  const keys = Object.keys(attrs);

  const picked = keys
    .filter((k) => ['xmlID', 'xsi:type', 'version', 'simpleLink'].includes(k))
    .slice(0, 3)
    .map((k) => `${k}=${attrs[k]}`);

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
        {node.name}
      </Typography>
      {picked.length > 0 && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {picked.join(' ')}
        </Typography>
      )}
      {node.text && !node.children?.length && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 1 }}>
          {node.text}
        </Typography>
      )}
    </Stack>
  );
}

function XmlTreeView(props: { node: XmlTreeNode; defaultExpandedDepth?: number; depth?: number }) {
  const { node, defaultExpandedDepth = 2, depth = 0 } = props;
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);

  return (
    <Box sx={{ pl: depth === 0 ? 0 : 2 }}>
      <Box
        onClick={() => {
          if (!hasChildren) return;
          setExpanded((v) => !v);
        }}
        sx={{
          cursor: hasChildren ? 'pointer' : 'default',
          userSelect: 'none',
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {hasChildren && (
          <Typography variant="caption" color="text.secondary" sx={{ width: 14, textAlign: 'center' }}>
            {expanded ? '▾' : '▸'}
          </Typography>
        )}
        {!hasChildren && <Box sx={{ width: 14 }} />}
        <NodeSummary node={node} />
      </Box>

      {hasChildren && expanded && (
        <Box>
          {node.children!.map((c, idx) => (
            <XmlTreeView key={`${c.name}-${idx}`} node={c} defaultExpandedDepth={defaultExpandedDepth} depth={depth + 1} />
          ))}
        </Box>
      )}
    </Box>
  );
}

export function PremisXmlViewer(props: { xml: string }) {
  const { xml } = props;
  const [mode, setMode] = useState<'tree' | 'raw'>('tree');
  const tree = useMemo(() => parseXmlToTree(xml), [xml]);

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next) => {
            if (!next) return;
            setMode(next);
          }}
        >
          <ToggleButton value="tree">Дерево</ToggleButton>
          <ToggleButton value="raw">Исходный XML</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          variant="outlined"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(xml);
            } catch {
              // ignore
            }
          }}
        >
          Скопировать
        </Button>
      </Stack>

      {mode === 'tree' && (
        <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {tree ? (
            <XmlTreeView node={tree} defaultExpandedDepth={2} />
          ) : (
            <Alert severity="warning" sx={{ mb: 0 }}>
              Не удалось разобрать XML (tree view недоступен).
            </Alert>
          )}
        </Box>
      )}

      {mode === 'raw' && (
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
            maxHeight: 520,
            overflow: 'auto',
          }}
        >
          {xml}
        </Box>
      )}
    </Stack>
  );
}
