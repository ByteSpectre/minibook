import { Navigate } from 'react-router-dom';
import { TenantOnboarding } from '@/features/cabinet/TenantOnboarding';
import { useMe } from '@/store/auth';

export default function SalonOnboardingPage() {
  const me = useMe();
  if (me?.salon) return <Navigate to="/salon" replace />;
  return <TenantOnboarding kind="salon" />;
}
