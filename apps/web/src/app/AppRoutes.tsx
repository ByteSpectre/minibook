import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PageLoader } from '@/components/layout/states';
import { Landing, PayReturn, RequireClient } from './guards';
import { adminRoutes } from './routes/adminRoutes';
import { clientRoutes } from './routes/clientRoutes';
import { masterRoutes } from './routes/masterRoutes';
import { salonRoutes } from './routes/salonRoutes';

const RoleSelectPage = lazy(() => import('@/pages/common/RoleSelectPage'));
const NotFoundPage = lazy(() => import('@/pages/common/NotFoundPage'));
const JoinSalonPage = lazy(() => import('@/pages/common/JoinSalonPage'));
const MockCheckoutPage = lazy(() => import('@/pages/common/MockCheckoutPage'));
const ClientOnboardingPage = lazy(() => import('@/pages/client/OnboardingPage'));
const MasterOnboardingPage = lazy(() => import('@/pages/master/OnboardingPage'));
const SalonOnboardingPage = lazy(() => import('@/pages/salon/OnboardingPage'));
const MasterProfilePage = lazy(() => import('@/pages/public/MasterProfilePage'));
const SalonProfilePage = lazy(() => import('@/pages/public/SalonProfilePage'));
const BookingPage = lazy(() => import('@/pages/public/BookingPage'));
const BookingSuccessPage = lazy(() => import('@/pages/public/BookingSuccessPage'));
const BlockedPage = lazy(() => import('@/pages/public/BlockedPage'));
const ExpiredPage = lazy(() => import('@/pages/public/ExpiredPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/start" element={<RoleSelectPage />} />
        <Route path="/onboarding/client" element={<ClientOnboardingPage />} />
        <Route path="/onboarding/master" element={<MasterOnboardingPage />} />
        <Route path="/onboarding/salon" element={<SalonOnboardingPage />} />
        <Route path="/join/:salonId/:code" element={<JoinSalonPage />} />
        <Route path="/pay/mock/:paymentId" element={<MockCheckoutPage />} />
        <Route path="/pay/return" element={<PayReturn />} />
        <Route path="/m/:slug" element={<MasterProfilePage />} />
        <Route
          path="/m/:slug/book"
          element={
            <RequireClient>
              <BookingPage />
            </RequireClient>
          }
        />
        <Route path="/m/:slug/blocked" element={<BlockedPage />} />
        <Route path="/m/:slug/expired" element={<ExpiredPage />} />
        <Route path="/s/:slug" element={<SalonProfilePage />} />
        <Route path="/booking/:id/success" element={<BookingSuccessPage />} />
        {clientRoutes}
        {masterRoutes}
        {salonRoutes}
        {adminRoutes}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
