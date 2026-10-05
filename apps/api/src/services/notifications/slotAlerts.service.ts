import { LIMITS } from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import { computeMasterAccess } from '../../lib/access';
import { langOf, tr } from '../../lib/i18n';
import { fmtDate, fmtTime, localDay } from '../../lib/time';
import { hasOverlap } from '../slots.service';
import { canSendSlotAlert } from './antispam';
import { sendMessage } from './notifier';

const MAX_RECIPIENTS = 300;

interface Recipient {
  id: string;
  telegramId: bigint;
  language: string | null;
}

/**
 * Clients of a master who opted in to free-slot alerts (per master and globally),
 * excluding blacklisted ones.
 */
async function slotAlertRecipients(
  masterId: string,
  excludeClientId?: string | null,
): Promise<Recipient[]> {
  const [clients, blacklist] = await Promise.all([
    prisma.client.findMany({
      where: {
        masterId,
        telegramId: { not: null },
        slotAlertsEnabled: true,
        ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
        OR: [
          { userId: null },
          { user: { is: { clientProfile: { is: null } } } },
          { user: { is: { clientProfile: { is: { slotAlertsEnabled: true } } } } },
        ],
      },
      select: {
        id: true,
        telegramId: true,
        username: true,
        phone: true,
        user: { select: { language: true } },
      },
      take: MAX_RECIPIENTS * 2,
      orderBy: { lastVisitAt: { sort: 'desc', nulls: 'last' } },
    }),
    prisma.blacklistEntry.findMany({
      where: { masterId },
      select: { username: true, phone: true },
    }),
  ]);
  const blockedUsernames = new Set(blacklist.map((b) => b.username).filter(Boolean));
  const blockedPhones = new Set(blacklist.map((b) => b.phone).filter(Boolean));
  return clients
    .filter(
      (c) =>
        !(c.username && blockedUsernames.has(c.username)) &&
        !(c.phone && blockedPhones.has(c.phone)),
    )
    .slice(0, MAX_RECIPIENTS)
    .map((c) => ({
      id: c.id,
      telegramId: c.telegramId as bigint,
      language: c.user?.language ?? null,
    }));
}

async function loadMasterForAlerts(masterId: string) {
  return prisma.master.findUnique({
    where: { id: masterId },
    select: {
      id: true,
      slug: true,
      name: true,
      timezone: true,
      status: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      autoRenewEnabled: true,
      salonId: true,
      salon: {
        select: {
          status: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          autoRenewEnabled: true,
        },
      },
      settings: { select: { slotAlertsEnabled: true } },
    },
  });
}

export interface SlotFreedEvent {
  masterId: string;
  startAt: Date;
  endAt: Date;
  appointmentId?: string | null;
  /** The client who freed the slot is never notified about it. */
  excludeClientId?: string | null;
  now?: Date;
}

/** Sent when a slot frees up after a cancellation or reschedule. Returns recipients count. */
export async function triggerSlotFreed(event: SlotFreedEvent): Promise<number> {
  const now = event.now ?? new Date();
  if (event.startAt.getTime() - now.getTime() < LIMITS.slotAlertMinLeadMinutes * 60_000) return 0;
  const master = await loadMasterForAlerts(event.masterId);
  if (!master || master.settings?.slotAlertsEnabled === false) return 0;
  if (!computeMasterAccess(master, master.salon, now).canNotify) return 0;
  if (await hasOverlap(master.id, event.startAt, event.endAt)) return 0;

  const recipients = await slotAlertRecipients(master.id, event.excludeClientId);
  let sent = 0;
  for (const r of recipients) {
    if (!(await canSendSlotAlert(r.telegramId, now))) continue;
    const lang = langOf(r.language);
    const t = tr(lang);
    const ok = await sendMessage({
      chatId: r.telegramId,
      text: t('bot.client_notify.slotAlert', {
        master: master.name,
        date: fmtDate(event.startAt, master.timezone, lang),
        time: fmtTime(event.startAt, master.timezone),
      }),
      buttons: [
        [
          {
            text: t('bot.buttons.book'),
            app: {
              path: `/m/${master.slug}?date=${localDay(event.startAt, master.timezone)}`,
              startParam: `m_${master.slug}`,
            },
          },
        ],
      ],
      kind: 'client.slotAlert',
    });
    if (!ok) continue;
    await prisma.slotAlert.create({
      data: {
        masterId: master.id,
        clientId: r.id,
        telegramId: r.telegramId,
        appointmentId: event.appointmentId ?? null,
        startAt: event.startAt,
        sentAt: now,
      },
    });
    sent += 1;
  }
  return sent;
}

/** "Available right now" announcement to subscribed clients (same anti-spam rules). */
export async function announceOnlineOpen(
  masterId: string,
  until: Date,
  now: Date = new Date(),
): Promise<number> {
  const master = await loadMasterForAlerts(masterId);
  if (!master || master.settings?.slotAlertsEnabled === false) return 0;
  if (!computeMasterAccess(master, master.salon, now).canNotify) return 0;
  const recipients = await slotAlertRecipients(master.id);
  let sent = 0;
  for (const r of recipients) {
    if (!(await canSendSlotAlert(r.telegramId, now))) continue;
    const lang = langOf(r.language);
    const t = tr(lang);
    const ok = await sendMessage({
      chatId: r.telegramId,
      text: t('bot.client_notify.onlineOpen', {
        master: master.name,
        until: fmtTime(until, master.timezone),
      }),
      buttons: [
        [
          {
            text: t('bot.buttons.book'),
            app: { path: `/m/${master.slug}`, startParam: `m_${master.slug}` },
          },
        ],
      ],
      kind: 'client.onlineOpen',
    });
    if (!ok) continue;
    await prisma.slotAlert.create({
      data: {
        masterId: master.id,
        clientId: r.id,
        telegramId: r.telegramId,
        startAt: now,
        sentAt: now,
      },
    });
    sent += 1;
  }
  return sent;
}
