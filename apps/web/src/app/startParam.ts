import { parseStartParam, type MeDto, type StartParam, type StartRoute } from '@nail-crm/shared';
import type { Cabinet } from '@/store/auth';

let pending: string | null = null;
let consumed = false;

export function setPendingStartParam(raw: string | null): void {
  if (!consumed) pending = raw;
}

/** Returns the launch start param once per session. */
export function consumeStartParam(): StartParam | null {
  if (consumed) return null;
  consumed = true;
  return parseStartParam(pending);
}

const REF_PREFIX = 'glow.ref.';
const MASTER_REF = 'glow.masterRef';

export const rememberClientReferral = (slug: string, clientId: string) =>
  sessionStorage.setItem(REF_PREFIX + slug, clientId);
export const clientReferralFor = (slug: string) => sessionStorage.getItem(REF_PREFIX + slug);
export const rememberMasterReferral = (masterId: string) =>
  sessionStorage.setItem(MASTER_REF, masterId);
export const masterReferral = () => sessionStorage.getItem(MASTER_REF);

const ROUTES: Record<StartRoute, string> = {
  onboarding_client: '/onboarding/client',
  onboarding_master: '/onboarding/master',
  onboarding_salon: '/onboarding/salon',
  client_search: '/client/search',
  client_home: '/client',
  client_calendar: '/client/calendar',
  client_profile: '/client/profile',
  master_dashboard: '/master',
  master_schedule: '/master/schedule',
  master_subscription: '/master/subscription',
  master_reviews: '/master/reviews',
  salon_dashboard: '/salon',
  salon_masters: '/salon/masters',
  salon_subscription: '/salon/subscription',
  admin: '/admin',
  pay_return: '/pay/return',
};

export function routeForStartParam(param: StartParam, me: MeDto): string {
  switch (param.kind) {
    case 'master':
      if (param.referrerClientId) rememberClientReferral(param.slug, param.referrerClientId);
      return `/m/${param.slug}`;
    case 'salon':
      return `/s/${param.slug}`;
    case 'masterRef':
      rememberMasterReferral(param.masterId);
      return me.master ? '/master' : '/onboarding/master';
    case 'joinSalon':
      return `/join/${param.salonId}/${param.code}`;
    case 'appointment':
      return `/client/calendar?${param.action === 'view' ? 'appointment' : param.action}=${param.appointmentId}`;
    case 'route':
      return ROUTES[param.route];
  }
}

export function cabinetHome(cabinet: Cabinet): string {
  return cabinet === 'client' ? '/client' : `/${cabinet}`;
}

export function availableCabinets(me: MeDto): Cabinet[] {
  const list: Cabinet[] = [];
  if (me.master) list.push('master');
  if (me.salon) list.push('salon');
  if (me.clientOnboarded) list.push('client');
  if (me.isOwner) list.push('admin');
  return list;
}

export function defaultRoute(me: MeDto, cabinet: Cabinet | null): string {
  // Remember last non-client cabinet only when the profile still exists.
  if (cabinet === 'master' && me.master) return '/master';
  if (cabinet === 'salon' && me.salon) return '/salon';
  if (cabinet === 'admin' && me.isOwner) return '/admin';
  // Everyone starts as a client.
  return me.clientOnboarded ? '/client' : '/onboarding/client';
}
