import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useMe, type Cabinet } from '@/store/auth';
import { consumeStartParam, defaultRoute, routeForStartParam } from './startParam';

function returnTo(location: ReturnType<typeof useLocation>) {
  return encodeURIComponent(`${location.pathname}${location.search}`);
}

export function RequireClient({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (!me?.clientOnboarded)
    return <Navigate to={`/onboarding/client?returnTo=${returnTo(location)}`} replace />;
  return <>{children}</>;
}

export function RequireMaster({ children }: { children: ReactNode }) {
  const me = useMe();
  if (!me?.master) return <Navigate to="/onboarding/master" replace />;
  return <>{children}</>;
}

export function RequireSalon({ children }: { children: ReactNode }) {
  const me = useMe();
  if (!me?.salon) return <Navigate to="/onboarding/salon" replace />;
  return <>{children}</>;
}

export function RequireOwner({ children }: { children: ReactNode }) {
  const me = useMe();
  if (!me?.isOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Remembers which cabinet the user works in, so the next launch opens it. */
export function CabinetMarker({ cabinet, children }: { cabinet: Cabinet; children: ReactNode }) {
  const setCabinet = useAuth((s) => s.setCabinet);
  useEffect(() => setCabinet(cabinet), [cabinet, setCabinet]);
  return <>{children}</>;
}

/** `/` — routes by the launch start param, then by the last used cabinet. */
export function Landing() {
  const me = useMe();
  const cabinet = useAuth((s) => s.cabinet);
  const navigate = useNavigate();
  useEffect(() => {
    if (!me) return;
    const param = consumeStartParam();
    navigate(param ? routeForStartParam(param, me) : defaultRoute(me, cabinet), { replace: true });
  }, [me, cabinet, navigate]);
  return null;
}

export function PayReturn() {
  const cabinet = useAuth((s) => s.cabinet);
  return (
    <Navigate
      to={cabinet === 'salon' ? '/salon/subscription?paid=1' : '/master/subscription?paid=1'}
      replace
    />
  );
}
