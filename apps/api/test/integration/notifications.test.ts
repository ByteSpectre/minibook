import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runAppointmentReminders, runEveningSummaries } from '../../src/cron/jobs';
import { prisma } from '../../src/db/prisma';
import { drainDeferred } from '../../src/lib/deferred';
import { addDaysIso } from '@nail-crm/shared';
import { addDays, addHours, localParts, zonedToUtc } from '../../src/lib/time';
import { clearOutbox, getOutbox } from '../../src/services/notifications/notifier';
import { triggerSlotFreed } from '../../src/services/notifications/slotAlerts.service';
import {
  as,
  createAppointment,
  createClient,
  createClientUser,
  createMaster,
  dictionaries,
  resetDb,
  type Dictionaries,
} from '../helpers';

let dict: Dictionaries;

beforeAll(async () => {
  await resetDb();
  dict = await dictionaries();
});

beforeEach(() => clearOutbox());

describe('evening summary', () => {
  const day = (offset: number) => addDaysIso(localParts(new Date(), 'Europe/Moscow').day, offset);

  it('sends only the count and a button at the configured local time', async () => {
    const m = await createMaster(dict, { slug: 'evening-master' });
    const client = await createClient(m.masterId, { firstName: 'Секретная Клиентка' });
    const evening = zonedToUtc(day(1), 20 * 60 + 2, 'Europe/Moscow');
    for (const hour of [10, 13, 16]) {
      await createAppointment(
        m.masterId,
        client.id,
        m.serviceIds[0]!,
        zonedToUtc(day(2), hour * 60, 'Europe/Moscow'),
      );
    }
    expect(await runEveningSummaries(zonedToUtc(day(1), 19 * 60, 'Europe/Moscow'))).toBe(0);
    expect(await runEveningSummaries(evening)).toBe(1);
    const msg = getOutbox().find((x) => x.kind === 'master.eveningSummary')!;
    expect(msg.text).toContain('3');
    expect(msg.text).not.toContain('Секретная');
    expect(msg.text).not.toContain('Маникюр');
    expect(msg.buttons.flat().map((b) => b.text)).toEqual(['📅 Открыть расписание']);
    expect(await runEveningSummaries(evening)).toBe(0);
  });

  it('respects the "notify even without appointments" toggle', async () => {
    const m = await createMaster(dict, { slug: 'empty-evening' });
    const at = zonedToUtc(day(3), 20 * 60, 'Europe/Moscow');
    expect(await runEveningSummaries(at)).toBe(0);
    await prisma.masterSettings.update({
      where: { masterId: m.masterId },
      data: { dailyReminderSendEmpty: true },
    });
    expect(await runEveningSummaries(at)).toBe(1);
    expect(getOutbox()[0]!.text).toContain('Завтра записей нет');
  });
});

describe('appointment reminders', () => {
  it('sends the 24h reminder with confirm / reschedule / cancel buttons once', async () => {
    const m = await createMaster(dict, { slug: 'reminder-master' });
    const { user } = await createClientUser({ firstName: 'Анна' });
    const client = await createClient(m.masterId, {
      firstName: 'Анна',
      userId: user.id,
      telegramId: user.telegramId,
    });
    const now = new Date();
    await createAppointment(
      m.masterId,
      client.id,
      m.serviceIds[0]!,
      addHours(now, 20),
      'CONFIRMED',
      { createdAt: addDays(now, -3) },
    );
    const result = await runAppointmentReminders(now);
    expect(result.rem24).toBe(1);
    const msg = getOutbox().find((x) => x.kind === 'client.rem24')!;
    expect(msg.text).toContain('Анна');
    const callbacks = msg.buttons.flat().map((b) => b.callbackData ?? b.text);
    expect(callbacks.some((c) => c?.startsWith('appt:ok:'))).toBe(true);
    expect(callbacks.some((c) => c?.startsWith('appt:cx:'))).toBe(true);
    expect((await runAppointmentReminders(now)).rem24).toBe(0);
  });
});

describe('free-slot alerts', () => {
  it('notifies subscribed clients with 1/hour and 3/day limits and honours opt-outs', async () => {
    const m = await createMaster(dict, { slug: 'alerts-master' });
    const fans = await Promise.all([1, 2, 3].map(() => createClientUser()));
    const [fan, optedOutLocal, optedOutGlobal] = fans;
    await createClient(m.masterId, { userId: fan!.user.id, telegramId: fan!.user.telegramId });
    await prisma.client.create({
      data: {
        masterId: m.masterId,
        userId: optedOutLocal!.user.id,
        telegramId: optedOutLocal!.user.telegramId,
        slotAlertsEnabled: false,
      },
    });
    await createClient(m.masterId, {
      userId: optedOutGlobal!.user.id,
      telegramId: optedOutGlobal!.user.telegramId,
    });
    await prisma.clientProfile.update({
      where: { userId: optedOutGlobal!.user.id },
      data: { slotAlertsEnabled: false },
    });

    const start = new Date();
    const slot = (h: number) => ({
      masterId: m.masterId,
      startAt: addHours(start, h),
      endAt: addHours(start, h + 1),
    });
    expect(await triggerSlotFreed({ ...slot(26), now: start })).toBe(1);
    expect(await triggerSlotFreed({ ...slot(28), now: addHours(start, 0.5) })).toBe(0);
    expect(await triggerSlotFreed({ ...slot(30), now: addHours(start, 1.1) })).toBe(1);
    expect(await triggerSlotFreed({ ...slot(32), now: addHours(start, 2.2) })).toBe(1);
    expect(await triggerSlotFreed({ ...slot(34), now: addHours(start, 3.3) })).toBe(0);
    const recipients = new Set(
      getOutbox()
        .filter((x) => x.kind === 'client.slotAlert')
        .map((x) => x.chatId),
    );
    expect([...recipients]).toEqual([fan!.user.telegramId.toString()]);
  });

  it('does not fire for slots less than 2 hours away or when the master disabled alerts', async () => {
    const m = await createMaster(dict, { slug: 'alerts-off' });
    const fan = await createClientUser();
    await createClient(m.masterId, { userId: fan.user.id, telegramId: fan.user.telegramId });
    const now = new Date();
    expect(
      await triggerSlotFreed({
        masterId: m.masterId,
        startAt: addHours(now, 1),
        endAt: addHours(now, 2),
        now,
      }),
    ).toBe(0);
    await prisma.masterSettings.update({
      where: { masterId: m.masterId },
      data: { slotAlertsEnabled: false },
    });
    expect(
      await triggerSlotFreed({
        masterId: m.masterId,
        startAt: addHours(now, 30),
        endAt: addHours(now, 31),
        now,
      }),
    ).toBe(0);
  });

  it('fires when a client cancels via the API', async () => {
    const m = await createMaster(dict, { slug: 'alerts-cancel' });
    const fan = await createClientUser();
    await createClient(m.masterId, { userId: fan.user.id, telegramId: fan.user.telegramId });
    const booker = await createClientUser();
    const own = await createClient(m.masterId, {
      userId: booker.user.id,
      telegramId: booker.user.telegramId,
    });
    const appointment = await createAppointment(
      m.masterId,
      own.id,
      m.serviceIds[0]!,
      addHours(new Date(), 30),
    );
    const res = await as(booker.token).post(
      `/api/client/appointments/${appointment.id}/cancel`,
      {},
    );
    expect(res.status).toBe(200);
    await drainDeferred();
    const kinds = getOutbox().map((x) => `${x.kind}:${x.chatId}`);
    expect(kinds).toContain(`client.slotAlert:${fan.user.telegramId}`);
    expect(kinds).not.toContain(`client.slotAlert:${booker.user.telegramId}`);
  });
});

describe('broadcasts', () => {
  it('allows one mass broadcast per day', async () => {
    const m = await createMaster(dict, { slug: 'broadcast-master' });
    const fan = await createClientUser();
    await createClient(m.masterId, { userId: fan.user.id, telegramId: fan.user.telegramId });
    const first = await as(m.token).post('/api/master/broadcasts', {
      segment: 'all',
      text: 'Привет!',
    });
    expect(first.status).toBe(201);
    await drainDeferred();
    const second = await as(m.token).post('/api/master/broadcasts', {
      segment: 'all',
      text: 'Ещё раз',
    });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('broadcastLimit');
  });
});
