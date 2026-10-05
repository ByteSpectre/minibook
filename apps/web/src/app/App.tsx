import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from '@/api/queryClient';
import { AppShell } from '@/components/layout/AppShell';
import { AppRoutes } from './AppRoutes';
import { Bootstrap } from './Bootstrap';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Bootstrap>
            <AppRoutes />
          </Bootstrap>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
