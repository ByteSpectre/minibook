import { beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '../../src/db/prisma';
import { forMaster, forSalon } from '../../src/db/tenant';
import { NotFoundError } from '../../src/lib/errors';
import {
  createClient,
  createMaster,
  createSalon,
  dictionaries,
  resetDb,
  type MasterFixture,
} from '../helpers';

describe('tenant isolation extension', () => {
  let a: MasterFixture;
  let b: MasterFixture;
  let bClientId: string;

  beforeAll(async () => {
    await resetDb();
    const dict = await dictionaries();
    a = await createMaster(dict, { slug: 'ext-a' });
    b = await createMaster(dict, { slug: 'ext-b' });
    await createClient(a.masterId, { firstName: 'A1' });
    bClientId = (await createClient(b.masterId, { firstName: 'B1' })).id;
  });

  it('scopes reads to the tenant', async () => {
    const rows = await forMaster(a.masterId).client.findMany();
    expect(rows.map((r) => r.firstName)).toEqual(['A1']);
  });

  it('ignores a foreign masterId in where', async () => {
    const rows = await forMaster(a.masterId).client.findMany({ where: { masterId: b.masterId } });
    expect(rows).toEqual([]);
  });

  it('returns nothing for a foreign id via findUnique', async () => {
    expect(await forMaster(a.masterId).client.findUnique({ where: { id: bClientId } })).toBeNull();
  });

  it('cannot update or delete a foreign record', async () => {
    await expect(
      forMaster(a.masterId).client.update({ where: { id: bClientId }, data: { notes: 'x' } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const deleted = await forMaster(a.masterId).client.deleteMany({ where: { id: bClientId } });
    expect(deleted.count).toBe(0);
  });

  it('refuses to create records for another tenant', async () => {
    await expect(
      forMaster(a.masterId).client.create({ data: { masterId: b.masterId, firstName: 'Evil' } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to move a record to another tenant', async () => {
    const own = await createClient(a.masterId, { firstName: 'Mine' });
    await expect(
      forMaster(a.masterId).client.update({
        where: { id: own.id },
        data: { masterId: b.masterId },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('salon scope covers only salon masters', async () => {
    const dict = await dictionaries();
    const salon = await createSalon(dict, { slug: 'ext-salon' });
    const member = await createMaster(dict, { slug: 'ext-member', salonId: salon.salonId });
    await createClient(member.masterId, { firstName: 'Member client' });
    const db = forSalon(salon.salonId, [member.masterId]);
    expect((await db.client.findMany()).map((c) => c.firstName)).toEqual(['Member client']);
    await expect(
      db.client.create({ data: { masterId: a.masterId, firstName: 'Evil' } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
