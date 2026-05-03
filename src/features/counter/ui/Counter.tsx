import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

export function Counter() {
  const [value, setValue] = useState(0);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Button variant="contained" onClick={() => setValue((v) => v - 1)}>
        -
      </Button>
      <Typography>Counter: {value}</Typography>
      <Button variant="contained" onClick={() => setValue((v) => v + 1)}>
        +
      </Button>
    </Box>
  );
}
