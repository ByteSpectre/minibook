/**
 * Telegram `startapp` parameters allow only `A-Z a-z 0-9 _ -` (≤ 512 chars).
 * Slugs never contain `_`, so `_` is a safe separator.
 */
export const START_ROUTES = [
  'client_home',
  'client_calendar',
  'client_profile',
  'master_dashboard',
  'master_schedule',
  'master_subscription',
  'master_reviews',
  'salon_dashboard',
  'salon_masters',
  'salon_subscription',
  'admin',
  'pay_return',
] as const;
export type StartRoute = (typeof START_ROUTES)[number];

export type StartParam =
  | { kind: 'master'; slug: string; referrerClientId?: string }
  | { kind: 'salon'; slug: string }
  | { kind: 'masterRef'; masterId: string }
  | { kind: 'joinSalon'; salonId: string; code: string }
  | { kind: 'appointment'; appointmentId: string; action: 'view' | 'reschedule' | 'review' }
  | { kind: 'route'; route: StartRoute };

const SAFE_RE = /^[A-Za-z0-9_-]{1,512}$/;
const ID_RE = /^[A-Za-z0-9]{6,40}$/;
const SLUG_PART_RE = /^[a-z0-9-]{3,32}$/;

export function buildStartParam(param: StartParam): string {
  switch (param.kind) {
    case 'master':
      return param.referrerClientId
        ? `m_${param.slug}_r_${param.referrerClientId}`
        : `m_${param.slug}`;
    case 'salon':
      return `s_${param.slug}`;
    case 'masterRef':
      return `master_ref_${param.masterId}`;
    case 'joinSalon':
      return `join_salon_${param.salonId}_${param.code}`;
    case 'appointment':
      return `appt_${param.action}_${param.appointmentId}`;
    case 'route':
      return `go_${param.route}`;
  }
}

export function parseStartParam(raw?: string | null): StartParam | null {
  if (!raw || !SAFE_RE.test(raw)) return null;

  if (raw.startsWith('master_ref_')) {
    const masterId = raw.slice('master_ref_'.length);
    return ID_RE.test(masterId) ? { kind: 'masterRef', masterId } : null;
  }
  if (raw.startsWith('join_salon_')) {
    const [salonId, code] = raw.slice('join_salon_'.length).split('_');
    return salonId && code && ID_RE.test(salonId) && /^[A-Za-z0-9]{6,32}$/.test(code)
      ? { kind: 'joinSalon', salonId, code }
      : null;
  }
  if (raw.startsWith('appt_')) {
    const [action, appointmentId] = raw.slice('appt_'.length).split('_');
    if (
      appointmentId &&
      ID_RE.test(appointmentId) &&
      (action === 'view' || action === 'reschedule' || action === 'review')
    ) {
      return { kind: 'appointment', appointmentId, action };
    }
    return null;
  }
  if (raw.startsWith('go_')) {
    const route = raw.slice(3);
    return (START_ROUTES as readonly string[]).includes(route)
      ? { kind: 'route', route: route as StartRoute }
      : null;
  }
  if (raw.startsWith('m_')) {
    const [slug, marker, referrerClientId] = raw.slice(2).split('_');
    if (!slug || !SLUG_PART_RE.test(slug)) return null;
    if (marker === 'r' && referrerClientId && ID_RE.test(referrerClientId)) {
      return { kind: 'master', slug, referrerClientId };
    }
    return { kind: 'master', slug };
  }
  if (raw.startsWith('s_')) {
    const slug = raw.slice(2);
    return SLUG_PART_RE.test(slug) ? { kind: 'salon', slug } : null;
  }
  return null;
}

/**
 * Direct link to the Mini App. With a short name: `t.me/<bot>/<app>?startapp=…`,
 * otherwise the bot's main Mini App: `t.me/<bot>?startapp=…`.
 */
export function buildMiniAppLink(
  botUsername: string,
  shortName: string | null | undefined,
  param?: StartParam | string,
): string {
  const base = shortName ? `https://t.me/${botUsername}/${shortName}` : `https://t.me/${botUsername}`;
  if (!param) return shortName ? base : `${base}?startapp`;
  const encoded = typeof param === 'string' ? param : buildStartParam(param);
  return `${base}?startapp=${encoded}`;
}
