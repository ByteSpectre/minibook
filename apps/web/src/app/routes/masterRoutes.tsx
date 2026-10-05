import { CalendarDays, LayoutGrid, UserRound, Users } from 'lucide-react';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, Route } from 'react-router-dom';
import { TabLayout } from '@/components/layout/TabBar';
import { CabinetMarker, RequireMaster } from '../guards';

const DashboardPage = lazy(() => import('@/pages/master/DashboardPage'));
const SchedulePage = lazy(() => import('@/pages/master/SchedulePage'));
const ClientsPage = lazy(() => import('@/pages/master/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/pages/master/ClientDetailPage'));
const MenuPage = lazy(() => import('@/pages/master/MenuPage'));
const ServicesPage = lazy(() => import('@/pages/master/ServicesPage'));
const ReviewsPage = lazy(() => import('@/pages/master/ReviewsPage'));
const AnalyticsPage = lazy(() => import('@/pages/master/AnalyticsPage'));
const ThemeCustomizerPage = lazy(() => import('@/pages/master/ThemeCustomizerPage'));
const BlacklistPage = lazy(() => import('@/pages/master/BlacklistPage'));
const BlockedScreenEditor = lazy(() => import('@/pages/master/BlockedScreenEditor'));
const LoyaltyPage = lazy(() => import('@/pages/master/LoyaltyPage'));
const PromotionsPage = lazy(() => import('@/pages/master/PromotionsPage'));
const BroadcastPage = lazy(() => import('@/pages/master/BroadcastPage'));
const SharePage = lazy(() => import('@/pages/master/SharePage'));
const SubscriptionPage = lazy(() => import('@/pages/master/SubscriptionPage'));
const SettingsPage = lazy(() => import('@/pages/master/SettingsPage'));
const ProfileSettingsPage = lazy(() => import('@/pages/master/ProfileSettingsPage'));

function MasterTabs() {
  const { t } = useTranslation();
  return (
    <TabLayout
      layoutId="master-tab"
      items={[
        { to: '/master', label: t('nav.dashboard'), icon: LayoutGrid, end: true },
        { to: '/master/schedule', label: t('nav.schedule'), icon: CalendarDays },
        { to: '/master/clients', label: t('nav.clients'), icon: Users },
        { to: '/master/menu', label: t('nav.profile'), icon: UserRound },
      ]}
    />
  );
}

export const masterRoutes = (
  <Route
    path="/master"
    element={
      <RequireMaster>
        <CabinetMarker cabinet="master">
          <Outlet />
        </CabinetMarker>
      </RequireMaster>
    }
  >
    <Route element={<MasterTabs />}>
      <Route index element={<DashboardPage />} />
      <Route path="schedule" element={<SchedulePage />} />
      <Route path="clients" element={<ClientsPage />} />
      <Route path="menu" element={<MenuPage />} />
    </Route>
    <Route path="clients/:id" element={<ClientDetailPage />} />
    <Route path="services" element={<ServicesPage />} />
    <Route path="reviews" element={<ReviewsPage />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="theme" element={<ThemeCustomizerPage />} />
    <Route path="blacklist" element={<BlacklistPage />} />
    <Route path="blacklist/screen" element={<BlockedScreenEditor />} />
    <Route path="loyalty" element={<LoyaltyPage />} />
    <Route path="promotions" element={<PromotionsPage />} />
    <Route path="broadcast" element={<BroadcastPage />} />
    <Route path="share" element={<SharePage />} />
    <Route path="subscription" element={<SubscriptionPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="profile" element={<ProfileSettingsPage />} />
  </Route>
);
