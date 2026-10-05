import 'dotenv/config';
import { countryFlag } from '@nail-crm/shared';
import { prisma } from './prisma';
import { CATEGORIES, COUNTRIES } from './seedData';

async function seedDictionaries() {
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, nameEn: c.nameEn, emoji: c.emoji, sortOrder: i },
      update: { name: c.name, nameEn: c.nameEn, emoji: c.emoji, sortOrder: i },
    });
  }
  for (const [i, country] of COUNTRIES.entries()) {
    const row = await prisma.country.upsert({
      where: { code: country.code },
      create: {
        code: country.code,
        name: country.name,
        nameEn: country.nameEn,
        flag: countryFlag(country.code),
        sortOrder: i,
      },
      update: {
        name: country.name,
        nameEn: country.nameEn,
        flag: countryFlag(country.code),
        sortOrder: i,
      },
    });
    for (const [j, city] of country.cities.entries()) {
      const existing = await prisma.city.findFirst({
        where: { countryId: row.id, name: city.name },
      });
      const data = {
        name: city.name,
        nameEn: city.nameEn,
        countryId: row.id,
        timezone: city.timezone,
        latitude: city.lat,
        longitude: city.lng,
        sortOrder: j,
      };
      if (existing) await prisma.city.update({ where: { id: existing.id }, data });
      else await prisma.city.create({ data });
    }
  }
}

/** Remove legacy demo tenants/users from earlier seed versions. */
async function cleanDemo() {
  const demo = {
    OR: [
      { telegramId: { gte: 100000, lt: 100100 } },
      { telegramId: { gte: 200000, lt: 200100 } },
      { telegramId: { gte: 300000, lt: 300100 } },
    ],
  };
  const users = await prisma.user.findMany({ where: demo, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.salon.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.master.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.promoCode.deleteMany({
    where: { code: { in: ['WELCOME30', 'SALE20', 'SUMMER10'] } },
  });
  await prisma.experiment.deleteMany({ where: { name: 'Цена подписки: 449 ₽ vs 399 ₽' } });
  await prisma.notificationLog.deleteMany({});
}

async function main() {
  console.info('Seeding dictionaries…');
  await seedDictionaries();
  console.info('Cleaning previous demo data…');
  await cleanDemo();
  const counts = {
    users: await prisma.user.count(),
    masters: await prisma.master.count(),
    salons: await prisma.salon.count(),
    categories: await prisma.category.count(),
    cities: await prisma.city.count(),
  };
  console.info('Seed complete:', counts);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
