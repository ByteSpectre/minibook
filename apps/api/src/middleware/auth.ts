import type { Request, RequestHandler } from 'express';
import type { AccessDto } from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { forMaster, forSalon, type TenantDb } from '../db/tenant';
import { computeMasterAccess, computeSalonAccess } from '../lib/access';
import { AppError, forbidden, paymentRequired, unauthorized } from '../lib/errors';
import { verifyAccessToken, type AuthContext } from '../lib/jwt';
import { config } from '../config';

const MASTER_SELECT = {
  id: true,
  userId: true,
  slug: true,
  name: true,
  timezone: true,
  currency: true,
  status: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  autoRenewEnabled: true,
  salonId: true,
  bannedAt: true,
  salon: {
    select: {
      id: true,
      name: true,
      status: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      autoRenewEnabled: true,
    },
  },
} as const;

const SALON_SELECT = {
  id: true,
  ownerId: true,
  slug: true,
  name: true,
  timezone: true,
  currency: true,
  status: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  autoRenewEnabled: true,
  masters: { select: { id: true } },
} as const;

export interface MasterTenant {
  masterId: string;
  master: {
    id: string;
    userId: string;
    slug: string;
    name: string;
    timezone: string;
    currency: string;
    salonId: string | null;
  };
  access: AccessDto;
  db: TenantDb;
}

export interface SalonTenant {
  salonId: string;
  salon: {
    id: string;
    ownerId: string;
    slug: string;
    name: string;
    timezone: string;
    currency: string;
  };
  masterIds: string[];
  access: AccessDto;
  db: TenantDb;
}

export type AccessMode = 'any' | 'read' | 'write' | 'export' | 'auto';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  try {
    req.auth = verifyAccessToken(header.slice('Bearer '.length).trim());
  } catch {
    throw unauthorized();
  }
  next();
};

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function getMaster(req: Request): MasterTenant {
  if (!req.masterTenant) throw unauthorized();
  return req.masterTenant;
}

export function getSalon(req: Request): SalonTenant {
  if (!req.salonTenant) throw unauthorized();
  return req.salonTenant;
}

function assertAccess(access: AccessDto, mode: AccessMode, method: string): void {
  const effective: AccessMode = mode === 'auto' ? (method === 'GET' ? 'read' : 'write') : mode;
  if (effective === 'any' || (effective === 'export' && access.canExport)) return;
  if (access.status === 'BANNED') throw forbidden('banned', 'Account is suspended');
  if (effective === 'read' && access.canRead) return;
  if (effective === 'write' && access.canWrite) return;
  throw paymentRequired();
}

/** Resolves the master tenant from the JWT `masterId` (never from the request). */
export function requireMaster(mode: AccessMode = 'auto'): RequestHandler {
  return async (req, _res, next) => {
    const auth = getAuth(req);
    if (!auth.masterId) throw forbidden('forbidden', 'Master profile required');
    const master = await prisma.master.findUnique({
      where: { id: auth.masterId },
      select: MASTER_SELECT,
    });
    if (!master || master.userId !== auth.userId) throw unauthorized();
    const access = computeMasterAccess(master, master.salon);
    assertAccess(access, mode, req.method);
    req.masterTenant = {
      masterId: master.id,
      master: {
        id: master.id,
        userId: master.userId,
        slug: master.slug,
        name: master.name,
        timezone: master.timezone,
        currency: master.currency,
        salonId: master.salonId,
      },
      access,
      db: forMaster(master.id),
    };
    next();
  };
}

/** Resolves the salon tenant from the JWT `salonId` (never from the request). */
export function requireSalon(mode: AccessMode = 'auto'): RequestHandler {
  return async (req, _res, next) => {
    const auth = getAuth(req);
    if (!auth.salonId) throw forbidden('forbidden', 'Salon profile required');
    const salon = await prisma.salon.findUnique({
      where: { id: auth.salonId },
      select: SALON_SELECT,
    });
    if (!salon || salon.ownerId !== auth.userId) throw unauthorized();
    const access = computeSalonAccess(salon);
    assertAccess(access, mode, req.method);
    const masterIds = salon.masters.map((m) => m.id);
    req.salonTenant = {
      salonId: salon.id,
      salon: {
        id: salon.id,
        ownerId: salon.ownerId,
        slug: salon.slug,
        name: salon.name,
        timezone: salon.timezone,
        currency: salon.currency,
      },
      masterIds,
      access,
      db: forSalon(salon.id, masterIds),
    };
    next();
  };
}

export const requireOwner: RequestHandler = (req, _res, next) => {
  const auth = getAuth(req);
  if (!auth.isOwner || !config.ownerTelegramId || auth.telegramId !== config.ownerTelegramId) {
    throw new AppError(403, 'forbidden', 'Platform owner only');
  }
  next();
};

export const requireClientProfile: RequestHandler = async (req, _res, next) => {
  const auth = getAuth(req);
  const profile = await prisma.clientProfile.findUnique({
    where: { userId: auth.userId },
    select: { onboardingCompleted: true },
  });
  if (!profile?.onboardingCompleted)
    throw forbidden('onboardingRequired', 'Client onboarding required');
  next();
};
