import { Building2, CalendarDays, LayoutGrid, Menu, Users } from 'lucide-react';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, Route } from 'react-router-dom';
import { TabLayout } from '@/components/layout/TabBar';
import { CabinetMarker, RequireSalon } from '../guards';

const DashboardPage = lazy(() => import('@/pages/salon/DashboardPage'));
const SchedulePage = lazy(() => import('@/pages/salon/SchedulePage'));
const MastersPage = lazy(() => import('@/pages/salon/MastersPage'));
const InviteMasterPage = lazy(() => import('@/pages/salon/InviteMasterPage'));
const ClientsPage = lazy(() => import('@/pages/salon/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/pages/salon/ClientDetailPage'));
const MenuPage = lazy(() => import('@/pages/salon/MenuPage'));
const ServicesPage = lazy(() => import('@/pages/salon/ServicesPage'));
const ReviewsPage = lazy(() => import('@/pages/salon/ReviewsPage'));
const AnalyticsPage = lazy(() => import('@/pages/salon/AnalyticsPage'));
const PromotionsPage = lazy(() => import('@/pages/salon/PromotionsPage'));
const BroadcastPage = lazy(() => import('@/pages/salon/BroadcastPage'));
const SubscriptionPage = lazy(() => import('@/pages/salon/SubscriptionPage'));
const ProfileSettingsPage = lazy(() => import('@/pages/salon/ProfileSettingsPage'));
const ThemePage = lazy(() => import('@/pages/salon/ThemePage'));

function SalonTabs() {
  const { t } = useTranslation();
  return (
    <TabLayout
      layoutId="salon-tab"
      items={[
        { to: '/salon', label: t('nav.dashboard'), icon: LayoutGrid, end: true },
        { to: '/salon/schedule', label: t('nav.schedule'), icon: CalendarDays },
        { to: '/salon/masters', label: t('nav.masters'), icon: Building2 },
        { to: '/salon/clients', label: t('nav.clients'), icon: Users },
        { to: '/salon/menu', label: t('nav.more'), icon: Menu },
      ]}
    />
  );
}

export const salonRoutes = (
  <Route
    path="/salon"
    element={
      <RequireSalon>
        <CabinetMarker cabinet="salon">
          <Outlet />
        </CabinetMarker>
      </RequireSalon>
    }
  >
    <Route element={<SalonTabs />}>
      <Route index element={<DashboardPage />} />
      <Route path="schedule" element={<SchedulePage />} />
      <Route path="masters" element={<MastersPage />} />
      <Route path="clients" element={<ClientsPage />} />
      <Route path="menu" element={<MenuPage />} />
    </Route>
    <Route path="masters/invite" element={<InviteMasterPage />} />
    <Route path="clients/:id" element={<ClientDetailPage />} />
    <Route path="services" element={<ServicesPage />} />
    <Route path="reviews" element={<ReviewsPage />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="promotions" element={<PromotionsPage />} />
    <Route path="broadcast" element={<BroadcastPage />} />
    <Route path="subscription" element={<SubscriptionPage />} />
    <Route path="profile" element={<ProfileSettingsPage />} />
    <Route path="theme" element={<ThemePage />} />
  </Route>
);
