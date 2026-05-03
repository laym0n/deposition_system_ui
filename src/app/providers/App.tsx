import React from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from './router/RouterProvider';
import { queryClient } from './queryClient';
import { appTheme } from './theme';
import { AuthProvider } from '@shared/auth/AuthContext';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
          <RouterProvider />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


