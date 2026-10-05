import {
  normalizeUsername,
  type AuthResponse,
  type Language,
  type MeDto,
  type PendingInviteDto,
  type Role,
} from '@nail-crm/shared';
import { detectLanguage, isLanguage } from '@nail-crm/shared/i18n';
import { config } from '../config';
import { prisma, type User } from '../db/prisma';
import { computeMasterAccess, computeSalonAccess } from '../lib/access';
import { signAccessToken, type AuthContext } from '../lib/jwt';
import type { TelegramUser } from '../lib/telegram';
import { trackFunnel } from './funnel.service';

export interface TelegramProfile {
  id: number | bigint;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  photoUrl?: string | null;
}

export function fromInitDataUser(u: TelegramUser): TelegramProfile {
  return {
    id: u.id,
    firstName: u.first_name ?? null,
    lastName: u.last_name ?? null,
    username: u.username ?? null,
    languageCode: u.language_code ?? null,
    photoUrl: u.photo_url ?? null,
  };
}

/** Creates or refreshes a user from Telegram data. Language preference is kept once chosen. */
export async function upsertTelegramUser(profile: TelegramProfile): Promise<User> {
  const telegramId = BigInt(profile.id);
  const username = normalizeUsername(profile.username);
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      photoUrl: profile.photoUrl ?? null,
      languageCode: profile.languageCode ?? null,
      language: detectLanguage(profile.languageCode),
      lastSeenAt: now,
    },
    update: {
      username,
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
      photoUrl: profile.photoUrl ?? undefined,
      languageCode: profile.languageCode ?? undefined,
      lastSeenAt: now,
    },
  });
  if (username) {
    await prisma.salonInvite.updateMany({
      where: { invitedUsername: username, invitedUserId: null, status: 'pending' },
      data: { invitedUserId: user.id },
    });
  }
  return user;
}

export function isPlatformOwner(telegramId: bigint): boolean {
  return config.ownerTelegramId !== null && telegramId === config.ownerTelegramId;
}

export async function buildAuthContext(userId: string): Promise<AuthContext> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      roles: { select: { role: true, masterId: true, salonId: true } },
    },
  });
  const isOwner = isPlatformOwner(user.telegramId);
  const roles = new Set<Role>(user.roles.map((r) => r.role));
  if (isOwner) roles.add('OWNER');
  return {
    userId: user.id,
    telegramId: user.telegramId,
    roles: [...roles],
    masterId: user.roles.find((r) => r.role === 'MASTER')?.masterId ?? null,
    salonId: user.roles.find((r) => r.role === 'SALON')?.salonId ?? null,
    isOwner,
  };
}

export async function getPendingInvites(
  userId: string,
  username: string | null,
): Promise<PendingInviteDto[]> {
  const now = new Date();
  const invites = await prisma.salonInvite.findMany({
    where: {
      status: 'pending',
      expiresAt: { gt: now },
      OR: [{ invitedUserId: userId }, ...(username ? [{ invitedUsername: username }] : [])],
    },
    include: { salon: { select: { id: true, name: true, slug: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return invites.map((i) => ({
    id: i.id,
    salonId: i.salonId,
    salonName: i.salon.name,
    salonSlug: i.salon.slug,
    salonAvatarUrl: i.salon.avatarUrl,
    code: i.inviteCode,
    expiresAt: i.expiresAt.toISOString(),
  }));
}

export async function buildMe(ctx: AuthContext): Promise<MeDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    include: {
      clientProfile: { select: { onboardingCompleted: true } },
      master: {
        select: {
          id: true,
          slug: true,
          name: true,
          avatarUrl: true,
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
        },
      },
      salon: {
        select: {
          id: true,
          slug: true,
          name: true,
          avatarUrl: true,
          status: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          autoRenewEnabled: true,
        },
      },
    },
  });
  const language: Language = isLanguage(user.language) ? user.language : 'ru';
  return {
    user: {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      language,
      languageCode: user.languageCode,
    },
    roles: ctx.roles,
    isOwner: ctx.isOwner,
    clientOnboarded: user.clientProfile?.onboardingCompleted ?? false,
    master: user.master
      ? {
          id: user.master.id,
          slug: user.master.slug,
          name: user.master.name,
          avatarUrl: user.master.avatarUrl,
          access: computeMasterAccess(user.master, user.master.salon),
        }
      : null,
    salon: user.salon
      ? {
          id: user.salon.id,
          slug: user.salon.slug,
          name: user.salon.name,
          avatarUrl: user.salon.avatarUrl,
          access: computeSalonAccess(user.salon),
        }
      : null,
    pendingInvites: await getPendingInvites(user.id, user.username),
  };
}

export async function issueSession(userId: string): Promise<AuthResponse> {
  const ctx = await buildAuthContext(userId);
  return { token: signAccessToken(ctx), me: await buildMe(ctx) };
}

export async function loginWithTelegram(profile: TelegramProfile): Promise<AuthResponse> {
  const user = await upsertTelegramUser(profile);
  await trackFunnel(user.id, 'APP_OPEN');
  return issueSession(user.id);
}

export async function setUserLanguage(userId: string, language: Language): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { language } });
  await prisma.clientProfile.updateMany({ where: { userId }, data: { language } });
}
