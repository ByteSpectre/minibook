import { buildMiniAppLink, buildStartParam, type StartParam } from '@nail-crm/shared';
import { config, env } from '../config';
import { signDownloadToken } from './jwt';

/** Signed .ics link (opened outside the app, so it can't carry the auth header). */
export function icsUrlFor(appointmentId: string): string {
  const token = signDownloadToken({ kind: 'ics', id: appointmentId }, 60 * 60 * 24 * 60);
  return `${config.publicApiUrl}/api/files/ics/${token}`;
}

export const miniAppLink = (param?: StartParam | string): string =>
  buildMiniAppLink(env.BOT_USERNAME, env.MINI_APP_SHORT_NAME || null, param);

export const webAppUrl = (path = '/'): string => `${config.webAppUrl}${path}`;

/** Relative `/uploads/...` paths are resolved against the public API URL. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${config.publicApiUrl}${url}` : url;
}

export const masterPublicLink = (slug: string): string => miniAppLink({ kind: 'master', slug });
export const salonPublicLink = (slug: string): string => miniAppLink({ kind: 'salon', slug });

export const startParamOf = (param: StartParam): string => buildStartParam(param);
