import { normalizePhone, normalizeUsername } from '@nail-crm/shared';
import { prisma } from '../db/prisma';

export interface Identity {
  usernames: string[];
  phones: string[];
}

export function mergeIdentity(...parts: Partial<Identity>[]): Identity {
  const usernames = new Set<string>();
  const phones = new Set<string>();
  for (const p of parts) {
    p.usernames?.forEach((u) => {
      const n = normalizeUsername(u);
      if (n) usernames.add(n);
    });
    p.phones?.forEach((ph) => {
      const n = ph.startsWith('+') ? normalizePhone(ph) : null;
      if (n) phones.add(n);
    });
  }
  return { usernames: [...usernames], phones: [...phones] };
}

export interface UserAtMaster {
  user: {
    id: string;
    telegramId: bigint;
    username: string | null;
    firstName: string | null;
    languageCode: string | null;
  };
  profile: {
    firstName: string | null;
    username: string | null;
    phone: string;
    phoneCountry: string | null;
    birthday: Date;
    gender: 'MALE' | 'FEMALE' | 'UNSPECIFIED';
    onboardingCompleted: boolean;
  } | null;
  client: {
    id: string;
    firstName: string | null;
    username: string | null;
    phone: string | null;
    birthday: Date | null;
    gender: 'MALE' | 'FEMALE' | 'UNSPECIFIED' | null;
    visitsCount: number;
  } | null;
}

/** Everything known about a user in the context of one master (local data first). */
export async function loadUserAtMaster(userId: string, masterId: string): Promise<UserAtMaster> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      languageCode: true,
      clientProfile: {
        select: {
          firstName: true,
          username: true,
          phone: true,
          phoneCountry: true,
          birthday: true,
          gender: true,
          onboardingCompleted: true,
        },
      },
    },
  });
  const client = await prisma.client.findUnique({
    where: { masterId_telegramId: { masterId, telegramId: user.telegramId } },
    select: {
      id: true,
      firstName: true,
      username: true,
      phone: true,
      birthday: true,
      gender: true,
      visitsCount: true,
    },
  });
  const { clientProfile, ...rest } = user;
  return { user: rest, profile: clientProfile, client };
}

export function identityOf(ctx: UserAtMaster): Identity {
  return mergeIdentity({
    usernames: [ctx.user.username, ctx.profile?.username, ctx.client?.username].filter(
      (v): v is string => !!v,
    ),
    phones: [ctx.profile?.phone, ctx.client?.phone].filter((v): v is string => !!v),
  });
}

/** Blacklist check. By design no attempt is logged or counted. */
export async function isBlacklisted(masterId: string, identity: Identity): Promise<boolean> {
  if (identity.usernames.length === 0 && identity.phones.length === 0) return false;
  const count = await prisma.blacklistEntry.count({
    where: {
      masterId,
      OR: [
        ...(identity.usernames.length ? [{ username: { in: identity.usernames } }] : []),
        ...(identity.phones.length ? [{ phone: { in: identity.phones } }] : []),
      ],
    },
  });
  return count > 0;
}
