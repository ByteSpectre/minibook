import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { ROLES, type Role } from '@nail-crm/shared';
import { env } from '../config';

const ISSUER = 'glow-api';

const claimsSchema = z.object({
  sub: z.string(),
  tg: z.string(),
  roles: z.array(z.enum(ROLES)),
  mid: z.string().nullable().optional(),
  sid: z.string().nullable().optional(),
  own: z.boolean().optional(),
});

export interface AuthContext {
  userId: string;
  telegramId: bigint;
  roles: Role[];
  /** Tenant ids come exclusively from the signed token (spec rule №1). */
  masterId: string | null;
  salonId: string | null;
  isOwner: boolean;
}

export function signAccessToken(ctx: AuthContext): string {
  return jwt.sign(
    {
      tg: ctx.telegramId.toString(),
      roles: ctx.roles,
      mid: ctx.masterId,
      sid: ctx.salonId,
      own: ctx.isOwner,
    },
    env.JWT_SECRET,
    {
      subject: ctx.userId,
      issuer: ISSUER,
      audience: 'access',
      expiresIn: env.JWT_TTL as SignOptions['expiresIn'],
      algorithm: 'HS256',
    },
  );
}

export function verifyAccessToken(token: string): AuthContext {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: 'access',
    algorithms: ['HS256'],
  });
  const claims = claimsSchema.parse(decoded);
  return {
    userId: claims.sub,
    telegramId: BigInt(claims.tg),
    roles: claims.roles,
    masterId: claims.mid ?? null,
    salonId: claims.sid ?? null,
    isOwner: claims.own ?? false,
  };
}

const downloadSchema = z.object({
  kind: z.enum(['ics', 'export']),
  id: z.string(),
  entity: z.string().optional(),
});
export type DownloadClaims = z.infer<typeof downloadSchema>;

/** Short-lived signed links for file downloads opened outside the app (no auth header). */
export function signDownloadToken(claims: DownloadClaims, ttlSeconds: number): string {
  return jwt.sign(claims, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: 'download',
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyDownloadToken(token: string): DownloadClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: 'download',
    algorithms: ['HS256'],
  });
  return downloadSchema.parse(decoded);
}
