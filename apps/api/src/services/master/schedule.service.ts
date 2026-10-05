import type { z } from 'zod';
import {
  addDaysIso,
  isoWeekdayOf,
  type MasterSettingsDto,
  type ScheduleDayDto,
  type ScheduleDayResponse,
  type settingsPatchSchema,
  type timeBlockCreateSchema,
  type TimeBlockDto,
  type WeeklyScheduleInput,
} from '@nail-crm/shared';
import type { TenantDb } from '../../db/tenant';
import { badRequest } from '../../lib/errors';
import { appointmentInclude, toMasterAppointmentDto } from '../../lib/mappers';
import { localDay, startOfLocalDay } from '../../lib/time';
import type { TenantScope } from '../scope';
import { DEFAULT_SLOT_SETTINGS } from '../slots.service';
import { scheduleRows } from './onboarding.service';

type SettingsPatch = z.output<typeof settingsPatchSchema>;
type TimeBlockInput = z.output<typeof timeBlockCreateSchema>;

export async function getWeeklySchedule(db: TenantDb): Promise<ScheduleDayDto[]> {
  const rows = await db.scheduleSlot.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
    const day = rows.filter((r) => r.dayOfWeek === dayOfWeek && r.isWorking);
    return {
      dayOfWeek,
      isWorking: day.length > 0,
      intervals: day.map((r) => ({ start: r.startTime, end: r.endTime })),
    };
  });
}

export async function putWeeklySchedule(
  db: TenantDb,
  masterId: string,
  input: WeeklyScheduleInput,
): Promise<ScheduleDayDto[]> {
  const rows = scheduleRows(input);
  await db.scheduleSlot.deleteMany({});
  if (rows.length)
    await db.scheduleSlot.createMany({ data: rows.map((r) => ({ ...r, masterId })) });
  return getWeeklySchedule(db);
}

const settingsDto = (s: MasterSettingsDto & Record<string, unknown>): MasterSettingsDto => ({
  slotStep: s.slotStep,
  bufferMinutes: s.bufferMinutes,
  minLeadMinutes: s.minLeadMinutes,
  bookingHorizonDays: s.bookingHorizonDays,
  morningEnabled: s.morningEnabled,
  morningStart: s.morningStart,
  morningEnd: s.morningEnd,
  dayEnabled: s.dayEnabled,
  dayStart: s.dayStart,
  dayEnd: s.dayEnd,
  eveningEnabled: s.eveningEnabled,
  eveningStart: s.eveningStart,
  eveningEnd: s.eveningEnd,
  nightEnabled: s.nightEnabled,
  nightStart: s.nightStart,
  nightEnd: s.nightEnd,
  dailyReminderEnabled: s.dailyReminderEnabled,
  dailyReminderTime: s.dailyReminderTime,
  dailyReminderSendEmpty: s.dailyReminderSendEmpty,
  morningSummaryEnabled: s.morningSummaryEnabled,
  slotAlertsEnabled: s.slotAlertsEnabled,
  onlineDurationHours: s.onlineDurationHours,
});

export async function getSettings(db: TenantDb, masterId: string): Promise<MasterSettingsDto> {
  const row = await db.masterSettings.upsert({
    where: { masterId },
    create: { masterId },
    update: {},
  });
  return settingsDto(row);
}

export async function patchSettings(
  db: TenantDb,
  masterId: string,
  patch: SettingsPatch,
): Promise<MasterSettingsDto> {
  const merged = { ...DEFAULT_SLOT_SETTINGS, ...(await getSettings(db, masterId)), ...patch };
  for (const key of ['morning', 'day', 'evening', 'night'] as const) {
    if (merged[`${key}Start`] >= merged[`${key}End`] && merged[`${key}End`] !== '24:00') {
      throw badRequest('validation', `Invalid ${key} period`);
    }
  }
  const row = await db.masterSettings.update({ where: { masterId }, data: patch });
  return settingsDto(row);
}

const toTimeBlockDto = (b: {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}): TimeBlockDto => ({
  id: b.id,
  startAt: b.startAt.toISOString(),
  endAt: b.endAt.toISOString(),
  reason: b.reason,
});

export async function listTimeBlocks(db: TenantDb, from: Date, to: Date): Promise<TimeBlockDto[]> {
  const rows = await db.timeBlock.findMany({
    where: { startAt: { lt: to }, endAt: { gt: from } },
    orderBy: { startAt: 'asc' },
  });
  return rows.map(toTimeBlockDto);
}

export async function createTimeBlock(
  db: TenantDb,
  masterId: string,
  input: TimeBlockInput,
): Promise<TimeBlockDto> {
  const row = await db.timeBlock.create({
    data: {
      masterId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      reason: input.reason ?? null,
    },
  });
  return toTimeBlockDto(row);
}

export async function deleteTimeBlock(db: TenantDb, id: string): Promise<void> {
  await db.timeBlock.delete({ where: { id } });
}

/** Day view for the master (or all salon masters). */
export async function getScheduleDay(
  scope: TenantScope,
  day: string,
  masterId?: string,
): Promise<ScheduleDayResponse> {
  const from = startOfLocalDay(day, scope.timezone);
  const to = startOfLocalDay(addDaysIso(day, 1), scope.timezone);
  const filter = masterId ? { masterId } : {};
  const [appointments, blocks, slots] = await Promise.all([
    scope.db.appointment.findMany({
      where: { ...filter, startAt: { lt: to }, endAt: { gt: from } },
      include: appointmentInclude,
      orderBy: { startAt: 'asc' },
    }),
    scope.db.timeBlock.findMany({
      where: { ...filter, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: 'asc' },
    }),
    scope.db.scheduleSlot.findMany({
      where: { ...filter, dayOfWeek: isoWeekdayOf(day), isWorking: true },
      orderBy: { startTime: 'asc' },
    }),
  ]);
  return {
    date: day,
    timezone: scope.timezone,
    appointments: appointments.map(toMasterAppointmentDto),
    timeBlocks: blocks.map(toTimeBlockDto),
    working: slots.map((s) => ({ start: s.startTime, end: s.endTime })),
  };
}

/** Appointment counts per local day (calendar dots). */
export async function getScheduleOverview(
  scope: TenantScope,
  fromDay: string,
  days: number,
  masterId?: string,
) {
  const from = startOfLocalDay(fromDay, scope.timezone);
  const to = startOfLocalDay(addDaysIso(fromDay, days), scope.timezone);
  const rows = await scope.db.appointment.findMany({
    where: {
      ...(masterId ? { masterId } : {}),
      startAt: { gte: from, lt: to },
      status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
    },
    select: { startAt: true, status: true },
  });
  const counts = new Map<string, { count: number; pending: number }>();
  for (const r of rows) {
    const key = localDay(r.startAt, scope.timezone);
    const entry = counts.get(key) ?? { count: 0, pending: 0 };
    entry.count += 1;
    if (r.status === 'PENDING') entry.pending += 1;
    counts.set(key, entry);
  }
  return [...counts.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
