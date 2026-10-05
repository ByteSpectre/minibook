import type { TenantDb } from '../db/tenant';
import type { MasterTenant, SalonTenant } from '../middleware/auth';

/**
 * What a service needs to work on tenant data. For masters `masterIds` is the master
 * itself, for salon owners — every master of the salon. Ids always come from the JWT.
 */
export interface TenantScope {
  kind: 'master' | 'salon';
  db: TenantDb;
  masterIds: string[];
  timezone: string;
  currency: string;
  salonId: string | null;
}

export function masterScope(t: MasterTenant): TenantScope {
  return {
    kind: 'master',
    db: t.db,
    masterIds: [t.masterId],
    timezone: t.master.timezone,
    currency: t.master.currency,
    salonId: null,
  };
}

export function salonScope(t: SalonTenant): TenantScope {
  return {
    kind: 'salon',
    db: t.db,
    masterIds: t.masterIds,
    timezone: t.salon.timezone,
    currency: t.salon.currency,
    salonId: t.salonId,
  };
}
