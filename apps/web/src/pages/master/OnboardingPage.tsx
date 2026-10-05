import { Navigate, useSearchParams } from 'react-router-dom';
import { masterReferral } from '@/app/startParam';
import { MasterOnboarding } from '@/features/cabinet/MasterOnboarding';
import { useMe } from '@/store/auth';

export default function MasterOnboardingPage() {
  const me = useMe();
  const [params] = useSearchParams();
  if (me?.master) return <Navigate to="/master" replace />;
  const join = params.get('join');
  const [salonId, code] = join ? join.split(':') : [];
  return (
    <MasterOnboarding
      joinSalon={salonId && code ? { salonId, code } : null}
      referrerMasterId={masterReferral()}
    />
  );
}
