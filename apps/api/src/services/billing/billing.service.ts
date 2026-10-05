import { createHmac, timingSafeEqual } from 'node:crypto';
import { createId } from './id';
import {
  applyDiscount,
  formatMoney,
  type CreatePaymentResponse,
  type PaymentDto,
  type PaymentStatus,
  type SubscriptionDto,
  type SubStatus,
  type TenantKind,
} from '@nail-crm/shared';
import { config, env } from '../../config';
import { prisma } from '../../db/prisma';
import { computeMasterAccess, computeSalonAccess } from '../../lib/access';
import { defer } from '../../lib/deferred';
import { AppError, forbidden, NotFoundError } from '../../lib/errors';
import { langOf, tr } from '../../lib/i18n';
import { miniAppLink, webAppUrl } from '../../lib/links';
import { addDays, fmtShortDate } from '../../lib/time';
import { logger } from '../../logger';
import { trackFunnel } from '../funnel.service';
import { sendMessage } from '../notifications/notifier';
import { getPlatformSettings } from '../settings.service';
import { getMasterVariant } from './experiments.service';
import {
  createYooPayment,
  getYooPayment,
  yooPaymentSchema,
  yooRefundSchema,
  type YooNotification,
  type YooPayment,
} from './yookassa';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

export interface TenantBilling {
  kind: TenantKind;
  id: string;
  name: string;
  slug: string;
  status: SubStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  autoRenewEnabled: boolean;
  yookassaPaymentMethodId: string | null;
  pendingDiscountPct: number | null;
  pendingPromoId: string | null;
  ownerUserId: string;
  ownerTelegramId: bigint;
  ownerLanguage: string;
  ownerPhone: string | null;
  salon: {
    id: string;
    name: string;
    status: SubStatus;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    autoRenewEnabled: boolean;
  } | null;
}

const ownerSelect = {
  id: true,
  telegramId: true,
  language: true,
  clientProfile: { select: { phone: true } },
} as const;

export async function loadTenant(
  kind: TenantKind,
  id: string,
  db: Db = prisma,
): Promise<TenantBilling> {
  if (kind === 'master') {
    const m = await db.master.findUnique({
      where: { id },
      include: {
        user: { select: ownerSelect },
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
      },
    });
    if (!m) throw new NotFoundError();
    return {
      kind,
      id: m.id,
      name: m.name,
      slug: m.slug,
      status: m.status,
      trialEndsAt: m.trialEndsAt,
      subscriptionEndsAt: m.subscriptionEndsAt,
      autoRenewEnabled: m.autoRenewEnabled,
      yookassaPaymentMethodId: m.yookassaPaymentMethodId,
      pendingDiscountPct: m.pendingDiscountPct,
      pendingPromoId: m.pendingPromoId,
      ownerUserId: m.user.id,
      ownerTelegramId: m.user.telegramId,
      ownerLanguage: m.user.language,
      ownerPhone: m.user.clientProfile?.phone ?? null,
      salon: m.salon,
    };
  }
  const s = await db.salon.findUnique({
    where: { id },
    include: { owner: { select: ownerSelect } },
  });
  if (!s) throw new NotFoundError();
  return {
    kind,
    id: s.id,
    name: s.name,
    slug: s.slug,
    status: s.status,
    trialEndsAt: s.trialEndsAt,
    subscriptionEndsAt: s.subscriptionEndsAt,
    autoRenewEnabled: s.autoRenewEnabled,
    yookassaPaymentMethodId: s.yookassaPaymentMethodId,
    pendingDiscountPct: s.pendingDiscountPct,
    pendingPromoId: s.pendingPromoId,
    ownerUserId: s.owner.id,
    ownerTelegramId: s.owner.telegramId,
    ownerLanguage: s.owner.language,
    ownerPhone: s.owner.clientProfile?.phone ?? null,
    salon: null,
  };
}

export interface TenantUpdate {
  status?: SubStatus;
  trialEndsAt?: Date | null;
  subscriptionEndsAt?: Date | null;
  autoRenewEnabled?: boolean;
  yookassaPaymentMethodId?: string | null;
  pendingDiscountPct?: number | null;
  pendingPromoId?: string | null;
  bannedAt?: Date | null;
  bannedReason?: string | null;
}

export async function updateTenant(
  db: Db,
  kind: TenantKind,
  id: string,
  data: TenantUpdate,
): Promise<void> {
  if (kind === 'master') await db.master.update({ where: { id }, data });
  else await db.salon.update({ where: { id }, data });
}

export function accessOf(t: TenantBilling, now: Date = new Date()) {
  return t.kind === 'master'
    ? computeMasterAccess({ ...t, salonId: t.salon?.id ?? null }, t.salon, now)
    : computeSalonAccess(t, now);
}

/** Adds days to whatever access the tenant has (trial stays trial; otherwise paid period). */
export async function grantDays(
  db: Db,
  t: TenantBilling,
  days: number,
  now: Date = new Date(),
): Promise<Date> {
  const day = 86_400_000;
  if (t.status === 'TRIAL' && t.trialEndsAt && t.trialEndsAt > now) {
    const end = new Date(t.trialEndsAt.getTime() + days * day);
    await updateTenant(db, t.kind, t.id, { trialEndsAt: end });
    return end;
  }
  const base = Math.max(now.getTime(), t.subscriptionEndsAt?.getTime() ?? 0);
  const end = new Date(base + days * day);
  await updateTenant(db, t.kind, t.id, {
    subscriptionEndsAt: end,
    status:
      t.status === 'BANNED'
        ? 'BANNED'
        : t.status === 'CANCELLED' && (t.subscriptionEndsAt?.getTime() ?? 0) > now.getTime()
          ? 'CANCELLED'
          : 'ACTIVE',
  });
  return end;
}

/** Paid period starts after the remaining trial/paid time. */
async function extendAfterPayment(
  db: Db,
  t: TenantBilling,
  days: number,
  now: Date,
): Promise<Date> {
  const base = Math.max(
    now.getTime(),
    t.subscriptionEndsAt?.getTime() ?? 0,
    t.status === 'TRIAL' ? (t.trialEndsAt?.getTime() ?? 0) : 0,
  );
  const end = new Date(base + days * 86_400_000);
  await updateTenant(db, t.kind, t.id, {
    subscriptionEndsAt: end,
    status: t.status === 'BANNED' ? 'BANNED' : 'ACTIVE',
  });
  return end;
}

export interface ResolvedPrice {
  basePriceRub: number;
  priceRub: number;
  discountPct: number | null;
  paywall: { title: string | null; text: string | null };
}

export async function resolvePrice(t: TenantBilling): Promise<ResolvedPrice> {
  const settings = await getPlatformSettings();
  let base = t.kind === 'master' ? settings.masterPriceRub : settings.salonPriceRub;
  let paywall: ResolvedPrice['paywall'] = { title: null, text: null };
  if (t.kind === 'master') {
    const variant = await getMasterVariant(t.id);
    if (variant?.config.priceRub) base = variant.config.priceRub;
    if (variant)
      paywall = {
        title: variant.config.paywallTitle ?? null,
        text: variant.config.paywallText ?? null,
      };
  }
  return {
    basePriceRub: base,
    priceRub: applyDiscount(base, t.pendingDiscountPct),
    discountPct: t.pendingDiscountPct,
    paywall,
  };
}

function toPaymentDto(p: {
  id: string;
  amountKopeks: number;
  periodDays: number;
  status: string;
  isAutoPayment: boolean;
  paidAt: Date | null;
  createdAt: Date;
  description: string | null;
}): PaymentDto {
  return {
    id: p.id,
    amountRub: p.amountKopeks / 100,
    periodDays: p.periodDays,
    status: p.status as PaymentStatus,
    isAutoPayment: p.isAutoPayment,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    description: p.description,
  };
}

export async function getSubscription(kind: TenantKind, id: string): Promise<SubscriptionDto> {
  const t = await loadTenant(kind, id);
  const price = await resolvePrice(t);
  const referralsCount =
    kind === 'master' ? await prisma.masterReferral.count({ where: { referrerId: id } }) : 0;
  const access = accessOf(t);
  return {
    kind,
    access,
    priceRub: price.priceRub,
    basePriceRub: price.basePriceRub,
    periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
    pendingDiscountPct: t.pendingDiscountPct,
    autoRenewEnabled: t.autoRenewEnabled,
    hasSavedPaymentMethod: !!t.yookassaPaymentMethodId,
    paywall: price.paywall,
    provider: config.paymentProvider,
    referralLink: kind === 'master' ? miniAppLink({ kind: 'masterRef', masterId: id }) : null,
    referralsCount,
    coveredBySalon:
      access.source === 'salon-member' && t.salon ? { id: t.salon.id, name: t.salon.name } : null,
  };
}

export async function listPayments(kind: TenantKind, id: string): Promise<PaymentDto[]> {
  const rows = await prisma.payment.findMany({
    where: kind === 'master' ? { masterId: id } : { salonId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(toPaymentDto);
}

function description(t: TenantBilling, lang: string): string {
  const days = env.SUBSCRIPTION_PERIOD_DAYS;
  if (lang === 'en')
    return `${t.kind === 'master' ? 'Master' : 'Salon'} subscription for ${days} days — ${t.name}`;
  return `Подписка ${t.kind === 'master' ? 'мастера' : 'салона'} на ${days} дней — ${t.name}`;
}

function returnUrl(kind: TenantKind): string {
  return config.webAppIsHttps
    ? miniAppLink({ kind: 'route', route: 'pay_return' })
    : webAppUrl(`/${kind}/subscription?paid=1`);
}

export async function createSubscriptionPayment(
  kind: TenantKind,
  id: string,
  opts: { autoRenew: boolean },
): Promise<CreatePaymentResponse> {
  const t = await loadTenant(kind, id);
  const access = accessOf(t);
  if (access.status === 'BANNED') throw forbidden('banned');
  if (access.source === 'salon-member')
    throw new AppError(409, 'coveredBySalon', 'Covered by the salon subscription');
  const price = await resolvePrice(t);
  const amountKopeks = Math.round(price.priceRub * 100);
  const desc = description(t, t.ownerLanguage);

  if (config.paymentProvider === 'mock') {
    const payment = await prisma.payment.create({
      data: {
        masterId: kind === 'master' ? id : null,
        salonId: kind === 'salon' ? id : null,
        provider: 'mock',
        externalId: `mock_${createId()}`,
        amountKopeks,
        periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
        status: 'pending',
        savePaymentMethod: opts.autoRenew,
        discountPct: price.discountPct,
        promoCodeId: t.pendingPromoId,
        description: desc,
      },
    });
    const confirmationUrl = webAppUrl(`/pay/mock/${payment.id}`);
    await prisma.payment.update({ where: { id: payment.id }, data: { confirmationUrl } });
    return {
      paymentId: payment.id,
      confirmationUrl,
      provider: 'mock',
      amountRub: amountKopeks / 100,
    };
  }

  let yoo: YooPayment;
  try {
    yoo = await createYooPayment({
      amountRub: amountKopeks / 100,
      description: desc,
      returnUrl: returnUrl(kind),
      savePaymentMethod: opts.autoRenew,
      metadata: {
        tenantKind: kind,
        tenantId: id,
        periodDays: String(env.SUBSCRIPTION_PERIOD_DAYS),
      },
      receiptCustomer: t.ownerPhone ? { phone: t.ownerPhone.replace('+', '') } : undefined,
    });
  } catch (err) {
    logger.error({ err, kind, id }, 'Failed to create YooKassa payment');
    throw new AppError(502, 'paymentFailed', 'Payment provider error');
  }
  const confirmationUrl = yoo.confirmation?.confirmation_url;
  if (!confirmationUrl) throw new AppError(502, 'paymentFailed', 'No confirmation URL');
  const payment = await prisma.payment.create({
    data: {
      masterId: kind === 'master' ? id : null,
      salonId: kind === 'salon' ? id : null,
      provider: 'yookassa',
      externalId: yoo.id,
      amountKopeks,
      periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
      status: yoo.status,
      savePaymentMethod: opts.autoRenew,
      discountPct: price.discountPct,
      promoCodeId: t.pendingPromoId,
      confirmationUrl,
      description: desc,
    },
  });
  return {
    paymentId: payment.id,
    confirmationUrl,
    provider: 'yookassa',
    amountRub: amountKopeks / 100,
  };
}

/* ───────────── Webhook processing ───────────── */

export function webhookToken(): string {
  return createHmac('sha256', env.YOOKASSA_WEBHOOK_SECRET || 'unset')
    .update(`yookassa-webhook:${env.YOOKASSA_SHOP_ID || 'mock'}`)
    .digest('hex');
}

export function verifyWebhookToken(token: string | undefined): boolean {
  if (!token || !env.YOOKASSA_WEBHOOK_SECRET) return false;
  const expected = Buffer.from(webhookToken(), 'hex');
  const actual = Buffer.from(token, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function notifyOwner(
  t: TenantBilling,
  text: string,
  kind: string,
  withPay = false,
): Promise<void> {
  const lang = langOf(t.ownerLanguage);
  await sendMessage({
    chatId: t.ownerTelegramId,
    text,
    buttons: withPay
      ? [
          [
            {
              text: tr(lang)('bot.buttons.pay'),
              app: { path: `/${t.kind}/subscription`, startParam: `go_${t.kind}_subscription` },
            },
          ],
        ]
      : undefined,
    kind,
  });
}

async function rewardMasterReferral(db: Db, masterId: string, now: Date): Promise<string[]> {
  const referral = await db.masterReferral.findUnique({ where: { referredId: masterId } });
  if (!referral || referral.rewardedAt) return [];
  const paidBefore = await db.payment.count({ where: { masterId, status: 'succeeded' } });
  if (paidBefore > 1) return [];
  await db.masterReferral.update({ where: { id: referral.id }, data: { rewardedAt: now } });
  const rewarded: string[] = [];
  for (const id of [referral.referrerId, referral.referredId]) {
    const t = await loadTenant('master', id, db);
    if (t.status === 'BANNED') continue;
    await grantDays(db, t, referral.bonusDays, now);
    rewarded.push(id);
  }
  return rewarded;
}

async function onPaymentSucceeded(yoo: YooPayment, now: Date): Promise<void> {
  let payment = await prisma.payment.findUnique({ where: { externalId: yoo.id } });
  if (!payment) {
    const kind = yoo.metadata?.tenantKind;
    const tenantId = yoo.metadata?.tenantId;
    if ((kind !== 'master' && kind !== 'salon') || !tenantId) {
      logger.warn({ id: yoo.id }, 'Succeeded payment without known tenant');
      return;
    }
    payment = await prisma.payment.create({
      data: {
        masterId: kind === 'master' ? tenantId : null,
        salonId: kind === 'salon' ? tenantId : null,
        provider: 'yookassa',
        externalId: yoo.id,
        amountKopeks: Math.round(Number(yoo.amount.value) * 100),
        periodDays: Number(yoo.metadata?.periodDays ?? env.SUBSCRIPTION_PERIOD_DAYS),
        status: 'pending',
        isAutoPayment: !!yoo.metadata?.autopay,
      },
    });
  }
  if (payment.status === 'succeeded') return;
  const kind: TenantKind = payment.masterId ? 'master' : 'salon';
  const tenantId = payment.masterId ?? payment.salonId;
  if (!tenantId) return;

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: 'succeeded' } },
      data: { status: 'succeeded', paidAt: now, paymentMethodId: yoo.payment_method?.id ?? null },
    });
    if (claimed.count === 0) return null;
    const t = await loadTenant(kind, tenantId, tx);
    const endsAt = await extendAfterPayment(tx, t, payment.periodDays, now);
    const saveMethod =
      payment.savePaymentMethod && yoo.payment_method?.saved && yoo.payment_method.id;
    await updateTenant(tx, kind, tenantId, {
      pendingDiscountPct: null,
      pendingPromoId: null,
      ...(saveMethod
        ? { yookassaPaymentMethodId: yoo.payment_method!.id, autoRenewEnabled: true }
        : {}),
    });
    const rewarded = kind === 'master' ? await rewardMasterReferral(tx, tenantId, now) : [];
    return { t, endsAt, rewarded };
  });
  if (!result) return;

  await trackFunnel(result.t.ownerUserId, 'SUBSCRIBED', kind === 'master' ? 'MASTER' : 'SALON');
  const lang = langOf(result.t.ownerLanguage);
  const fresh = await loadTenant(kind, tenantId);
  const endsAt = fresh.subscriptionEndsAt ?? result.endsAt;
  defer('billing.paid', () =>
    notifyOwner(
      result.t,
      tr(lang)('bot.billing.paymentSucceeded', {
        amount: formatMoney(payment.amountKopeks / 100, 'RUB', lang === 'ru' ? 'ru-RU' : 'en-GB'),
        date: fmtShortDate(endsAt, 'Europe/Moscow', lang),
      }),
      'billing.paymentSucceeded',
    ),
  );
  for (const masterId of result.rewarded) {
    defer('billing.referral', async () => {
      const t = await loadTenant('master', masterId);
      const l = langOf(t.ownerLanguage);
      await notifyOwner(
        t,
        tr(l)('bot.billing.referralReward', { days: env.REFERRAL_BONUS_DAYS }),
        'billing.referralReward',
      );
    });
  }
}

async function onPaymentCanceled(yoo: YooPayment): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { externalId: yoo.id } });
  if (!payment || payment.status === 'succeeded' || payment.status === 'canceled') return;
  const reason = yoo.cancellation_details?.reason ?? null;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'canceled', cancelReason: reason },
  });
  const kind: TenantKind = payment.masterId ? 'master' : 'salon';
  const tenantId = payment.masterId ?? payment.salonId;
  if (!tenantId || !payment.isAutoPayment) return;
  const t = await loadTenant(kind, tenantId);
  if (reason === 'permission_revoked' || reason === 'card_expired') {
    await updateTenant(prisma, kind, tenantId, {
      yookassaPaymentMethodId: null,
      autoRenewEnabled: false,
    });
  }
  const lang = langOf(t.ownerLanguage);
  await notifyOwner(
    t,
    tr(lang)('bot.billing.autopayFailed', {
      amount: formatMoney(payment.amountKopeks / 100, 'RUB', 'ru-RU'),
    }),
    'billing.autopayFailed',
    true,
  );
}

async function onRefundSucceeded(object: Record<string, unknown>, now: Date): Promise<void> {
  const refund = yooRefundSchema.parse(object);
  const payment = await prisma.payment.findUnique({ where: { externalId: refund.payment_id } });
  if (!payment || payment.status === 'refunded') return;
  const kind: TenantKind = payment.masterId ? 'master' : 'salon';
  const tenantId = payment.masterId ?? payment.salonId;
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
    if (!tenantId) return;
    const t = await loadTenant(kind, tenantId, tx);
    const fullRefund = Math.round(Number(refund.amount.value) * 100) >= payment.amountKopeks;
    if (fullRefund && t.subscriptionEndsAt) {
      const end = new Date(
        Math.max(now.getTime(), t.subscriptionEndsAt.getTime() - payment.periodDays * 86_400_000),
      );
      await updateTenant(tx, kind, tenantId, { subscriptionEndsAt: end });
    }
  });
  if (tenantId) {
    const t = await loadTenant(kind, tenantId);
    const lang = langOf(t.ownerLanguage);
    await notifyOwner(
      t,
      tr(lang)('bot.billing.refunded', {
        amount: formatMoney(Number(refund.amount.value), 'RUB', 'ru-RU'),
      }),
      'billing.refunded',
    );
  }
}

/**
 * Handles a YooKassa notification. For real payments the object is re-fetched from the
 * API so a forged body can never activate a subscription.
 */
export async function handleYooKassaNotification(
  n: YooNotification,
  now: Date = new Date(),
): Promise<void> {
  if (n.event === 'refund.succeeded') {
    await onRefundSucceeded(n.object, now);
    return;
  }
  if (n.event !== 'payment.succeeded' && n.event !== 'payment.canceled') return;
  const fromBody = yooPaymentSchema.parse(n.object);
  const verified =
    config.paymentProvider === 'yookassa' ? await getYooPayment(fromBody.id) : fromBody;
  if (verified.status === 'succeeded') await onPaymentSucceeded(verified, now);
  else if (verified.status === 'canceled') await onPaymentCanceled(verified);
}

/** Dev-only checkout: simulates the YooKassa webhook for a mock payment. */
export async function completeMockPayment(paymentId: string, success: boolean) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== 'mock') throw new NotFoundError();
  const object = {
    id: payment.externalId,
    status: success ? 'succeeded' : 'canceled',
    paid: success,
    amount: { value: (payment.amountKopeks / 100).toFixed(2), currency: 'RUB' },
    payment_method: {
      id: `mock_pm_${payment.masterId ?? payment.salonId}`,
      saved: payment.savePaymentMethod,
      type: 'bank_card',
      title: 'Bank card *4477',
    },
    ...(success
      ? {}
      : { cancellation_details: { party: 'payment_network', reason: 'canceled_by_user' } }),
  };
  await handleYooKassaNotification({
    type: 'notification',
    event: success ? 'payment.succeeded' : 'payment.canceled',
    object,
  });
  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  return { ...toPaymentDto(updated), kind: updated.masterId ? 'master' : 'salon' };
}

export async function getMockPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { master: { select: { name: true } }, salon: { select: { name: true } } },
  });
  if (!payment || payment.provider !== 'mock') throw new NotFoundError();
  return {
    ...toPaymentDto(payment),
    kind: payment.masterId ? 'master' : 'salon',
    tenantName: payment.master?.name ?? payment.salon?.name ?? '',
  };
}

/* ───────────── Subscription management ───────────── */

export async function cancelSubscription(kind: TenantKind, id: string): Promise<SubscriptionDto> {
  const t = await loadTenant(kind, id);
  await updateTenant(prisma, kind, id, {
    autoRenewEnabled: false,
    ...(t.status === 'ACTIVE' ? { status: 'CANCELLED' as const } : {}),
  });
  return getSubscription(kind, id);
}

export async function setAutoRenew(
  kind: TenantKind,
  id: string,
  enabled: boolean,
): Promise<SubscriptionDto> {
  const t = await loadTenant(kind, id);
  if (enabled && !t.yookassaPaymentMethodId) {
    throw new AppError(409, 'noPaymentMethod', 'Pay once to save a payment method');
  }
  await updateTenant(prisma, kind, id, {
    autoRenewEnabled: enabled,
    ...(enabled && t.status === 'CANCELLED' ? { status: 'ACTIVE' as const } : {}),
    ...(!enabled && t.status === 'ACTIVE' ? { status: 'CANCELLED' as const } : {}),
  });
  return getSubscription(kind, id);
}

/** Charges a saved payment method (cron). Mock payments succeed immediately. */
export async function chargeAutoPayment(
  kind: TenantKind,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const t = await loadTenant(kind, id);
  if (!t.autoRenewEnabled || !t.yookassaPaymentMethodId || t.status === 'BANNED') return false;
  const recent = await prisma.payment.count({
    where: {
      ...(kind === 'master' ? { masterId: id } : { salonId: id }),
      isAutoPayment: true,
      createdAt: { gt: addDays(now, -1) },
      status: { in: ['pending', 'succeeded'] },
    },
  });
  if (recent > 0) return false;
  const price = await resolvePrice(t);
  const amountKopeks = Math.round(price.priceRub * 100);
  const desc = description(t, t.ownerLanguage);

  if (config.paymentProvider === 'mock' || t.yookassaPaymentMethodId.startsWith('mock_pm_')) {
    const payment = await prisma.payment.create({
      data: {
        masterId: kind === 'master' ? id : null,
        salonId: kind === 'salon' ? id : null,
        provider: 'mock',
        externalId: `mock_${createId()}`,
        amountKopeks,
        periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
        status: 'pending',
        isAutoPayment: true,
        savePaymentMethod: true,
        description: desc,
      },
    });
    await completeMockPayment(payment.id, true);
    return true;
  }

  const yoo = await createYooPayment({
    amountRub: amountKopeks / 100,
    description: desc,
    returnUrl: null,
    savePaymentMethod: false,
    paymentMethodId: t.yookassaPaymentMethodId,
    metadata: {
      tenantKind: kind,
      tenantId: id,
      periodDays: String(env.SUBSCRIPTION_PERIOD_DAYS),
      autopay: '1',
    },
    receiptCustomer: t.ownerPhone ? { phone: t.ownerPhone.replace('+', '') } : undefined,
  });
  await prisma.payment.create({
    data: {
      masterId: kind === 'master' ? id : null,
      salonId: kind === 'salon' ? id : null,
      provider: 'yookassa',
      externalId: yoo.id,
      amountKopeks,
      periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
      status: yoo.status,
      isAutoPayment: true,
      savePaymentMethod: true,
      paymentMethodId: t.yookassaPaymentMethodId,
      description: desc,
    },
  });
  if (yoo.status === 'succeeded') await onPaymentSucceeded(yoo, now);
  if (yoo.status === 'canceled') await onPaymentCanceled(yoo);
  return true;
}
