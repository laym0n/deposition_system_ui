import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@shared/auth/useAuth';
import { getInitials, getSimpleUserProfile } from '@shared/auth/userProfile';
import { useIsAdmin } from '@shared/auth/useIsAdmin';

export function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  const profile = useMemo(() => getSimpleUserProfile(auth.user), [auth.user]);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(anchorEl);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} color="default" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                onClick={() => void navigate({ to: '/' })}
                sx={{ cursor: 'pointer', userSelect: 'none', minWidth: 0 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                  Система депонирования
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {auth.isLoading ? 'Проверяем вход…' : auth.isAuthenticated ? 'Вы вошли' : 'Гостевой режим'}
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }} />

              {auth.isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Загрузка…
                </Typography>
              ) : auth.isAuthenticated ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }} noWrap>
                    {profile?.displayName}
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    aria-label="Меню пользователя"
                    aria-controls={isMenuOpen ? 'user-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen ? 'true' : undefined}
                  >
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {getInitials(profile?.displayName ?? 'U')}
                    </Avatar>
                  </IconButton>

                  <Menu
                    id="user-menu"
                    anchorEl={anchorEl}
                    open={isMenuOpen}
                    onClose={() => setAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <Box sx={{ px: 2, py: 1 }}>
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ width: 36, height: 36 }}>
                          {getInitials(profile?.displayName ?? 'U')}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {profile?.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {profile?.email ?? profile?.preferredUsername ?? ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null);
                        void navigate({ to: '/profile' });
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <AccountCircleIcon fontSize="small" />
                        <Typography variant="body2">Профиль</Typography>
                      </Stack>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null);
                        void navigate({ to: '/jobs' });
                      }}
                    >
                      <Typography variant="body2">Мои депонирования</Typography>
                    </MenuItem>

                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null);
                        void navigate({ to: '/deposition/available' });
                      }}
                    >
                      <Typography variant="body2">Доступные объекты депонирования</Typography>
                    </MenuItem>

                    {isAdmin && (
                      <MenuItem
                        onClick={() => {
                          setAnchorEl(null);
                          void navigate({ to: '/deposition/object-types' });
                        }}
                      >
                        <Typography variant="body2">Управление типами объектов депонирования</Typography>
                      </MenuItem>
                    )}

                    {isAdmin && (
                      <MenuItem
                        onClick={() => {
                          setAnchorEl(null);
                          void navigate({ to: '/descriptive-metadata/schemas' });
                        }}
                      >
                        <Typography variant="body2">Управление схемами</Typography>
                      </MenuItem>
                    )}
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null);
                        void auth.logout();
                      }}
                    >
                      <Typography variant="body2" color="error.main">
                        Выйти
                      </Typography>
                    </MenuItem>
                  </Menu>
                </Stack>
              ) : (
                <Button size="small" variant="contained" onClick={() => void auth.login()}>
                  Войти
                </Button>
              )}
            </Box>
          </Container>
        </Toolbar>
      </AppBar>

      {/* Pages keep their own Container/maxWidth; here we only provide a global header */}
      <Box sx={{ py: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
