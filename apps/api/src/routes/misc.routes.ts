import { z } from 'zod';
import { buildIcs } from '@nail-crm/shared';
import { config, env } from '../config';
import { prisma } from '../db/prisma';
import { NotFoundError } from '../lib/errors';
import { defineRouter, handle } from '../lib/http';
import { verifyDownloadToken } from '../lib/jwt';
import { masterPublicLink } from '../lib/links';
import { exportMasterCsv } from '../services/master/export.service';

export const miscRoutes = defineRouter('/api');

miscRoutes.get(
  '/health',
  handle({}, async () => {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      time: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }),
);

miscRoutes.get(
  '/meta',
  handle({}, () => ({
    botUsername: env.BOT_USERNAME,
    miniAppShortName: env.MINI_APP_SHORT_NAME || null,
    devAuthEnabled: config.devAuthEnabled,
    paymentProvider: config.paymentProvider,
    botConnected: config.botEnabled,
  })),
);

const tokenParams = z.object({ token: z.string().min(10).max(2048) });

miscRoutes.get(
  '/files/ics/:token',
  handle({ params: tokenParams }, async ({ params, res }) => {
    let claims;
    try {
      claims = verifyDownloadToken(params.token);
    } catch {
      throw new NotFoundError();
    }
    if (claims.kind !== 'ics') throw new NotFoundError();
    const a = await prisma.appointment.findUnique({
      where: { id: claims.id },
      include: { services: true, master: { select: { name: true, address: true, slug: true } } },
    });
    if (!a) throw new NotFoundError();
    const ics = buildIcs({
      uid: `${a.id}@glow`,
      start: a.startAt,
      end: a.endAt,
      title: `${a.services.map((s) => s.name).join(', ')} — ${a.master.name}`,
      description: masterPublicLink(a.master.slug),
      location: a.master.address ?? undefined,
      url: masterPublicLink(a.master.slug),
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${a.id}.ics"`);
    res.send(ics);
    return undefined;
  }),
);

miscRoutes.get(
  '/files/export/:token',
  handle({ params: tokenParams }, async ({ params, res }) => {
    let claims;
    try {
      claims = verifyDownloadToken(params.token);
    } catch {
      throw new NotFoundError();
    }
    if (claims.kind !== 'export') throw new NotFoundError();
    const { filename, content } = await exportMasterCsv(claims.id, claims.entity ?? 'appointments');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${content}`);
    return undefined;
  }),
);
