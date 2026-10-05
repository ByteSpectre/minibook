import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config';

export { Prisma } from '../generated/prisma/client';
export type * from '../generated/prisma/client';

/** Keep the pool tiny on Vercel (one connection per isolate); larger locally / on a VPS. */
const poolMax = process.env.VERCEL === '1' ? 1 : 20;
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: poolMax });

/**
 * Base client. Tenant-owned data must be accessed through `forMaster` / `forSalon`
 * (see ./tenant.ts) so the tenant filter is applied automatically.
 */
export const prisma = new PrismaClient({ adapter });

export type BasePrisma = typeof prisma;
