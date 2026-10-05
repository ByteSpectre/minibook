import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config';

export { Prisma } from '../generated/prisma/client';
export type * from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 20 });

/**
 * Base client. Tenant-owned data must be accessed through `forMaster` / `forSalon`
 * (see ./tenant.ts) so the tenant filter is applied automatically.
 */
export const prisma = new PrismaClient({ adapter });

export type BasePrisma = typeof prisma;
