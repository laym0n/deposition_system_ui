import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { oidcUserManager } from '@shared/auth/oidc';
import { isDebugEnabled } from '@shared/ui';

export function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const debug = isDebugEnabled();

  useEffect(() => {
    oidcUserManager
      .signinRedirectCallback()
      .then(() => {
        window.location.replace('/');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        try {
          // help diagnose auth issues in dev (state lost, wrong origin, etc.)
          setErrorDetails(JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
          // also log to console for copy/paste
          // eslint-disable-next-line no-console
          console.error('OIDC signinRedirectCallback error', e);
        } catch {
          setErrorDetails(String(e));
        }
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
          <Alert severity="error">
            Не удалось завершить вход. Попробуйте обновить страницу или повторить вход позже.

            {debug && error && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                Детали (debug): {error}
              </Typography>
            )}

            {debug && errorDetails && (
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', mt: 1, mb: 0, fontSize: 12 }}>
                {errorDetails}
              </Box>
            )}
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
