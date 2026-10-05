import { formatMoney, type Language } from '@nail-crm/shared';
import { dateLocaleTag } from '@nail-crm/shared/i18n';
import { prisma } from '../../db/prisma';
import { langOf, tr } from '../../lib/i18n';
import { fmtDate, fmtTime, localDay } from '../../lib/time';
import { sendMessage, type MessageButton } from './notifier';

export const appointmentForNotify = {
  services: { select: { name: true } },
  client: {
    select: {
      id: true,
      firstName: true,
      telegramId: true,
      visitsCount: true,
      user: { select: { language: true, firstName: true } },
    },
  },
  master: {
    select: {
      id: true,
      slug: true,
      name: true,
      timezone: true,
      currency: true,
      address: true,
      latitude: true,
      longitude: true,
      salonId: true,
      user: { select: { telegramId: true, language: true } },
      salon: { select: { owner: { select: { telegramId: true, language: true } } } },
    },
  },
} as const;

export async function loadAppointmentForNotify(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentForNotify,
  });
}

type NotifyAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointmentForNotify>>>;

export const clientLang = (a: NotifyAppointment): Language => langOf(a.client.user?.language);
export const masterLang = (a: NotifyAppointment): Language => langOf(a.master.user.language);

export function clientName(a: NotifyAppointment): string {
  return a.client.firstName ?? a.client.user?.firstName ?? '—';
}

export function servicesText(a: NotifyAppointment): string {
  return a.services.map((s) => s.name).join(', ');
}

export function priceText(a: NotifyAppointment, lang: Language): string {
  return a.price === null
    ? '—'
    : formatMoney(Number(a.price), a.master.currency, dateLocaleTag(lang));
}

export function yandexRouteUrl(lat: number, lng: number): string {
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
}

const masterScheduleButton = (a: NotifyAppointment, lang: Language): MessageButton => ({
  text: tr(lang)('bot.buttons.openAppointment'),
  app: {
    path: `/master/schedule?date=${localDay(a.startAt, a.master.timezone)}&appointment=${a.id}`,
    startParam: 'go_master_schedule',
  },
});

const clientAppointmentButton = (a: NotifyAppointment, lang: Language): MessageButton => ({
  text: tr(lang)('bot.buttons.openAppointment'),
  app: { path: `/client/calendar?appointment=${a.id}`, startParam: `appt_view_${a.id}` },
});

/** Master (and salon owner, if any) gets a card about a new booking. */
export async function notifyNewAppointment(appointmentId: string): Promise<void> {
  const a = await loadAppointmentForNotify(appointmentId);
  if (!a) return;
  const recipients: { chatId: bigint; lang: Language; isMaster: boolean }[] = [
    { chatId: a.master.user.telegramId, lang: masterLang(a), isMaster: true },
  ];
  const owner = a.master.salon?.owner;
  if (owner && owner.telegramId !== a.master.user.telegramId) {
    recipients.push({ chatId: owner.telegramId, lang: langOf(owner.language), isMaster: false });
  }
  for (const r of recipients) {
    const t = tr(r.lang);
    let text = t('bot.master_notify.newAppointment', {
      client: clientName(a),
      services: servicesText(a),
      date: fmtDate(a.startAt, a.master.timezone, r.lang),
      time: fmtTime(a.startAt, a.master.timezone),
      price: priceText(a, r.lang),
    });
    if (a.clientComment) text += t('bot.master_notify.clientComment', { comment: a.clientComment });
    if (a.status === 'PENDING') text += t('bot.master_notify.newAppointmentPending');
    const buttons: MessageButton[][] = [];
    if (a.status === 'PENDING' && r.isMaster) {
      buttons.push([
        { text: t('bot.buttons.confirmAppointment'), callbackData: `appt:mok:${a.id}` },
      ]);
    }
    buttons.push([masterScheduleButton(a, r.lang)]);
    await sendMessage({ chatId: r.chatId, text, buttons, kind: 'master.newAppointment' });
  }
}

export async function notifyClientBookingCreated(appointmentId: string): Promise<void> {
  const a = await loadAppointmentForNotify(appointmentId);
  if (!a?.client.telegramId) return;
  const lang = clientLang(a);
  const t = tr(lang);
  const key =
    a.status === 'CONFIRMED'
      ? 'bot.client_notify.bookingConfirmed'
      : 'bot.client_notify.bookingPending';
  let text = t(key, {
    master: a.master.name,
    services: servicesText(a),
    date: fmtDate(a.startAt, a.master.timezone, lang),
    time: fmtTime(a.startAt, a.master.timezone),
  });
  if (a.master.address) text += t('bot.client_notify.address', { address: a.master.address });
  await sendMessage({
    chatId: a.client.telegramId,
    text,
    buttons: [[clientAppointmentButton(a, lang)]],
    kind: 'client.bookingCreated',
  });
}

export type ClientStatusEvent = 'confirmed' | 'cancelled' | 'rescheduled';

export async function notifyClientStatusChange(
  appointmentId: string,
  event: ClientStatusEvent,
): Promise<void> {
  const a = await loadAppointmentForNotify(appointmentId);
  if (!a?.client.telegramId) return;
  const lang = clientLang(a);
  const t = tr(lang);
  const params = {
    master: a.master.name,
    date: fmtDate(a.startAt, a.master.timezone, lang),
    time: fmtTime(a.startAt, a.master.timezone),
  };
  const text =
    event === 'confirmed'
      ? t('bot.client_notify.confirmedByMaster', params)
      : event === 'cancelled'
        ? t('bot.client_notify.cancelledByMaster', params)
        : t('bot.client_notify.rescheduledByMaster', params);
  const buttons: MessageButton[][] =
    event === 'cancelled'
      ? [
          [
            {
              text: t('bot.buttons.bookAgain'),
              app: { path: `/m/${a.master.slug}`, startParam: `m_${a.master.slug}` },
            },
          ],
        ]
      : [[clientAppointmentButton(a, lang)]];
  await sendMessage({ chatId: a.client.telegramId, text, buttons, kind: `client.${event}` });
}

export async function notifyMasterClientCancelled(appointmentId: string): Promise<void> {
  const a = await loadAppointmentForNotify(appointmentId);
  if (!a) return;
  const lang = masterLang(a);
  await sendMessage({
    chatId: a.master.user.telegramId,
    text: tr(lang)('bot.master_notify.cancelledByClient', {
      client: clientName(a),
      date: fmtDate(a.startAt, a.master.timezone, lang),
      time: fmtTime(a.startAt, a.master.timezone),
    }),
    buttons: [[masterScheduleButton(a, lang)]],
    kind: 'master.clientCancelled',
  });
}

export async function notifyMasterClientRescheduled(
  appointmentId: string,
  oldStartAt: Date,
): Promise<void> {
  const a = await loadAppointmentForNotify(appointmentId);
  if (!a) return;
  const lang = masterLang(a);
  const tz = a.master.timezone;
  await sendMessage({
    chatId: a.master.user.telegramId,
    text: tr(lang)('bot.master_notify.rescheduledByClient', {
      client: clientName(a),
      oldDate: `${fmtDate(oldStartAt, tz, lang)}, ${fmtTime(oldStartAt, tz)}`,
      newDate: `${fmtDate(a.startAt, tz, lang)}, ${fmtTime(a.startAt, tz)}`,
    }),
    buttons: [[masterScheduleButton(a, lang)]],
    kind: 'master.clientRescheduled',
  });
}

export async function notifyMasterClientConfirmed(appointmentId: string): Promise<void> {
  const a = await loadAppointmentForNotify(appointmentId);
  if (!a) return;
  const lang = masterLang(a);
  await sendMessage({
    chatId: a.master.user.telegramId,
    text: tr(lang)('bot.master_notify.clientConfirmed', {
      client: clientName(a),
      date: fmtDate(a.startAt, a.master.timezone, lang),
      time: fmtTime(a.startAt, a.master.timezone),
    }),
    kind: 'master.clientConfirmed',
  });
}

export async function notifyMasterNewReview(reviewId: string): Promise<void> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { master: { select: { user: { select: { telegramId: true, language: true } } } } },
  });
  if (!review) return;
  const lang = langOf(review.master.user.language);
  await sendMessage({
    chatId: review.master.user.telegramId,
    text: tr(lang)('bot.master_notify.newReview', {
      client: review.clientName,
      rating: review.rating,
    }),
    buttons: [
      [
        {
          text: tr(lang)('bot.buttons.openApp'),
          app: { path: '/master/reviews', startParam: 'go_master_reviews' },
        },
      ],
    ],
    kind: 'master.newReview',
  });
}
