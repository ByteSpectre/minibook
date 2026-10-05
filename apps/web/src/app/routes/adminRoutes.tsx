import { Building2, CreditCard, LayoutGrid, Menu, Scissors } from 'lucide-react';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, Route } from 'react-router-dom';
import { TabLayout } from '@/components/layout/TabBar';
import { CabinetMarker, RequireOwner } from '../guards';

const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const MastersPage = lazy(() =>
  import('@/pages/admin/TenantsPage').then((m) => ({ default: m.AdminMastersPage })),
);
const SalonsPage = lazy(() =>
  import('@/pages/admin/TenantsPage').then((m) => ({ default: m.AdminSalonsPage })),
);
const PaymentsPage = lazy(() => import('@/pages/admin/PaymentsPage'));
const MenuPage = lazy(() => import('@/pages/admin/MenuPage'));
const FunnelPage = lazy(() => import('@/pages/admin/FunnelPage'));
const DictionariesPage = lazy(() => import('@/pages/admin/DictionariesPage'));
const PromoCodesPage = lazy(() => import('@/pages/admin/PromoCodesPage'));
const ExperimentsPage = lazy(() => import('@/pages/admin/ExperimentsPage'));
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));

function AdminTabs() {
  const { t } = useTranslation();
  return (
    <TabLayout
      layoutId="admin-tab"
      items={[
        { to: '/admin', label: t('admin.menu.overview'), icon: LayoutGrid, end: true },
        { to: '/admin/masters', label: t('admin.menu.masters'), icon: Scissors },
        { to: '/admin/salons', label: t('admin.menu.salons'), icon: Building2 },
        { to: '/admin/payments', label: t('nav.payments'), icon: CreditCard },
        { to: '/admin/menu', label: t('nav.more'), icon: Menu },
      ]}
    />
  );
}

export const adminRoutes = (
  <Route
    path="/admin"
    element={
      <RequireOwner>
        <CabinetMarker cabinet="admin">
          <Outlet />
        </CabinetMarker>
      </RequireOwner>
    }
  >
    <Route element={<AdminTabs />}>
      <Route index element={<DashboardPage />} />
      <Route path="masters" element={<MastersPage />} />
      <Route path="salons" element={<SalonsPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="menu" element={<MenuPage />} />
    </Route>
    <Route path="funnel" element={<FunnelPage />} />
    <Route path="dictionaries" element={<DictionariesPage />} />
    <Route path="promo-codes" element={<PromoCodesPage />} />
    <Route path="experiments" element={<ExperimentsPage />} />
    <Route path="settings" element={<SettingsPage />} />
  </Route>
);
