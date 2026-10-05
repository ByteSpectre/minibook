import { Bot, type Context } from 'grammy';
import { APP_NAME, daysLeft, parseStartParam, type Language } from '@nail-crm/shared';
import { config, env } from '../config';
import { prisma } from '../db/prisma';
import { forMaster } from '../db/tenant';
import { AppError } from '../lib/errors';
import { langOf, tr } from '../lib/i18n';
import { fmtDate, fmtShortDate, fmtTime } from '../lib/time';
import { logger } from '../logger';
import { upsertTelegramUser } from '../services/auth.service';
import { accessOf, loadTenant } from '../services/billing/billing.service';
import { applyPromoCode } from '../services/billing/promo.service';
import { cancelAppointmentByClient, confirmVisit } from '../services/client.service';
import { trackFunnel } from '../services/funnel.service';
import { patchAppointment } from '../services/master/appointments.service';
import { toKeyboard, type MessageButton } from '../services/notifications/notifier';
import { respondToInviteById } from '../services/salon/membership.service';

const app = (text: string, path: string, startParam: string): MessageButton => ({
  text,
  app: { path, startParam },
});

const keyboard = (buttons: MessageButton[][]) => ({ inline_keyboard: toKeyboard(buttons) ?? [] });

async function userOf(ctx: Context) {
  if (!ctx.from) return null;
  return upsertTelegramUser({
    id: ctx.from.id,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name ?? null,
    username: ctx.from.username ?? null,
    languageCode: ctx.from.language_code ?? null,
  });
}

async function rolesOf(userId: string) {
  const [master, salon, profile] = await Promise.all([
    prisma.master.findUnique({ where: { userId }, select: { id: true } }),
    prisma.salon.findUnique({ where: { ownerId: userId }, select: { id: true } }),
    prisma.clientProfile.findUnique({ where: { userId }, select: { onboardingCompleted: true } }),
  ]);
  return {
    masterId: master?.id ?? null,
    salonId: salon?.id ?? null,
    client: !!profile?.onboardingCompleted,
  };
}

function errorText(err: unknown, lang: Language): string {
  const t = tr(lang);
  if (err instanceof AppError) {
    const key = `errors.${err.code}` as const;
    const text = t(key as 'errors.notFound');
    return text === key ? t('bot.errors.generic') : text;
  }
  return t('bot.errors.generic');
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const user = await userOf(ctx);
    if (!user) return;
    await prisma.user.update({
      where: { id: user.id },
      data: { botStartedAt: user.botStartedAt ?? new Date() },
    });
    await trackFunnel(user.id, 'BOT_START');
    const lang = langOf(user.language);
    const t = tr(lang);
    const name = ctx.from?.first_name ?? '';

    const param = parseStartParam(ctx.match || null);
    if (param?.kind === 'joinSalon') {
      const salon = await prisma.salon.findUnique({
        where: { id: param.salonId },
        select: { name: true },
      });
      await ctx.reply(t('bot.salon_notify.inviteNewUser', { salon: salon?.name ?? '' }), {
        parse_mode: 'HTML',
        reply_markup: keyboard([
          [app(t('bot.buttons.openApp'), `/join/${param.salonId}/${param.code}`, ctx.match)],
        ]),
      });
      return;
    }
    if (param?.kind === 'master' || param?.kind === 'salon') {
      const path = param.kind === 'master' ? `/m/${param.slug}` : `/s/${param.slug}`;
      await ctx.reply(t('bot.search.open'), {
        reply_markup: keyboard([[app(t('bot.buttons.book'), path, ctx.match)]]),
      });
      return;
    }

    const roles = await rolesOf(user.id);
    const hasAny = roles.masterId || roles.salonId || roles.client;
    const rows: MessageButton[][] = [];
    if (hasAny) {
      if (roles.client) rows.push([app(t('bot.buttons.openApp'), '/client', 'go_client_home')]);
      if (roles.masterId)
        rows.push([app(t('bot.buttons.openMaster'), '/master', 'go_master_dashboard')]);
      if (roles.salonId)
        rows.push([app(t('bot.buttons.openSalon'), '/salon', 'go_salon_dashboard')]);
    }
    if (config.ownerTelegramId === user.telegramId)
      rows.push([app(t('bot.buttons.openAdmin'), '/admin', 'go_admin')]);
    if (!roles.client)
      rows.push([app(t('bot.buttons.client'), '/onboarding/client', 'go_onboarding_client')]);
    if (!roles.masterId)
      rows.push([app(t('bot.buttons.master'), '/onboarding/master', 'go_onboarding_master')]);
    if (!roles.salonId)
      rows.push([app(t('bot.buttons.salon'), '/onboarding/salon', 'go_onboarding_salon')]);
    await ctx.reply(
      hasAny
        ? t('bot.start.welcomeBack', { name })
        : t('bot.start.greeting', { name, app: APP_NAME }),
      { parse_mode: 'HTML', reply_markup: keyboard(rows) },
    );
  });

  bot.command('help', async (ctx) => {
    const user = await userOf(ctx);
    await ctx.reply(tr(langOf(user?.language))('bot.help', { app: APP_NAME }), {
      parse_mode: 'HTML',
    });
  });

  bot.command('search', async (ctx) => {
    const user = await userOf(ctx);
    const t = tr(langOf(user?.language));
    await ctx.reply(t('bot.search.open'), {
      reply_markup: keyboard([
        [app(t('bot.buttons.search'), '/client/search', 'go_client_search')],
      ]),
    });
  });

  bot.command('master', async (ctx) => {
    const user = await userOf(ctx);
    if (!user) return;
    const t = tr(langOf(user.language));
    const roles = await rolesOf(user.id);
    if (!roles.masterId) {
      await ctx.reply(t('bot.master.notRegistered'), {
        reply_markup: keyboard([
          [app(t('bot.buttons.master'), '/onboarding/master', 'go_onboarding_master')],
        ]),
      });
      return;
    }
    await ctx.reply(t('bot.master.open'), {
      reply_markup: keyboard([
        [app(t('bot.buttons.openMaster'), '/master', 'go_master_dashboard')],
      ]),
    });
  });

  bot.command('salon', async (ctx) => {
    const user = await userOf(ctx);
    if (!user) return;
    const t = tr(langOf(user.language));
    const roles = await rolesOf(user.id);
    if (!roles.salonId) {
      await ctx.reply(t('bot.salon.notRegistered'), {
        reply_markup: keyboard([
          [app(t('bot.buttons.salon'), '/onboarding/salon', 'go_onboarding_salon')],
        ]),
      });
      return;
    }
    await ctx.reply(t('bot.salon.open'), {
      reply_markup: keyboard([[app(t('bot.buttons.openSalon'), '/salon', 'go_salon_dashboard')]]),
    });
  });

  bot.command('subscription', async (ctx) => {
    const user = await userOf(ctx);
    if (!user) return;
    const lang = langOf(user.language);
    const t = tr(lang);
    const roles = await rolesOf(user.id);
    const tenants = [
      ...(roles.masterId ? [{ kind: 'master' as const, id: roles.masterId }] : []),
      ...(roles.salonId ? [{ kind: 'salon' as const, id: roles.salonId }] : []),
    ];
    if (tenants.length === 0) {
      await ctx.reply(t('bot.subscription.none'));
      return;
    }
    for (const ref of tenants) {
      const tenant = await loadTenant(ref.kind, ref.id);
      const access = accessOf(tenant);
      if (access.source === 'salon-member' && tenant.salon) {
        await ctx.reply(t('bot.subscription.coveredBySalon', { salon: tenant.salon.name }), {
          parse_mode: 'HTML',
        });
        continue;
      }
      await ctx.reply(
        t('bot.subscription.status', {
          kind:
            ref.kind === 'master'
              ? t('bot.subscription.kindMaster')
              : t('bot.subscription.kindSalon'),
          status: t(`enums.subStatus.${access.status}`),
          date: access.endsAt
            ? fmtShortDate(new Date(access.endsAt), env.PLATFORM_TIMEZONE, lang)
            : '—',
          days: t('common.days', { count: daysLeft(access.endsAt) }),
        }),
        {
          parse_mode: 'HTML',
          reply_markup: keyboard([
            [app(t('bot.buttons.pay'), `/${ref.kind}/subscription`, `go_${ref.kind}_subscription`)],
          ]),
        },
      );
    }
  });

  bot.command('promo', async (ctx) => {
    const user = await userOf(ctx);
    if (!user) return;
    const lang = langOf(user.language);
    const t = tr(lang);
    const code = (ctx.match ?? '').trim();
    if (!code) {
      await ctx.reply(t('bot.promo.usage'), { parse_mode: 'HTML' });
      return;
    }
    const roles = await rolesOf(user.id);
    const target = roles.masterId
      ? { kind: 'master' as const, id: roles.masterId }
      : roles.salonId
        ? { kind: 'salon' as const, id: roles.salonId }
        : null;
    if (!target) {
      await ctx.reply(t('bot.promo.noTenant'));
      return;
    }
    try {
      const result = await applyPromoCode(target.kind, target.id, code);
      await ctx.reply(
        result.type === 'FREE_DAYS'
          ? t('bot.promo.appliedDays', {
              days: result.value,
              date: result.accessEndsAt
                ? fmtShortDate(new Date(result.accessEndsAt), env.PLATFORM_TIMEZONE, lang)
                : '—',
            })
          : t('bot.promo.appliedDiscount', { pct: result.value }),
      );
    } catch (err) {
      await ctx.reply(errorText(err, lang));
    }
  });

  /* ───────────── Appointment reminder buttons ───────────── */

  bot.callbackQuery(/^appt:(ok|cx|cx2|keep|mok):([a-z0-9]+)$/, async (ctx) => {
    const [, action, appointmentId] = ctx.match;
    const user = await userOf(ctx);
    if (!user || !appointmentId) return;
    const lang = langOf(user.language);
    const t = tr(lang);
    try {
      if (action === 'ok') {
        await confirmVisit(appointmentId, { telegramId: user.telegramId });
        await ctx.answerCallbackQuery({ text: t('bot.client_notify.confirmThanks') });
        await ctx.editMessageReplyMarkup({
          reply_markup: keyboard([
            [
              app(
                t('bot.buttons.reschedule'),
                `/client/calendar?reschedule=${appointmentId}`,
                `appt_reschedule_${appointmentId}`,
              ),
              { text: t('bot.buttons.cancel'), callbackData: `appt:cx:${appointmentId}` },
            ],
          ]),
        });
        return;
      }
      if (action === 'cx') {
        const a = await prisma.appointment.findFirst({
          where: { id: appointmentId, client: { telegramId: user.telegramId } },
          select: { startAt: true, master: { select: { name: true, timezone: true } } },
        });
        if (!a) throw new AppError(404, 'notFound');
        await ctx.answerCallbackQuery();
        await ctx.reply(
          t('bot.client_notify.cancelPrompt', {
            master: a.master.name,
            date: fmtDate(a.startAt, a.master.timezone, lang),
            time: fmtTime(a.startAt, a.master.timezone),
          }),
          {
            reply_markup: keyboard([
              [
                { text: t('bot.buttons.yesCancel'), callbackData: `appt:cx2:${appointmentId}` },
                { text: t('bot.buttons.keep'), callbackData: `appt:keep:${appointmentId}` },
              ],
            ]),
          },
        );
        return;
      }
      if (action === 'cx2') {
        await cancelAppointmentByClient(appointmentId, { telegramId: user.telegramId });
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(t('bot.client_notify.cancelled'));
        return;
      }
      if (action === 'keep') {
        await ctx.answerCallbackQuery({ text: t('bot.client_notify.confirmThanks') });
        await ctx.deleteMessage().catch(() => undefined);
        return;
      }
      if (action === 'mok') {
        const master = await prisma.master.findUnique({
          where: { userId: user.id },
          select: { id: true, timezone: true, currency: true },
        });
        if (!master) throw new AppError(404, 'notFound');
        await patchAppointment(
          {
            kind: 'master',
            db: forMaster(master.id),
            masterIds: [master.id],
            timezone: master.timezone,
            currency: master.currency,
            salonId: null,
          },
          appointmentId,
          { status: 'CONFIRMED' },
          'master',
        );
        await ctx.answerCallbackQuery({ text: t('enums.appointmentStatus.CONFIRMED') });
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      }
    } catch (err) {
      if (err instanceof AppError && err.code === 'cannotCancel') {
        await ctx.answerCallbackQuery({
          text: t('bot.client_notify.cannotCancel'),
          show_alert: true,
        });
        return;
      }
      logger.warn({ err, action }, 'Appointment callback failed');
      await ctx.answerCallbackQuery({ text: errorText(err, lang), show_alert: true });
    }
  });

  /* ───────────── Salon invites ───────────── */

  bot.callbackQuery(/^inv:(ok|no):([a-z0-9]+)$/, async (ctx) => {
    const [, action, inviteId] = ctx.match;
    const user = await userOf(ctx);
    if (!user || !inviteId) return;
    const lang = langOf(user.language);
    const t = tr(lang);
    try {
      const result = await respondToInviteById(inviteId, user.telegramId, action === 'ok');
      await ctx.answerCallbackQuery();
      if (result.status === 'handled')
        await ctx.editMessageText(t('bot.salon_notify.alreadyHandled'));
      else if (result.status === 'accepted')
        await ctx.editMessageText(t('bot.salon_notify.joined', { salon: result.salonName ?? '' }));
      else await ctx.editMessageText(t('bot.salon_notify.declined'));
    } catch (err) {
      if (err instanceof AppError && err.code === 'onboardingRequired') {
        const invite = await prisma.salonInvite.findUnique({
          where: { id: inviteId },
          select: { salonId: true, inviteCode: true },
        });
        await ctx.answerCallbackQuery();
        if (invite) {
          await ctx.reply(t('bot.master.notRegistered'), {
            reply_markup: keyboard([
              [
                app(
                  t('bot.buttons.master'),
                  `/join/${invite.salonId}/${invite.inviteCode}`,
                  `join_salon_${invite.salonId}_${invite.inviteCode}`,
                ),
              ],
            ]),
          });
        }
        return;
      }
      await ctx.answerCallbackQuery({ text: errorText(err, lang), show_alert: true });
    }
  });

  bot.catch((err) => logger.error({ err: err.error }, 'Bot handler error'));
  return bot;
}

export async function configureBot(bot: Bot): Promise<void> {
  const commands = {
    ru: [
      { command: 'start', description: 'Выбрать роль' },
      { command: 'search', description: 'Найти мастера' },
      { command: 'master', description: 'Кабинет мастера' },
      { command: 'salon', description: 'Кабинет салона' },
      { command: 'subscription', description: 'Статус подписки' },
      { command: 'promo', description: 'Промокод: /promo КОД' },
      { command: 'help', description: 'Помощь' },
    ],
    en: [
      { command: 'start', description: 'Choose a role' },
      { command: 'search', description: 'Find a master' },
      { command: 'master', description: 'Master cabinet' },
      { command: 'salon', description: 'Salon cabinet' },
      { command: 'subscription', description: 'Subscription status' },
      { command: 'promo', description: 'Promo code: /promo CODE' },
      { command: 'help', description: 'Help' },
    ],
  };
  await bot.api.setMyCommands(commands.ru);
  await bot.api.setMyCommands(commands.ru, { language_code: 'ru' });
  await bot.api.setMyCommands(commands.en, { language_code: 'en' });
  if (config.webAppIsHttps) {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: APP_NAME, web_app: { url: config.webAppUrl } },
    });
  }
}
