import { useMemo } from 'react';
import { Alert, Box, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { useAuth } from '@shared/auth/useAuth';
import { getSimpleUserProfile } from '@shared/auth/userProfile';

export function ProfilePage() {
  const auth = useAuth();
  const profile = useMemo(() => getSimpleUserProfile(auth.user), [auth.user]);

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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
