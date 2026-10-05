import { afterAll } from 'vitest';
import { prisma } from '../src/db/prisma';
import { drainDeferred } from '../src/lib/deferred';

afterAll(async () => {
  await drainDeferred();
  await prisma.$disconnect();
});
