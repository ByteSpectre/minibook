import { formatPhone } from '@nail-crm/shared';
import { forMaster } from '../../db/tenant';
import { NotFoundError } from '../../lib/errors';
import { config } from '../../config';
import { signDownloadToken } from '../../lib/jwt';
import { fmtShortDate, fmtTime } from '../../lib/time';

const csvCell = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n');

export function exportLink(masterId: string, entity: string): string {
  const token = signDownloadToken({ kind: 'export', id: masterId, entity }, 10 * 60);
  return `${config.publicApiUrl}/api/files/export/${token}`;
}

/** Data export stays available on every subscription status, including BANNED. */
export async function exportMasterCsv(
  masterId: string,
  entity: string,
): Promise<{ filename: string; content: string }> {
  const db = forMaster(masterId);
  const master = await db.master.findUnique({
    where: { id: masterId },
    select: { slug: true, timezone: true },
  });
  if (!master) throw new NotFoundError();
  if (entity === 'clients') {
    const clients = await db.client.findMany({ orderBy: { createdAt: 'asc' } });
    const rows = [
      [
        'id',
        'name',
        'phone',
        'username',
        'gender',
        'birthday',
        'visits',
        'spent',
        'last_visit',
        'notes',
      ],
      ...clients.map((c) => [
        c.id,
        c.firstName,
        c.phone ? formatPhone(c.phone) : '',
        c.username ? `@${c.username}` : '',
        c.gender ?? '',
        c.birthday ? c.birthday.toISOString().slice(0, 10) : '',
        c.visitsCount,
        Number(c.totalSpent),
        c.lastVisitAt ? fmtShortDate(c.lastVisitAt, master.timezone, 'ru') : '',
        c.notes ?? '',
      ]),
    ];
    return { filename: `${master.slug}-clients.csv`, content: toCsv(rows) };
  }
  const appointments = await db.appointment.findMany({
    orderBy: { startAt: 'asc' },
    include: { services: true, client: { select: { firstName: true, phone: true } } },
  });
  const rows = [
    ['id', 'date', 'time', 'status', 'client', 'phone', 'services', 'price', 'discount_pct'],
    ...appointments.map((a) => [
      a.id,
      a.startAt.toISOString().slice(0, 10),
      fmtTime(a.startAt, master.timezone),
      a.status,
      a.client.firstName,
      a.client.phone ? formatPhone(a.client.phone) : '',
      a.services.map((s) => s.name).join(' + '),
      a.price === null ? '' : Number(a.price),
      a.discountPct ?? '',
    ]),
  ];
  return { filename: `${master.slug}-appointments.csv`, content: toCsv(rows) };
}
