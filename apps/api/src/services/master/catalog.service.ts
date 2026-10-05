import type { z } from 'zod';
import type { serviceCreateSchema, servicePatchSchema, ServiceDto } from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import type { TenantDb } from '../../db/tenant';
import { badRequest, NotFoundError } from '../../lib/errors';
import { toCategoryDto, toServiceDto } from '../../lib/mappers';
import { assertCategories } from './onboarding.service';

type ServiceInput = z.output<typeof serviceCreateSchema>;
type ServicePatch = z.output<typeof servicePatchSchema>;

export async function listServices(db: TenantDb): Promise<ServiceDto[]> {
  const rows = await db.service.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toServiceDto);
}

export async function createService(
  db: TenantDb,
  masterId: string,
  input: ServiceInput,
): Promise<ServiceDto> {
  if (input.categoryId) await assertCategories([input.categoryId]);
  const last = await db.service.findFirst({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const row = await db.service.create({
    data: {
      masterId,
      name: input.name,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      price: input.price,
      duration: input.duration,
      categoryId: input.categoryId ?? null,
      isActive: input.isActive ?? true,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return toServiceDto(row);
}

export async function patchService(
  db: TenantDb,
  id: string,
  patch: ServicePatch,
): Promise<ServiceDto> {
  if (patch.categoryId) await assertCategories([patch.categoryId]);
  const row = await db.service.update({
    where: { id, deletedAt: null },
    data: {
      name: patch.name,
      description: patch.description,
      imageUrl: patch.imageUrl,
      price: patch.price,
      duration: patch.duration,
      categoryId: patch.categoryId,
      isActive: patch.isActive,
    },
  });
  return toServiceDto(row);
}

/** Services used in appointments are archived (history keeps their snapshot). */
export async function deleteService(db: TenantDb, id: string): Promise<void> {
  const service = await db.service.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!service) throw new NotFoundError();
  const used = await prisma.appointmentService.count({ where: { serviceId: service.id } });
  const activeCount = await db.service.count({
    where: { deletedAt: null, isActive: true, id: { not: service.id } },
  });
  if (activeCount === 0) throw badRequest('lastService', 'At least one active service is required');
  if (used > 0) {
    await db.service.update({
      where: { id: service.id },
      data: { deletedAt: new Date(), isActive: false },
    });
  } else {
    await prisma.promotion.updateMany({
      where: { serviceId: service.id },
      data: { serviceId: null },
    });
    await db.service.delete({ where: { id: service.id } });
  }
}

export async function reorderServices(db: TenantDb, ids: string[]): Promise<ServiceDto[]> {
  const unique = [...new Set(ids)];
  const owned = await db.service.count({ where: { id: { in: unique }, deletedAt: null } });
  if (owned !== unique.length) throw new NotFoundError();
  await Promise.all(
    unique.map((id, index) => db.service.update({ where: { id }, data: { sortOrder: index } })),
  );
  return listServices(db);
}

export async function listMasterCategories(db: TenantDb) {
  const [selected, all] = await Promise.all([
    db.masterCategory.findMany({ include: { category: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);
  return {
    selectedIds: selected.map((s) => s.categoryId),
    selected: selected.map((s) => toCategoryDto(s.category)),
    all: all.map(toCategoryDto),
  };
}

export async function setMasterCategories(db: TenantDb, masterId: string, categoryIds: string[]) {
  const ids = await assertCategories(categoryIds);
  await db.masterCategory.deleteMany({ where: { categoryId: { notIn: ids } } });
  await db.masterCategory.createMany({
    data: ids.map((categoryId) => ({ masterId, categoryId })),
    skipDuplicates: true,
  });
  return listMasterCategories(db);
}
