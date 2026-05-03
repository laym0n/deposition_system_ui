import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { oidcUserManager } from '@shared/auth/oidc';

export function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    oidcUserManager
      .signinRedirectCallback()
      .then(() => {
        window.location.replace('/');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5">Вход...</Typography>

        {!error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error">Не удалось завершить вход: {error}</Alert>
        )}
      </Stack>
    </Container>
  );
}
