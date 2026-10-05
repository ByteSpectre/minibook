import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bell,
  Building2,
  Globe,
  LogOut,
  Pencil,
  Scissors,
  Share2,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { clientProfilePatchSchema, formatPhone, type Language } from '@nail-crm/shared';
import { api } from '@/api/client';
import {
  useClientProfile,
  useMyMasters,
  usePatchClientProfile,
  usePatchMyMaster,
} from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton } from '@/components/layout/states';
import { UserAvatar } from '@/components/domain/badges';
import { LoyaltyProgressBar } from '@/components/domain/loyalty';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import { PhoneInput } from '@/components/domain/pickers';
import {
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSheet,
  ListGroup,
  ListRow,
  SectionTitle,
} from '@/components/ui/glass';
import { Switch } from '@/components/ui/switch';
import { formatDate } from '@/lib/format';
import { setLanguage } from '@/lib/i18n';
import { shareLink, telegramEnv } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useAuth, useMe } from '@/store/auth';

const editSchema = clientProfilePatchSchema
  .required({ firstName: true, gender: true, birthday: true, phone: true, phoneCountry: true })
  .extend({
    username: z.string().optional().nullable(),
  });
type EditValues = z.input<typeof editSchema>;

function EditSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { data: profile } = useClientProfile();
  const patch = usePatchClientProfile();
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema) });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  useEffect(() => {
    if (profile && open) {
      reset({
        firstName: profile.firstName ?? '',
        gender: profile.gender,
        birthday: profile.birthday,
        phone: profile.phone,
        phoneCountry: profile.phoneCountry ?? 'RU',
        username: profile.username ?? '',
        avatarUrl: profile.avatarUrl,
      });
    }
  }, [profile, open, reset]);
  const submit = handleSubmit(async (values) => {
    await patch.mutateAsync({ ...values, username: values.username || null });
    toast.success(t('client.profile.saved'));
    onOpenChange(false);
  });
  return (
    <GlassSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('client.profile.personal')}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          loading={patch.isPending}
          onClick={() => void submit()}
        >
          {t('common.save')}
        </GlassButton>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), void submit())}>
        <div className="flex justify-center">
          <SinglePhotoUploader
            value={watch('avatarUrl')}
            onChange={(url) => setValue('avatarUrl', url)}
            kind="avatar"
            round
            size={96}
          />
        </div>
        <Field label={t('client.profile.firstName')} error={formState.errors.firstName?.message}>
          <GlassInput {...register('firstName')} />
        </Field>
        <Field label={t('client.profile.gender')}>
          <div className="grid grid-cols-2 gap-2">
            {(['FEMALE', 'MALE'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setValue('gender', g)}
                className={cn(
                  'h-11 rounded-2xl text-[15px] font-medium',
                  watch('gender') === g ? 'bg-foreground text-background' : 'glass',
                )}
              >
                {t(`enums.gender.${g}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('client.profile.birthday')} error={formState.errors.birthday?.message}>
          <GlassInput type="date" {...register('birthday')} />
        </Field>
        <Field label={t('client.profile.phone')} error={formState.errors.phone?.message}>
          <PhoneInput
            value={watch('phone') ?? ''}
            country={watch('phoneCountry') ?? 'RU'}
            onChange={(v) => setValue('phone', v)}
            onCountryChange={(c) => setValue('phoneCountry', c)}
          />
        </Field>
        <Field label={t('client.profile.username')} error={formState.errors.username?.message}>
          <GlassInput placeholder="@username" autoCapitalize="none" {...register('username')} />
        </Field>
      </form>
    </GlassSheet>
  );
}

export default function ClientProfilePage() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const profile = useClientProfile();
  const masters = useMyMasters();
  const patch = usePatchClientProfile();
  const patchMaster = usePatchMyMaster();
  const [edit, setEdit] = useState(false);
  const p = profile.data;

  const changeLanguage = async (language: Language) => {
    setLanguage(language);
    await api.patch('/api/auth/language', { language });
    useAuth.setState((s) => (s.me ? { me: { ...s.me, user: { ...s.me.user, language } } } : s));
  };

  return (
    <Page title={t('client.profile.title')}>
      {profile.isLoading || !p ? (
        <CardSkeleton />
      ) : (
        <GlassCard className="flex items-center gap-4">
          <UserAvatar src={p.avatarUrl ?? me?.user.photoUrl} name={p.firstName} size={64} ring />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] font-semibold">{p.firstName}</div>
            <div className="truncate text-[13px] text-muted-foreground">
              {p.username ? `@${p.username}` : formatPhone(p.phone)}
            </div>
            <div className="truncate text-[13px] text-muted-foreground">
              {formatPhone(p.phone)} · {formatDate(p.birthday)}
            </div>
          </div>
          <GlassButton size="icon" aria-label={t('common.edit')} onClick={() => setEdit(true)}>
            <Pencil />
          </GlassButton>
        </GlassCard>
      )}

      <section>
        <SectionTitle>{t('client.profile.myMasters')}</SectionTitle>
        <div className="flex flex-col gap-3">
          {(masters.data ?? []).map((m) => (
            <GlassCard key={m.clientId} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Link to={`/m/${m.master.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar src={m.master.avatarUrl} name={m.master.name} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">
                      {m.master.name}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {t('common.visits', { count: m.completedVisits })}
                    </span>
                  </span>
                </Link>
                <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Bell className="size-4" />
                  <Switch
                    checked={m.notificationsEnabled}
                    aria-label={t('client.profile.masterNotifications')}
                    onCheckedChange={(v) =>
                      patchMaster.mutate({ masterId: m.master.id, notificationsEnabled: v })
                    }
                  />
                </label>
              </div>
              {m.loyaltyProgress ? <LoyaltyProgressBar progress={m.loyaltyProgress} /> : null}
              <GlassButton
                size="sm"
                variant="soft"
                className="self-start"
                onClick={() => void shareLink(m.referralLink, t('client.profile.inviteFriendText'))}
              >
                <Share2 /> {t('client.profile.inviteFriend')}
              </GlassButton>
            </GlassCard>
          ))}
          {masters.data?.length === 0 ? (
            <p className="px-1 text-[14px] text-muted-foreground">
              {t('client.home.myMastersEmpty')}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle>{t('client.profile.notifications')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon="📣"
            title={t('client.profile.broadcasts')}
            subtitle={t('client.profile.broadcastsHint')}
            right={
              <Switch
                checked={p?.broadcastEnabled ?? true}
                onCheckedChange={(v) => patch.mutate({ broadcastEnabled: v })}
              />
            }
          />
          <ListRow
            icon="⏰"
            title={t('client.profile.slotAlerts')}
            subtitle={t('client.profile.slotAlertsHint')}
            right={
              <Switch
                checked={p?.slotAlertsEnabled ?? true}
                onCheckedChange={(v) => patch.mutate({ slotAlertsEnabled: v })}
              />
            }
          />
        </ListGroup>
      </section>

      <section>
        <SectionTitle>{t('client.profile.language')}</SectionTitle>
        <GlassCard className="grid grid-cols-2 gap-2 p-2">
          {(['ru', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => void changeLanguage(lang)}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-2xl text-[15px] font-medium',
                i18n.language === lang ? 'bg-foreground text-background' : '',
              )}
            >
              <Globe className="size-4" /> {t(`common.languages.${lang}`)}
            </button>
          ))}
        </GlassCard>
      </section>

      <section>
        <SectionTitle>{t('client.profile.cabinets')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Scissors className="size-4" />}
            title={me?.master ? t('common.masterCabinet') : t('client.profile.becomeMaster')}
            onClick={() => navigate(me?.master ? '/master' : '/onboarding/master')}
          />
          <ListRow
            icon={<Building2 className="size-4" />}
            title={me?.salon ? t('common.salonCabinet') : t('client.profile.becomeSalon')}
            onClick={() => navigate(me?.salon ? '/salon' : '/onboarding/salon')}
          />
          {me?.isOwner ? (
            <ListRow
              icon={<Shield className="size-4" />}
              title={t('common.platformAdmin')}
              onClick={() => navigate('/admin')}
            />
          ) : null}
          {!telegramEnv().inTelegram ? (
            <ListRow
              icon={<LogOut className="size-4" />}
              title={t('dev.logout')}
              danger
              onClick={logout}
            />
          ) : null}
        </ListGroup>
      </section>
      <p className="flex items-center justify-center gap-1 pb-2 text-[12px] text-muted-foreground">
        <Sparkles className="size-3.5" /> {t('common.appName')} · {t('common.tagline')}
      </p>
      <EditSheet open={edit} onOpenChange={setEdit} />
    </Page>
  );
}
