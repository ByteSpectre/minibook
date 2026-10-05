import { CalendarDays, LayoutGrid, Search, UserRound } from 'lucide-react';
import { lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Route } from 'react-router-dom';
import { TabLayout } from '@/components/layout/TabBar';
import { useMyAppointments } from '@/api/clientApi';
import { CabinetMarker, RequireClient } from '../guards';
import CalendarPage from '@/pages/client/CalendarPage';
import HomePage from '@/pages/client/HomePage';
import ProfilePage from '@/pages/client/ProfilePage';
import SearchPage from '@/pages/client/SearchPage';

const SearchMapPage = lazy(() => import('@/pages/client/SearchMapPage'));
const MastersPage = lazy(() => import('@/pages/client/MastersPage'));
const AccountPage = lazy(() => import('@/pages/client/AccountPage'));

function ClientLayout() {
  const { t } = useTranslation();
  const appointments = useMyAppointments();

  useEffect(() => {
    void import('@/pages/client/SearchMapPage');
    void import('@/pages/client/MastersPage');
    void import('@/pages/client/AccountPage');
  }, []);

  return (
    <TabLayout
      layoutId="client-tab"
      items={[
        { to: '/client', label: t('nav.menu'), icon: LayoutGrid, end: true },
        { to: '/client/search', label: t('nav.search'), icon: Search, match: ['/client/search'] },
        {
          to: '/client/calendar',
          label: t('nav.calendar'),
          icon: CalendarDays,
          badge: appointments.data?.upcoming.length,
        },
        { to: '/client/profile', label: t('nav.profile'), icon: UserRound },
      ]}
    />
  );
}

export const clientRoutes = (
  <Route
    path="/client"
    element={
      <RequireClient>
        <CabinetMarker cabinet="client">
          <ClientLayout />
        </CabinetMarker>
      </RequireClient>
    }
  >
    <Route index element={<HomePage />} />
    <Route path="search" element={<SearchPage />} />
    <Route path="search/map" element={<SearchMapPage />} />
    <Route path="calendar" element={<CalendarPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="masters" element={<MastersPage />} />
    <Route path="account" element={<AccountPage />} />
  </Route>
);
