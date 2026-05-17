import React from 'react';
import { Box } from '@mui/material';
import ReactJsonView from '@uiw/react-json-view';

export function JsonSchemaViewer(props: {
  value: object;
  collapsed?: number | boolean;
}) {
  const { value, collapsed = 1 } = props;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 1,
        overflow: 'auto',
        bgcolor: 'background.paper',

        // @uiw/react-json-view colors via CSS variables
        // (defaults are for light theme, so we override for our dark MUI theme)
        '--w-rjv-font-family':
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        '--w-rjv-background-color': 'transparent',
        '--w-rjv-line-color': 'rgba(148, 163, 184, 0.18)',
        '--w-rjv-color': 'rgba(226, 232, 240, 0.92)',
        '--w-rjv-key-string': 'rgba(226, 232, 240, 0.92)',
        '--w-rjv-arrow-color': 'rgba(148, 163, 184, 0.9)',
        '--w-rjv-info-color': 'rgba(148, 163, 184, 0.9)',
        '--w-rjv-curlybraces-color': 'rgba(148, 163, 184, 0.95)',
        '--w-rjv-brackets-color': 'rgba(148, 163, 184, 0.95)',
        '--w-rjv-colon-color': 'rgba(148, 163, 184, 0.95)',
        '--w-rjv-quotes-color': 'rgba(148, 163, 184, 0.95)',
        '--w-rjv-type-string-color': '#a5d6ff',
        '--w-rjv-type-int-color': '#79c0ff',
        '--w-rjv-type-float-color': '#79c0ff',
        '--w-rjv-type-boolean-color': '#ffab70',
        '--w-rjv-type-null-color': '#ff7b72',
        '--w-rjv-type-undefined-color': '#79c0ff',
      }}
    >
      <ReactJsonView value={value} collapsed={collapsed} displayDataTypes={false} enableClipboard={true} indentWidth={2} />
    </Box>
  );
}
