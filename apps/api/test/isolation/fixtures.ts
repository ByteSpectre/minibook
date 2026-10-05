import { prisma } from '../../src/db/prisma';
import { addDays, addHours } from '../../src/lib/time';
import {
  createAppointment,
  createClient,
  createClientUser,
  createMaster,
  createSalon,
  dictionaries,
  futureSlot,
  resetDb,
  type Dictionaries,
  type MasterFixture,
  type SalonFixture,
} from '../helpers';

export interface TenantData extends MasterFixture {
  clientId: string;
  linkedClientId: string;
  appointmentId: string;
  completedAppointmentId: string;
  reviewId: string;
  blacklistId: string;
  loyaltyRuleId: string;
  promotionId: string;
  timeBlockId: string;
  broadcastId: string;
  paymentId: string;
  clientName: string;
}

async function seedTenantData(m: MasterFixture, label: string): Promise<TenantData> {
  const clientName = `Client-${label}-${m.masterId.slice(-5)}`;
  const client = await createClient(m.masterId, {
    firstName: clientName,
    phone: '+79160000001',
    username: `client_${label.toLowerCase()}`,
  });
  const clientUser = await createClientUser({ firstName: `Linked-${label}` });
  const linked = await createClient(m.masterId, {
    firstName: `Linked-${label}`,
    userId: clientUser.user.id,
    telegramId: clientUser.user.telegramId,
  });
  const upcoming = await createAppointment(
    m.masterId,
    client.id,
    m.serviceIds[0]!,
    futureSlot(3, 12),
    'CONFIRMED',
  );
  const completed = await createAppointment(
    m.masterId,
    linked.id,
    m.serviceIds[0]!,
    addDays(new Date(), -5),
    'COMPLETED',
  );
  const review = await prisma.review.create({
    data: {
      masterId: m.masterId,
      appointmentId: completed.id,
      clientId: linked.id,
      clientName: `Linked-${label}`,
      rating: 5,
      comment: `Review ${label}`,
      photos: [],
    },
  });
  const blacklist = await prisma.blacklistEntry.create({
    data: { masterId: m.masterId, username: `bad_${label.toLowerCase()}_user` },
  });
  const rule = await prisma.loyaltyRule.create({
    data: { masterId: m.masterId, type: 'EVERY_N_VISIT', threshold: 5, discountPct: 20 },
  });
  const promotion = await prisma.promotion.create({
    data: {
      masterId: m.masterId,
      title: `Promo ${label}`,
      serviceId: m.serviceIds[0]!,
      discountPct: 15,
      validFrom: addDays(new Date(), -1),
      validTo: addDays(new Date(), 30),
      daysOfWeek: [],
    },
  });
  const block = await prisma.timeBlock.create({
    data: {
      masterId: m.masterId,
      startAt: futureSlot(4, 10),
      endAt: addHours(futureSlot(4, 10), 2),
      reason: `Block ${label}`,
    },
  });
  const broadcast = await prisma.broadcast.create({
    data: {
      masterId: m.masterId,
      segment: 'all',
      text: `Broadcast ${label}`,
      recipients: 0,
      sentAt: addDays(new Date(), -3),
    },
  });
  const payment = await prisma.payment.create({
    data: {
      masterId: m.masterId,
      provider: 'mock',
      externalId: `ext_${m.masterId}`,
      amountKopeks: 44900,
      periodDays: 30,
      status: 'succeeded',
      paidAt: addDays(new Date(), -10),
    },
  });
  return {
    ...m,
    clientId: client.id,
    linkedClientId: linked.id,
    appointmentId: upcoming.id,
    completedAppointmentId: completed.id,
    reviewId: review.id,
    blacklistId: blacklist.id,
    loyaltyRuleId: rule.id,
    promotionId: promotion.id,
    timeBlockId: block.id,
    broadcastId: broadcast.id,
    paymentId: payment.id,
    clientName,
  };
}

export interface SalonData extends SalonFixture {
  member: TenantData;
  inviteId: string;
  usernameInviteId: string;
}

async function seedSalon(dict: Dictionaries, label: string): Promise<SalonData> {
  const salon = await createSalon(dict, { slug: `salon-${label.toLowerCase()}` });
  const member = await seedTenantData(
    await createMaster(dict, { slug: `member-${label.toLowerCase()}`, salonId: salon.salonId }),
    `S${label}`,
  );
  const invite = await prisma.salonInvite.create({
    data: {
      salonId: salon.salonId,
      inviteCode: `Code${label}12345`,
      expiresAt: addDays(new Date(), 7),
    },
  });
  const usernameInvite = await prisma.salonInvite.create({
    data: {
      salonId: salon.salonId,
      inviteCode: `User${label}12345`,
      invitedUsername: `invited_${label.toLowerCase()}`,
      expiresAt: addDays(new Date(), 7),
    },
  });
  await prisma.payment.create({
    data: {
      salonId: salon.salonId,
      provider: 'mock',
      externalId: `ext_salon_${salon.salonId}`,
      amountKopeks: 124900,
      periodDays: 30,
      status: 'succeeded',
      paidAt: new Date(),
    },
  });
  return { ...salon, member, inviteId: invite.id, usernameInviteId: usernameInvite.id };
}

export interface IsolationFixture {
  dict: Dictionaries;
  A: TenantData;
  B: TenantData;
  SA: SalonData;
  SB: SalonData;
  /** Ids that must never appear in responses to master A. */
  foreignToMasterA: string[];
  /** Ids that must never appear in responses to the owner of salon A. */
  foreignToSalonA: string[];
}

export async function buildIsolationFixture(): Promise<IsolationFixture> {
  await resetDb();
  const dict = await dictionaries();
  const A = await seedTenantData(await createMaster(dict, { slug: 'master-a' }), 'A');
  const B = await seedTenantData(await createMaster(dict, { slug: 'master-b' }), 'B');
  await prisma.master.update({
    where: { id: B.masterId },
    data: { isOnlineOpen: true, onlineOpenUntil: addHours(new Date(), 2) },
  });
  const SA = await seedSalon(dict, 'A');
  const SB = await seedSalon(dict, 'B');
  const idsOf = (t: TenantData) => [
    t.masterId,
    ...t.serviceIds,
    t.clientId,
    t.linkedClientId,
    t.appointmentId,
    t.completedAppointmentId,
    t.reviewId,
    t.blacklistId,
    t.loyaltyRuleId,
    t.promotionId,
    t.timeBlockId,
    t.broadcastId,
    t.paymentId,
    t.clientName,
  ];
  const salonIds = (s: SalonData) => [
    ...idsOf(s.member),
    s.salonId,
    s.inviteId,
    s.usernameInviteId,
  ];
  return {
    dict,
    A,
    B,
    SA,
    SB,
    foreignToMasterA: [...idsOf(B), ...salonIds(SA), ...salonIds(SB)],
    foreignToSalonA: [...idsOf(A), ...idsOf(B), ...salonIds(SB)],
  };
}
