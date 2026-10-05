import {
  accessEndsAt,
  addDaysIso,
  daysFromBirthday,
  effectiveStatus,
  formatMoney,
  toMinutes,
  type TenantKind,
} from '@nail-crm/shared';
import { config, env } from '../config';
import { Prisma, prisma } from '../db/prisma';
import { computeMasterAccess } from '../lib/access';
import { langOf, tr } from '../lib/i18n';
import { escapeHtml } from '@nail-crm/shared';
import {
  addDays,
  addHours,
  addMinutes,
  fmtShortDate,
  fmtTime,
  localParts,
  startOfLocalDay,
} from '../lib/time';
import { logger } from '../logger';
import { chargeAutoPayment, loadTenant } from '../services/billing/billing.service';
import { trackFunnel } from '../services/funnel.service';
import {
  clientLang,
  clientName,
  loadAppointmentForNotify,
  masterLang,
  servicesText,
  yandexRouteUrl,
} from '../services/notifications/messages';
import {
  sendMessage,
  type MessageButton,
  type OutgoingMessage,
} from '../services/notifications/notifier';
import { getPlatformSettings } from '../services/settings.service';
import { getDaySlots } from '../services/slots.service';

const PTZ = env.PLATFORM_TIMEZONE;

/** Sends a message at most once per key (NotificationLog unique constraint). */
export async function sendOnce(key: string, message: OutgoingMessage): Promise<boolean> {
  try {
    await prisma.notificationLog.create({
      data: {
        key,
        kind: message.kind,
        chatId: typeof message.chatId === 'bigint' ? message.chatId : BigInt(message.chatId),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
  const ok = await sendMessage(message);
  if (!ok) await prisma.notificationLog.delete({ where: { key } }).catch(() => undefined);
  return ok;
}

const masterNotifySelect = {
  id: true,
  status: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  autoRenewEnabled: true,
  salonId: true,
  salon: {
    select: { status: true, trialEndsAt: true, subscriptionEndsAt: true, autoRenewEnabled: true },
  },
} as const;

/* ───────────── Appointment reminders, postcard and review request ───────────── */

export async function runAppointmentReminders(
  now: Date = new Date(),
): Promise<Record<string, number>> {
  const counters = { rem24: 0, rem2: 0, master30: 0, postcard: 0, review: 0 };
  const active = { status: { in: ['PENDING' as const, 'CONFIRMED' as const] } };

  const candidates24 = await prisma.appointment.findMany({
    where: {
      ...active,
      startAt: { gte: addHours(now, 2), lte: addHours(now, 24) },
      createdAt: { lte: addHours(now, -3) },
    },
    select: { id: true },
  });
  const candidates2 = await prisma.appointment.findMany({
    where: {
      ...active,
      startAt: { gte: addMinutes(now, 30), lte: addHours(now, 2) },
      createdAt: { lte: addMinutes(now, -30) },
    },
    select: { id: true },
  });

  for (const [list, kind] of [
    [candidates24, 'rem24'],
    [candidates2, 'rem2'],
  ] as const) {
    for (const { id } of list) {
      const a = await loadAppointmentForNotify(id);
      if (!a?.client.telegramId) continue;
      const master = await prisma.master.findUniqueOrThrow({
        where: { id: a.masterId },
        select: masterNotifySelect,
      });
      if (!computeMasterAccess(master, master.salon, now).canNotify) continue;
      const lang = clientLang(a);
      const t = tr(lang);
      const history = await prisma.appointment.findMany({
        where: {
          clientId: a.clientId,
          id: { not: a.id },
          OR: [{ status: 'NO_SHOW' }, { clientLate: true }, { status: 'COMPLETED' }],
        },
        select: { status: true, clientLate: true },
      });
      const isFirstVisit = !history.some((h) => h.status === 'COMPLETED');
      const wasLate = history.some((h) => h.status === 'NO_SHOW' || h.clientLate);
      const params = {
        name: clientName(a),
        master: a.master.name,
        services: servicesText(a),
        time: fmtTime(a.startAt, a.master.timezone),
      };
      let text =
        kind === 'rem24'
          ? t('bot.client_notify.reminder24', params)
          : t('bot.client_notify.reminder2h', params);
      if (isFirstVisit && a.master.address)
        text += t('bot.client_notify.firstVisit', { address: a.master.address });
      if (wasLate) text += t('bot.client_notify.beOnTime');
      const buttons: MessageButton[][] = [];
      if (!a.clientConfirmedAt)
        buttons.push([{ text: t('bot.buttons.confirmVisit'), callbackData: `appt:ok:${a.id}` }]);
      buttons.push([
        {
          text: t('bot.buttons.reschedule'),
          app: {
            path: `/client/calendar?reschedule=${a.id}`,
            startParam: `appt_reschedule_${a.id}`,
          },
        },
        { text: t('bot.buttons.cancel'), callbackData: `appt:cx:${a.id}` },
      ]);
      if (isFirstVisit && a.master.latitude !== null && a.master.longitude !== null) {
        buttons.push([
          {
            text: t('bot.buttons.route'),
            url: yandexRouteUrl(a.master.latitude, a.master.longitude),
          },
        ]);
      }
      if (
        await sendOnce(`${kind}:${a.id}`, {
          chatId: a.client.telegramId,
          text,
          buttons,
          kind: `client.${kind}`,
        })
      ) {
        counters[kind] += 1;
      }
    }
  }

  const soon = await prisma.appointment.findMany({
    where: { ...active, startAt: { gte: now, lte: addMinutes(now, 30) } },
    select: { id: true },
  });
  for (const { id } of soon) {
    const a = await loadAppointmentForNotify(id);
    if (!a) continue;
    const lang = masterLang(a);
    const ok = await sendOnce(`master30:${a.id}`, {
      chatId: a.master.user.telegramId,
      text: tr(lang)('bot.master_notify.reminder30', {
        client: clientName(a),
        services: servicesText(a),
        time: fmtTime(a.startAt, a.master.timezone),
      }),
      kind: 'master.reminder30',
    });
    if (ok) counters.master30 += 1;
  }

  const completed = await prisma.appointment.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { gte: addHours(now, -72), lte: addHours(now, -1) },
    },
    select: {
      id: true,
      completedAt: true,
      afterPhotoUrl: true,
      review: { select: { id: true } },
      master: { select: { postVisitMessage: true } },
    },
  });
  for (const c of completed) {
    const a = await loadAppointmentForNotify(c.id);
    if (!a?.client.telegramId || !c.completedAt) continue;
    const lang = clientLang(a);
    const t = tr(lang);
    if (c.completedAt >= addHours(now, -48)) {
      const custom = c.master.postVisitMessage?.trim();
      const text = custom
        ? escapeHtml(custom).replace(/\{name\}/g, escapeHtml(clientName(a)))
        : t('bot.client_notify.postcardDefault', { name: clientName(a) });
      const ok = await sendOnce(`postcard:${a.id}`, {
        chatId: a.client.telegramId,
        text,
        photo: c.afterPhotoUrl,
        buttons: [
          [
            {
              text: t('bot.buttons.bookAgain'),
              app: { path: `/m/${a.master.slug}`, startParam: `m_${a.master.slug}` },
            },
          ],
        ],
        kind: 'client.postcard',
      });
      if (ok) counters.postcard += 1;
    }
    if (!c.review && c.completedAt <= addHours(now, -3)) {
      const ok = await sendOnce(`review:${a.id}`, {
        chatId: a.client.telegramId,
        text: t('bot.client_notify.reviewRequest', { master: a.master.name }),
        buttons: [
          [
            {
              text: t('bot.buttons.leaveReview'),
              app: { path: `/client/calendar?review=${a.id}`, startParam: `appt_review_${a.id}` },
            },
          ],
        ],
        kind: 'client.reviewRequest',
      });
      if (ok) counters.review += 1;
    }
  }
  return counters;
}

/* ───────────── Master summaries ───────────── */

async function mastersForSummary(field: 'dailyReminderEnabled' | 'morningSummaryEnabled') {
  return prisma.master.findMany({
    where: { status: { not: 'BANNED' }, settings: { is: { [field]: true } } },
    select: {
      ...masterNotifySelect,
      timezone: true,
      user: { select: { telegramId: true, language: true } },
      settings: { select: { dailyReminderTime: true, dailyReminderSendEmpty: true } },
    },
  });
}

/**
 * Evening summary: only the number of tomorrow's appointments and a button.
 * The list itself is never sent — details are in the Mini App.
 */
export async function runEveningSummaries(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const m of await mastersForSummary('dailyReminderEnabled')) {
    if (!m.settings || !computeMasterAccess(m, m.salon, now).canNotify) continue;
    const local = localParts(now, m.timezone);
    const target = toMinutes(m.settings.dailyReminderTime);
    if (local.minutes < target || local.minutes >= target + 15) continue;
    const tomorrow = addDaysIso(local.day, 1);
    const count = await prisma.appointment.count({
      where: {
        masterId: m.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: {
          gte: startOfLocalDay(tomorrow, m.timezone),
          lt: startOfLocalDay(addDaysIso(tomorrow, 1), m.timezone),
        },
      },
    });
    if (count === 0 && !m.settings.dailyReminderSendEmpty) continue;
    const t = tr(langOf(m.user.language));
    const ok = await sendOnce(`evening:${m.id}:${local.day}`, {
      chatId: m.user.telegramId,
      text:
        count > 0
          ? t('bot.master_notify.eveningSummary', { count })
          : t('bot.master_notify.eveningSummaryEmpty'),
      buttons:
        count > 0
          ? [
              [
                {
                  text: t('bot.buttons.openSchedule'),
                  app: {
                    path: `/master/schedule?date=${tomorrow}`,
                    startParam: 'go_master_schedule',
                  },
                },
              ],
            ]
          : undefined,
      kind: 'master.eveningSummary',
    });
    if (ok) sent += 1;
  }
  return sent;
}

/** 9:00 local: today's count (no list) for masters who have appointments. */
export async function runMorningSummaries(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const m of await mastersForSummary('morningSummaryEnabled')) {
    if (!computeMasterAccess(m, m.salon, now).canNotify) continue;
    const local = localParts(now, m.timezone);
    if (local.minutes < 9 * 60 || local.minutes >= 9 * 60 + 15) continue;
    const count = await prisma.appointment.count({
      where: {
        masterId: m.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gte: now, lt: startOfLocalDay(addDaysIso(local.day, 1), m.timezone) },
      },
    });
    if (count === 0) continue;
    const t = tr(langOf(m.user.language));
    const ok = await sendOnce(`morning:${m.id}:${local.day}`, {
      chatId: m.user.telegramId,
      text: t('bot.master_notify.morningSummary', { count }),
      buttons: [
        [
          {
            text: t('bot.buttons.openSchedule'),
            app: { path: `/master/schedule?date=${local.day}`, startParam: 'go_master_schedule' },
          },
        ],
      ],
      kind: 'master.morningSummary',
    });
    if (ok) sent += 1;
  }
  return sent;
}

/* ───────────── Subscriptions ───────────── */

interface BillingTenant {
  kind: TenantKind;
  id: string;
}

async function billingTenants(): Promise<BillingTenant[]> {
  const [masters, salons] = await Promise.all([
    prisma.master.findMany({ where: { status: { not: 'BANNED' } }, select: { id: true } }),
    prisma.salon.findMany({ where: { status: { not: 'BANNED' } }, select: { id: true } }),
  ]);
  return [
    ...masters.map((m) => ({ kind: 'master' as const, id: m.id })),
    ...salons.map((s) => ({ kind: 'salon' as const, id: s.id })),
  ];
}

const payButton = (kind: TenantKind, lang: string): MessageButton[][] => [
  [
    {
      text: tr(langOf(lang))('bot.buttons.pay'),
      app: { path: `/${kind}/subscription`, startParam: `go_${kind}_subscription` },
    },
  ],
];

export async function runSubscriptionReminders(now: Date = new Date()): Promise<number> {
  let sent = 0;
  const today = localParts(now, PTZ).day;
  for (const ref of await billingTenants()) {
    const t = await loadTenant(ref.kind, ref.id);
    if (t.kind === 'master' && t.salon) continue;
    const status = effectiveStatus(t, now);
    if (status === 'EXPIRED' || status === 'BANNED') continue;
    if (status === 'ACTIVE' && t.autoRenewEnabled && t.yookassaPaymentMethodId) continue;
    const end = accessEndsAt(t);
    if (!end) continue;
    const lang = langOf(t.ownerLanguage);
    const endKey = end.toISOString().slice(0, 10);
    if (end > addDays(now, 2) && end <= addDays(now, 3)) {
      const ok = await sendOnce(`sub3:${t.kind}:${t.id}:${endKey}`, {
        chatId: t.ownerTelegramId,
        text: tr(lang)('bot.billing.ends3days', { date: fmtShortDate(end, PTZ, lang) }),
        buttons: payButton(t.kind, t.ownerLanguage),
        kind: 'billing.ends3days',
      });
      if (ok) sent += 1;
    }
    if (end > now && localParts(end, PTZ).day === today) {
      const ok = await sendOnce(`subToday:${t.kind}:${t.id}:${endKey}`, {
        chatId: t.ownerTelegramId,
        text: tr(lang)('bot.billing.endsToday'),
        buttons: payButton(t.kind, t.ownerLanguage),
        kind: 'billing.endsToday',
      });
      if (ok) sent += 1;
    }
  }
  return sent;
}

/** Moves overdue tenants to EXPIRED and tells their owners. */
export async function runExpireSubscriptions(now: Date = new Date()): Promise<number> {
  const overdue = {
    OR: [
      { status: 'TRIAL' as const, trialEndsAt: { lte: now } },
      {
        status: { in: ['ACTIVE' as const, 'CANCELLED' as const] },
        subscriptionEndsAt: { lte: now },
      },
    ],
  };
  const [masters, salons] = await Promise.all([
    prisma.master.findMany({ where: overdue, select: { id: true } }),
    prisma.salon.findMany({ where: overdue, select: { id: true } }),
  ]);
  let expired = 0;
  for (const ref of [
    ...masters.map((m) => ({ kind: 'master' as const, id: m.id })),
    ...salons.map((s) => ({ kind: 'salon' as const, id: s.id })),
  ]) {
    const t = await loadTenant(ref.kind, ref.id);
    const end = accessEndsAt(t);
    if (ref.kind === 'master')
      await prisma.master.update({
        where: { id: ref.id },
        data: { status: 'EXPIRED', isOnlineOpen: false },
      });
    else await prisma.salon.update({ where: { id: ref.id }, data: { status: 'EXPIRED' } });
    expired += 1;
    const coveredBySalon =
      ref.kind === 'master' && t.salon && effectiveStatus(t.salon, now) !== 'EXPIRED';
    if (coveredBySalon) continue;
    await trackFunnel(t.ownerUserId, 'CHURNED', ref.kind === 'master' ? 'MASTER' : 'SALON');
    const lang = langOf(t.ownerLanguage);
    await sendOnce(`expired:${ref.kind}:${ref.id}:${end?.toISOString().slice(0, 10) ?? 'none'}`, {
      chatId: t.ownerTelegramId,
      text: tr(lang)('bot.billing.expired'),
      buttons: payButton(ref.kind, t.ownerLanguage),
      kind: 'billing.expired',
    });
  }
  return expired;
}

export async function runAutoPayments(now: Date = new Date()): Promise<number> {
  const due = {
    autoRenewEnabled: true,
    yookassaPaymentMethodId: { not: null },
    status: 'ACTIVE' as const,
    subscriptionEndsAt: { lte: addDays(now, env.AUTOPAY_DAYS_BEFORE), gt: addDays(now, -3) },
  };
  const [masters, salons] = await Promise.all([
    prisma.master.findMany({
      where: { ...due, salonId: null },
      select: { id: true, subscriptionEndsAt: true },
    }),
    prisma.salon.findMany({ where: due, select: { id: true, subscriptionEndsAt: true } }),
  ]);
  let charged = 0;
  for (const [kind, rows] of [
    ['master', masters],
    ['salon', salons],
  ] as const) {
    for (const row of rows) {
      try {
        if (await chargeAutoPayment(kind, row.id, now)) charged += 1;
      } catch (err) {
        logger.error({ err, kind, id: row.id }, 'Autopayment failed');
      }
    }
  }
  return charged;
}

/* ───────────── Online window auto-close ───────────── */

export async function runOnlineAutoClose(now: Date = new Date()): Promise<number> {
  const open = await prisma.master.findMany({
    where: { isOnlineOpen: true },
    select: {
      id: true,
      timezone: true,
      onlineOpenUntil: true,
      user: { select: { telegramId: true, language: true } },
      services: {
        where: { isActive: true, deletedAt: null },
        orderBy: { duration: 'asc' },
        take: 1,
        select: { id: true },
      },
    },
  });
  let closed = 0;
  for (const m of open) {
    let shouldClose = !m.onlineOpenUntil || m.onlineOpenUntil <= now;
    if (!shouldClose && m.services[0]) {
      const day = localParts(now, m.timezone).day;
      const { slots } = await getDaySlots(m.id, [m.services[0].id], day, { now });
      shouldClose = !slots.some((s) => s.startAt < m.onlineOpenUntil!);
    }
    if (!shouldClose) continue;
    await prisma.master.update({
      where: { id: m.id },
      data: { isOnlineOpen: false, onlineOpenUntil: null },
    });
    closed += 1;
    await sendMessage({
      chatId: m.user.telegramId,
      text: tr(langOf(m.user.language))('bot.master_notify.onlineClosed'),
      kind: 'master.onlineClosed',
    });
  }
  return closed;
}

/* ───────────── Birthdays ───────────── */

export async function runBirthdays(
  now: Date = new Date(),
): Promise<{ masters: number; clients: number }> {
  const result = { masters: 0, clients: 0 };
  const masters = await prisma.master.findMany({
    where: { status: { not: 'BANNED' } },
    select: {
      ...masterNotifySelect,
      name: true,
      slug: true,
      timezone: true,
      user: { select: { telegramId: true, language: true } },
      loyaltyRules: { where: { type: 'BIRTHDAY', isActive: true }, select: { discountPct: true } },
    },
  });
  for (const m of masters) {
    if (!computeMasterAccess(m, m.salon, now).canNotify) continue;
    const today = localParts(now, m.timezone).day;
    const tomorrow = addDaysIso(today, 1);
    const clients = await prisma.client.findMany({
      where: { masterId: m.id, birthday: { not: null } },
      select: {
        id: true,
        firstName: true,
        birthday: true,
        telegramId: true,
        broadcastEnabled: true,
        user: { select: { language: true, clientProfile: { select: { broadcastEnabled: true } } } },
      },
    });
    const sameDay = (b: Date, day: string) => daysFromBirthday(b, day) === 0;
    const tomorrowNames = clients
      .filter((c) => c.birthday && sameDay(c.birthday, tomorrow))
      .map((c) => c.firstName ?? '—');
    if (tomorrowNames.length) {
      const ok = await sendOnce(`bday-m:${m.id}:${tomorrow}`, {
        chatId: m.user.telegramId,
        text: tr(langOf(m.user.language))('bot.master_notify.birthdayTomorrow', {
          names: tomorrowNames.join(', '),
        }),
        kind: 'master.birthdayTomorrow',
      });
      if (ok) result.masters += 1;
    }
    const rule = m.loyaltyRules[0];
    if (!rule) continue;
    for (const c of clients) {
      if (!c.birthday || !sameDay(c.birthday, today) || !c.telegramId) continue;
      if (!c.broadcastEnabled || c.user?.clientProfile?.broadcastEnabled === false) continue;
      const lang = langOf(c.user?.language);
      const t = tr(lang);
      const ok = await sendOnce(`bday-c:${c.id}:${today.slice(0, 4)}`, {
        chatId: c.telegramId,
        text: t('bot.client_notify.birthday', {
          name: c.firstName ?? '',
          master: m.name,
          pct: rule.discountPct,
        }),
        buttons: [
          [
            {
              text: t('bot.buttons.book'),
              app: { path: `/m/${m.slug}`, startParam: `m_${m.slug}` },
            },
          ],
        ],
        kind: 'client.birthday',
      });
      if (ok) result.clients += 1;
    }
  }
  return result;
}

/* ───────────── Weekly digest for the platform owner ───────────── */

export async function sendWeeklyDigest(now: Date = new Date(), force = false): Promise<boolean> {
  if (!config.ownerTelegramId) return false;
  const settings = await getPlatformSettings();
  if (!settings.weeklyDigestEnabled && !force) return false;
  const weekAgo = addDays(now, -7);
  const [newMasters, newSalons, payments, mastersAll, salonsAll, top, owner] = await Promise.all([
    prisma.master.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.salon.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.payment.findMany({
      where: { status: 'succeeded', paidAt: { gte: weekAgo } },
      select: { amountKopeks: true },
    }),
    prisma.master.findMany({
      select: {
        status: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        salonId: true,
        createdAt: true,
        payments: { where: { status: 'succeeded' }, take: 1, select: { id: true } },
      },
    }),
    prisma.salon.findMany({
      select: { status: true, trialEndsAt: true, subscriptionEndsAt: true },
    }),
    prisma.appointment.groupBy({
      by: ['masterId'],
      where: { status: 'COMPLETED', startAt: { gte: weekAgo } },
      _sum: { price: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 3,
    }),
    prisma.user.findUnique({
      where: { telegramId: config.ownerTelegramId },
      select: { language: true },
    }),
  ]);
  const lang = langOf(owner?.language);
  const t = tr(lang);
  const activeMasters = mastersAll.filter(
    (m) => !m.salonId && effectiveStatus(m, now) === 'ACTIVE',
  ).length;
  const activeSalons = salonsAll.filter((s) => effectiveStatus(s, now) === 'ACTIVE').length;
  const mrr = activeMasters * settings.masterPriceRub + activeSalons * settings.salonPriceRub;
  const pastTrial = mastersAll.filter((m) => m.createdAt <= addDays(now, -settings.trialDays));
  const conversion = pastTrial.length
    ? Math.round(
        (pastTrial.filter((m) => m.payments.length > 0).length / pastTrial.length) * 1000,
      ) / 10
    : 0;
  const topInfo = await prisma.master.findMany({
    where: { id: { in: top.map((x) => x.masterId) } },
    select: { id: true, name: true },
  });
  const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const topText = top.length
    ? top
        .map(
          (x, i) =>
            `${i + 1}. ${escapeHtml(topInfo.find((m) => m.id === x.masterId)?.name ?? '—')} — ${formatMoney(Number(x._sum.price ?? 0), 'RUB', locale)}`,
        )
        .join('\n')
    : t('bot.owner.noTop');
  const week = localParts(now, PTZ).day;
  const message: OutgoingMessage = {
    chatId: config.ownerTelegramId,
    text: t('bot.owner.weeklyDigest', {
      newMasters,
      newSalons,
      mrr: formatMoney(mrr, 'RUB', locale),
      revenue: formatMoney(payments.reduce((s, p) => s + p.amountKopeks, 0) / 100, 'RUB', locale),
      payments: payments.length,
      conversion,
      top: topText,
      interpolation: { escapeValue: false },
    }),
    buttons: [
      [{ text: t('bot.buttons.openAdmin'), app: { path: '/admin', startParam: 'go_admin' } }],
    ],
    kind: 'owner.weeklyDigest',
  };
  if (force) return sendMessage(message);
  return sendOnce(`digest:${week}`, message);
}

export const JOB_NAMES = [
  'reminders',
  'evening',
  'morning',
  'subscriptionReminders',
  'expire',
  'autopay',
  'onlineClose',
  'birthdays',
  'digest',
] as const;
export type JobName = (typeof JOB_NAMES)[number];

export async function runJobByName(name: JobName, now: Date = new Date()): Promise<unknown> {
  switch (name) {
    case 'reminders':
      return runAppointmentReminders(now);
    case 'evening':
      return runEveningSummaries(now);
    case 'morning':
      return runMorningSummaries(now);
    case 'subscriptionReminders':
      return runSubscriptionReminders(now);
    case 'expire':
      return runExpireSubscriptions(now);
    case 'autopay':
      return runAutoPayments(now);
    case 'onlineClose':
      return runOnlineAutoClose(now);
    case 'birthdays':
      return runBirthdays(now);
    case 'digest':
      return sendWeeklyDigest(now);
  }
}
