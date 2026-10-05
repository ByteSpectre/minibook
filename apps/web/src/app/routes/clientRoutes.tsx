import { CalendarDays, Search, UserRound } from 'lucide-react';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Route } from 'react-router-dom';
import { TabLayout } from '@/components/layout/TabBar';
import { useMyAppointments } from '@/api/clientApi';
import { CabinetMarker, RequireClient } from '../guards';

const HomePage = lazy(() => import('@/pages/client/HomePage'));
const SearchPage = lazy(() => import('@/pages/client/SearchPage'));
const SearchMapPage = lazy(() => import('@/pages/client/SearchMapPage'));
const CalendarPage = lazy(() => import('@/pages/client/CalendarPage'));
const ProfilePage = lazy(() => import('@/pages/client/ProfilePage'));

function ClientLayout() {
  const { t } = useTranslation();
  const appointments = useMyAppointments();
  return (
    <TabLayout
      layoutId="client-tab"
      items={[
        { to: '/client', label: t('nav.search'), icon: Search, match: ['/client/search'] },
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
  </Route>
);
