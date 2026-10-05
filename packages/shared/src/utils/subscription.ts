import type { SubStatus } from '../enums';

export interface SubscriptionLike {
  status: SubStatus;
  trialEndsAt: Date | string | null;
  subscriptionEndsAt: Date | string | null;
}

const ts = (value: Date | string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

/**
 * Status that actually applies right now. Stored statuses may lag behind until the
 * expiry cron runs, so access decisions always use this function.
 */
export function effectiveStatus(sub: SubscriptionLike, now: Date = new Date()): SubStatus {
  if (sub.status === 'BANNED') return 'BANNED';
  const t = now.getTime();
  if (sub.status === 'TRIAL') return ts(sub.trialEndsAt) > t ? 'TRIAL' : 'EXPIRED';
  if (sub.status === 'ACTIVE' || sub.status === 'CANCELLED') {
    return ts(sub.subscriptionEndsAt) > t ? sub.status : 'EXPIRED';
  }
  return 'EXPIRED';
}

export function accessEndsAt(sub: SubscriptionLike): Date | null {
  const value = sub.status === 'TRIAL' ? sub.trialEndsAt : sub.subscriptionEndsAt;
  return value ? new Date(value) : null;
}

export interface AccessFlags {
  /** Public page, new bookings, search/map visibility. */
  isPublic: boolean;
  canRead: boolean;
  canWrite: boolean;
  canNotify: boolean;
  canExport: boolean;
}

export function accessFlags(status: SubStatus): AccessFlags {
  switch (status) {
    case 'TRIAL':
    case 'ACTIVE':
    case 'CANCELLED':
      return { isPublic: true, canRead: true, canWrite: true, canNotify: true, canExport: true };
    case 'EXPIRED':
      return { isPublic: false, canRead: true, canWrite: false, canNotify: false, canExport: true };
    case 'BANNED':
      return { isPublic: false, canRead: false, canWrite: false, canNotify: false, canExport: true };
  }
}

export function daysLeft(end: Date | string | null | undefined, now: Date = new Date()): number {
  if (!end) return 0;
  const diff = new Date(end).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / 86400000);
}
