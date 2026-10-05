import type { PromoType, TenantKind } from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import { AppError, NotFoundError } from '../../lib/errors';
import { accessOf, grantDays, loadTenant, updateTenant } from './billing.service';

export interface PromoResult {
  type: PromoType;
  value: number;
  accessEndsAt: string | null;
}

/** `/promo CODE` in the bot and the promo field in the Mini App share this logic. */
export async function applyPromoCode(
  kind: TenantKind,
  tenantId: string,
  rawCode: string,
  now: Date = new Date(),
): Promise<PromoResult> {
  const code = rawCode.trim().toUpperCase();
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) throw new AppError(404, 'promoNotFound', 'Promo code not found');
  if (promo.expiresAt && promo.expiresAt < now)
    throw new AppError(410, 'promoExpired', 'Promo code expired');
  if (promo.maxUsages !== null && promo.usedCount >= promo.maxUsages) {
    throw new AppError(410, 'promoExhausted', 'Promo code exhausted');
  }
  const used = await prisma.promoUsage.findFirst({
    where: {
      promoId: promo.id,
      ...(kind === 'master' ? { masterId: tenantId } : { salonId: tenantId }),
    },
  });
  if (used) throw new AppError(409, 'promoUsed', 'Promo code already used');

  return prisma.$transaction(async (tx) => {
    const t = await loadTenant(kind, tenantId, tx);
    if (t.status === 'BANNED') throw new NotFoundError();
    const claimed = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        ...(promo.maxUsages !== null ? { usedCount: { lt: promo.maxUsages } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (claimed.count === 0) throw new AppError(410, 'promoExhausted', 'Promo code exhausted');
    await tx.promoUsage.create({
      data: {
        promoId: promo.id,
        masterId: kind === 'master' ? tenantId : null,
        salonId: kind === 'salon' ? tenantId : null,
      },
    });
    if (promo.type === 'FREE_DAYS') {
      const end = await grantDays(tx, t, promo.value, now);
      return { type: promo.type, value: promo.value, accessEndsAt: end.toISOString() };
    }
    await updateTenant(tx, kind, tenantId, {
      pendingDiscountPct: promo.value,
      pendingPromoId: promo.id,
    });
    return { type: promo.type, value: promo.value, accessEndsAt: accessOf(t, now).endsAt };
  });
}
