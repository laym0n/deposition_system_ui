import React, { useMemo } from 'react';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import { useAuth } from '@shared/auth/useAuth';
import { getSimpleUserProfile } from '@shared/auth/userProfile';
import { isDebugEnabled } from '@shared/ui';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function ProfilePage() {
  const auth = useAuth();
  const profile = useMemo(() => getSimpleUserProfile(auth.user), [auth.user]);

  const debug = isDebugEnabled();

  if (auth.isLoading) {
    return (
      <Alert severity="info">
        Загружаем данные пользователя…
      </Alert>
    );
  }

  if (!auth.isAuthenticated) {
    return <Alert severity="warning">Вы не авторизованы.</Alert>;
  }

  const rawProfile = (auth.user as unknown as { profile?: unknown }).profile;
  const rawProfilePretty = isPlainRecord(rawProfile) ? rawProfile : null;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5">Профиль</Typography>
        <Typography variant="body2" color="text.secondary">
          Основные данные вашей учётной записи.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ minWidth: 220 }}>
                <Typography variant="caption" color="text.secondary">
                  Имя
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {profile?.displayName}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 220 }}>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body2">{profile?.email ?? '—'}</Typography>
              </Box>
              <Box sx={{ minWidth: 220 }}>
                <Typography variant="caption" color="text.secondary">
                  Username
                </Typography>
                <Typography variant="body2">{profile?.preferredUsername ?? '—'}</Typography>
              </Box>
            </Stack>

            <Divider />

            {debug && (
              <>
                <Divider />

                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle2">Диагностика</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Данные из OIDC токена (показываются только в режиме debug).
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" href={window.location.pathname}>
                      Выключить debug
                    </Button>
                  </Stack>
                </Box>

                {rawProfilePretty ? (
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
                    {JSON.stringify(rawProfilePretty, null, 2)}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mb: 0 }}>
                    Profile отсутствует или имеет неожиданный формат.
                  </Alert>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
