import {
  LIMITS,
  normalizeUsername,
  type InviteByUsernameResponse,
  type InviteStatus,
  type JoinSalonPreviewDto,
  type SalonInviteDto,
  type SalonMasterDto,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import type { SalonTenant } from '../../middleware/auth';
import { defer } from '../../lib/deferred';
import { AppError, conflict, forbidden, NotFoundError } from '../../lib/errors';
import { langOf, tr } from '../../lib/i18n';
import { miniAppLink } from '../../lib/links';
import { addDays, startOfLocalDay } from '../../lib/time';
import { createInviteCode } from '../billing/id';
import { attachMasterToSalon, notifySalonJoined } from '../master/onboarding.service';
import { sendMessage } from '../notifications/notifier';

type InviteRow = {
  id: string;
  salonId: string;
  inviteCode: string;
  invitedUsername: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  master?: { id: string; name: string; avatarUrl: string | null } | null;
};

export const inviteLink = (salonId: string, code: string): string =>
  miniAppLink({ kind: 'joinSalon', salonId, code });

function toInviteDto(i: InviteRow, now: Date = new Date()): SalonInviteDto {
  const expired = i.status === 'pending' && i.expiresAt <= now;
  return {
    id: i.id,
    code: i.inviteCode,
    invitedUsername: i.invitedUsername,
    status: (expired ? 'expired' : i.status) as InviteStatus,
    link: inviteLink(i.salonId, i.inviteCode),
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
    respondedAt: i.respondedAt ? i.respondedAt.toISOString() : null,
    master: i.master ?? null,
  };
}

export async function listSalonMasters(
  t: SalonTenant,
  now: Date = new Date(),
): Promise<SalonMasterDto[]> {
  const monthStart = startOfLocalDay(`${now.toISOString().slice(0, 8)}01`, t.salon.timezone);
  const masters = await prisma.master.findMany({
    where: { salonId: t.salonId },
    orderBy: { salonJoinedAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      username: true,
      avatarUrl: true,
      salonJoinedAt: true,
      isOnlineOpen: true,
      onlineOpenUntil: true,
    },
  });
  return Promise.all(
    masters.map(async (m) => {
      const [appointmentsCount, revenue, upcomingCount] = await Promise.all([
        t.db.appointment.count({
          where: { masterId: m.id, status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] } },
        }),
        t.db.appointment.aggregate({
          where: { masterId: m.id, status: 'COMPLETED', startAt: { gte: monthStart } },
          _sum: { price: true },
        }),
        t.db.appointment.count({
          where: { masterId: m.id, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gt: now } },
        }),
      ]);
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        username: m.username,
        avatarUrl: m.avatarUrl,
        joinedAt: m.salonJoinedAt ? m.salonJoinedAt.toISOString() : null,
        appointmentsCount,
        monthRevenue: Number(revenue._sum.price ?? 0),
        upcomingCount,
        isOnlineOpen: m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
      };
    }),
  );
}

export async function listInvites(t: SalonTenant): Promise<SalonInviteDto[]> {
  const rows = await t.db.salonInvite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { master: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return rows.map((r) => toInviteDto(r));
}

export async function revokeInvite(t: SalonTenant, id: string): Promise<void> {
  const invite = await t.db.salonInvite.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!invite) throw new NotFoundError();
  if (invite.status !== 'pending') throw conflict('conflict', 'Invite is not pending');
  await t.db.salonInvite.update({
    where: { id },
    data: { status: 'revoked', respondedAt: new Date() },
  });
}

export async function createInviteLink(
  t: SalonTenant,
  ttlDays?: number,
  now: Date = new Date(),
): Promise<SalonInviteDto> {
  const row = await t.db.salonInvite.create({
    data: {
      salonId: t.salonId,
      inviteCode: createInviteCode(),
      expiresAt: addDays(now, ttlDays ?? LIMITS.inviteTtlDays),
    },
  });
  return toInviteDto(row, now);
}

/**
 * Invite by @username. Telegram bots can only message users who have interacted with the
 * bot, so unknown usernames get a pending invite plus a link the owner forwards manually.
 * The invite is delivered automatically once that user opens the app.
 */
export async function inviteByUsername(
  t: SalonTenant,
  rawUsername: string,
  now: Date = new Date(),
): Promise<InviteByUsernameResponse> {
  const username = normalizeUsername(rawUsername);
  if (!username) throw new AppError(400, 'validation', 'Username is required');
  const user = await prisma.user.findFirst({
    where: { username },
    select: {
      id: true,
      telegramId: true,
      language: true,
      master: { select: { id: true, salonId: true } },
    },
  });
  if (user?.master?.salonId === t.salonId)
    throw conflict('alreadyInSalon', 'Already in this salon');

  await t.db.salonInvite.updateMany({
    where: { invitedUsername: username, status: 'pending' },
    data: { status: 'revoked', respondedAt: now },
  });
  const invite = await t.db.salonInvite.create({
    data: {
      salonId: t.salonId,
      inviteCode: createInviteCode(),
      invitedUsername: username,
      invitedUserId: user?.id ?? null,
      expiresAt: addDays(now, LIMITS.inviteTtlDays),
    },
  });

  let delivered = false;
  if (user) {
    const lang = langOf(user.language);
    const t2 = tr(lang);
    delivered = user.master
      ? await sendMessage({
          chatId: user.telegramId,
          text: t2('bot.salon_notify.invite', { salon: t.salon.name }),
          buttons: [
            [
              { text: t2('bot.buttons.accept'), callbackData: `inv:ok:${invite.id}` },
              { text: t2('bot.buttons.decline'), callbackData: `inv:no:${invite.id}` },
            ],
          ],
          kind: 'salon.invite',
        })
      : await sendMessage({
          chatId: user.telegramId,
          text: t2('bot.salon_notify.inviteNewUser', { salon: t.salon.name }),
          buttons: [
            [
              {
                text: t2('bot.buttons.openApp'),
                app: {
                  path: `/join/${t.salonId}/${invite.inviteCode}`,
                  startParam: `join_salon_${t.salonId}_${invite.inviteCode}`,
                },
              },
            ],
          ],
          kind: 'salon.inviteNewUser',
        });
  }
  return { invite: toInviteDto(invite, now), delivered, userFound: !!user };
}

async function findInvite(salonId: string, code: string) {
  return prisma.salonInvite.findFirst({
    where: { salonId, inviteCode: code },
    include: {
      salon: {
        include: {
          city: { select: { name: true } },
          _count: { select: { masters: true } },
          owner: { select: { telegramId: true, language: true } },
        },
      },
    },
  });
}

function assertInvitee(
  invite: { invitedUsername: string | null; invitedUserId: string | null },
  user: { id: string; username: string | null },
) {
  if (!invite.invitedUsername) return;
  if (invite.invitedUserId === user.id) return;
  if (user.username && user.username === invite.invitedUsername) return;
  throw new NotFoundError();
}

export async function previewInvite(
  userId: string,
  salonId: string,
  code: string,
  now: Date = new Date(),
): Promise<JoinSalonPreviewDto> {
  const invite = await findInvite(salonId, code);
  if (!invite) throw new AppError(404, 'inviteInvalid', 'Invite not found');
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, username: true, master: { select: { salonId: true } } },
  });
  assertInvitee(invite, user);
  return {
    salon: {
      id: invite.salon.id,
      name: invite.salon.name,
      slug: invite.salon.slug,
      avatarUrl: invite.salon.avatarUrl,
      cityName: invite.salon.city?.name ?? null,
      mastersCount: invite.salon._count.masters,
    },
    invite: {
      id: invite.id,
      status: (invite.status === 'pending' && invite.expiresAt <= now
        ? 'expired'
        : invite.status) as InviteStatus,
      expiresAt: invite.expiresAt.toISOString(),
      valid: invite.status === 'pending' && invite.expiresAt > now,
    },
    alreadyMember: user.master?.salonId === salonId,
    isMaster: !!user.master,
  };
}

export async function acceptInvite(
  userId: string,
  salonId: string,
  code: string,
  now: Date = new Date(),
): Promise<{ salonName: string }> {
  const invite = await findInvite(salonId, code);
  if (!invite) throw new AppError(404, 'inviteInvalid', 'Invite not found');
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, username: true, master: { select: { id: true } } },
  });
  assertInvitee(invite, user);
  if (!user.master) throw forbidden('onboardingRequired', 'Create a master profile first');
  const masterId = user.master.id;
  const info = await prisma.$transaction((tx) =>
    attachMasterToSalon(tx, masterId, salonId, code, now),
  );
  notifySalonJoined(info);
  return { salonName: info.salonName };
}

export async function declineInvite(
  userId: string,
  salonId: string,
  code: string,
  now: Date = new Date(),
): Promise<void> {
  const invite = await findInvite(salonId, code);
  if (!invite) throw new AppError(404, 'inviteInvalid', 'Invite not found');
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      firstName: true,
      master: { select: { id: true, name: true } },
    },
  });
  assertInvitee(invite, user);
  if (!invite.invitedUsername || invite.status !== 'pending') return;
  await prisma.salonInvite.update({
    where: { id: invite.id },
    data: { status: 'declined', respondedAt: now, masterId: user.master?.id ?? null },
  });
  const ownerLang = langOf(invite.salon.owner.language);
  defer('salon.inviteDeclined', () =>
    sendMessage({
      chatId: invite.salon.owner.telegramId,
      text: tr(ownerLang)('bot.salon_notify.inviteDeclined', {
        master: user.master?.name ?? user.firstName ?? `@${user.username}`,
      }),
      kind: 'salon.inviteDeclined',
    }),
  );
}

/** Removes a master from the salon; their clients and appointments stay with them. */
export async function detachMaster(
  masterId: string,
  salonId: string,
  by: 'owner' | 'master',
): Promise<void> {
  const master = await prisma.master.findFirst({
    where: { id: masterId, salonId },
    select: {
      id: true,
      name: true,
      user: { select: { telegramId: true, language: true } },
      salon: { select: { name: true, owner: { select: { telegramId: true, language: true } } } },
    },
  });
  if (!master) throw new NotFoundError();
  await prisma.master.update({
    where: { id: masterId },
    data: { salonId: null, salonJoinedAt: null },
  });
  const salonName = master.salon?.name ?? '';
  if (by === 'owner') {
    const lang = langOf(master.user.language);
    defer('salon.removed', () =>
      sendMessage({
        chatId: master.user.telegramId,
        text: tr(lang)('bot.salon_notify.removed', { salon: salonName }),
        buttons: [
          [
            {
              text: tr(lang)('bot.buttons.pay'),
              app: { path: '/master/subscription', startParam: 'go_master_subscription' },
            },
          ],
        ],
        kind: 'salon.removed',
      }),
    );
  }
}

export async function removeMasterFromSalon(t: SalonTenant, masterId: string): Promise<void> {
  if (!t.masterIds.includes(masterId)) throw new NotFoundError();
  await detachMaster(masterId, t.salonId, 'owner');
}

export async function leaveSalon(masterId: string): Promise<void> {
  const master = await prisma.master.findUnique({
    where: { id: masterId },
    select: { salonId: true },
  });
  if (!master?.salonId) throw new NotFoundError();
  await detachMaster(masterId, master.salonId, 'master');
}

/** Bot callbacks: accept/decline by invite id for the Telegram user who pressed the button. */
export async function respondToInviteById(inviteId: string, telegramId: bigint, accept: boolean) {
  const invite = await prisma.salonInvite.findUnique({
    where: { id: inviteId },
    select: { salonId: true, inviteCode: true, status: true },
  });
  const user = await prisma.user.findUnique({ where: { telegramId }, select: { id: true } });
  if (!invite || !user) throw new NotFoundError();
  if (invite.status !== 'pending') return { status: 'handled' as const, salonName: null };
  if (accept) {
    const { salonName } = await acceptInvite(user.id, invite.salonId, invite.inviteCode);
    return { status: 'accepted' as const, salonName };
  }
  await declineInvite(user.id, invite.salonId, invite.inviteCode);
  return { status: 'declined' as const, salonName: null };
}
