import { NotFoundError } from '../lib/errors';
import { prisma } from './prisma';

/**
 * Tenant isolation (spec rule №3): a Prisma Client extension that injects the tenant
 * filter into every query on tenant-owned models. It replaces the deprecated `$use`
 * middleware. Services receive a scoped client built from the JWT tenant id only.
 */

/** Models owned by a master (have a required `masterId`). */
export const MASTER_SCOPED_MODELS = [
  'Service',
  'ScheduleSlot',
  'MasterSettings',
  'TimeBlock',
  'Client',
  'Appointment',
  'Review',
  'LoyaltyRule',
  'Referral',
  'Promotion',
  'Broadcast',
  'BlacklistEntry',
  'BlockedScreen',
  'MasterCategory',
  'SlotAlert',
  'MasterTheme',
] as const;

/** Models owned by a salon (have a `salonId`). */
export const SALON_SCOPED_MODELS = ['SalonInvite', 'SalonCategory', 'MasterTheme'] as const;

const MASTER_SET = new Set<string>(MASTER_SCOPED_MODELS);
const SALON_SET = new Set<string>(SALON_SCOPED_MODELS);

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);
const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);
const UPDATE_OPERATIONS = new Set(['update', 'updateMany', 'updateManyAndReturn', 'upsert']);

interface Scope {
  field: 'masterId' | 'salonId';
  filter: string | { in: string[] };
  allows: (value: unknown) => boolean;
  /** Value injected into creates when the scope has a single tenant. */
  fixed: string | null;
}

type ScopeResolver = (model: string) => Scope | null;
type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

function withTenantWhere(where: unknown, scope: Scope): Dict {
  const base = isDict(where) ? where : {};
  const existingAnd = base.AND === undefined ? [] : Array.isArray(base.AND) ? base.AND : [base.AND];
  return { ...base, AND: [...existingAnd, { [scope.field]: scope.filter }] };
}

function withTenantData(data: unknown, scope: Scope): Dict {
  const record = isDict(data) ? data : {};
  const current = record[scope.field];
  if (scope.fixed !== null) {
    if (current !== undefined && current !== scope.fixed) throw new NotFoundError();
    return { ...record, [scope.field]: scope.fixed };
  }
  if (!scope.allows(current)) throw new NotFoundError();
  return record;
}

function assertNoTenantChange(data: unknown, scope: Scope): void {
  if (!isDict(data)) return;
  const value = data[scope.field];
  if (value === undefined) return;
  const plain = isDict(value) && 'set' in value ? value.set : value;
  if (!scope.allows(plain)) throw new NotFoundError();
}

function createTenantClient(resolve: ScopeResolver) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scope = resolve(model);
          if (!scope) return query(args);
          const a: Dict = isDict(args) ? { ...args } : {};

          if (WHERE_OPERATIONS.has(operation)) a.where = withTenantWhere(a.where, scope);
          if (UPDATE_OPERATIONS.has(operation)) {
            assertNoTenantChange(operation === 'upsert' ? a.update : a.data, scope);
          }
          if (operation === 'upsert') a.create = withTenantData(a.create, scope);
          if (CREATE_OPERATIONS.has(operation)) {
            a.data = Array.isArray(a.data)
              ? a.data.map((d: unknown) => withTenantData(d, scope))
              : withTenantData(a.data, scope);
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export function forMaster(masterId: string) {
  if (!masterId) throw new NotFoundError();
  const scope: Scope = {
    field: 'masterId',
    filter: masterId,
    allows: (v) => v === masterId,
    fixed: masterId,
  };
  return createTenantClient((model) => (MASTER_SET.has(model) ? scope : null));
}

/** Salon owners see data of all masters in their salon plus salon-owned models. */
export function forSalon(salonId: string, masterIds: string[]) {
  if (!salonId) throw new NotFoundError();
  const ids = [...masterIds];
  const salonScope: Scope = {
    field: 'salonId',
    filter: salonId,
    allows: (v) => v === salonId,
    fixed: salonId,
  };
  const mastersScope: Scope = {
    field: 'masterId',
    filter: { in: ids },
    allows: (v) => typeof v === 'string' && ids.includes(v),
    fixed: null,
  };
  return createTenantClient((model) => {
    if (SALON_SET.has(model)) return salonScope;
    if (MASTER_SET.has(model)) return mastersScope;
    return null;
  });
}

export type TenantDb = ReturnType<typeof forMaster>;
