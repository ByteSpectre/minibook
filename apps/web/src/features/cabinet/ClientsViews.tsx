import { Ban, Bell, ChevronRight, Phone, Plus, Search, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatPhone } from '@nail-crm/shared';
import {
  useBlacklistMutations,
  useClientDetail,
  useClientMutations,
  useClients,
  type CabinetBase,
} from '@/api/cabinetApi';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { EmptyState, ErrorState, ListSkeleton, PageLoader } from '@/components/layout/states';
import { StatusBadge, UserAvatar } from '@/components/domain/badges';
import { LoyaltyProgressBar } from '@/components/domain/loyalty';
import { PhoneInput } from '@/components/domain/pickers';
import {
  Chip,
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSheet,
  GlassTextarea,
  SectionTitle,
  StatTile,
} from '@/components/ui/glass';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { haptic, openUsername } from '@/lib/telegram';

const FILTERS = ['all', 'sleeping', 'birthday', 'new', 'blacklisted'] as const;

export function ClientsListView({
  base,
  currency,
  canWrite,
}: {
  base: CabinetBase;
  currency: string;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    firstName: '',
    phone: '',
    phoneCountry: 'RU',
    username: '',
  });
  const clients = useClients(base, { q: debounced || undefined, filter, page: 1 });
  const { create } = useClientMutations(base);
  const cabinet = base === '/api/master' ? '/master' : '/salon';
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <GlassInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('master.clients.search')}
            className="pl-10"
          />
        </div>
        {canWrite && base === '/api/master' ? (
          <GlassButton
            size="icon"
            variant="primary"
            aria-label={t('master.clients.add')}
            onClick={() => setAddOpen(true)}
          >
            <Plus />
          </GlassButton>
        ) : null}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {t(`master.clients.filters.${f}`)}
          </Chip>
        ))}
      </div>
      {clients.isLoading ? (
        <ListSkeleton count={5} />
      ) : clients.isError ? (
        <ErrorState onRetry={() => void clients.refetch()} />
      ) : !clients.data?.items.length ? (
        <EmptyState
          emoji="👥"
          title={t('master.clients.empty')}
          text={t('master.clients.emptyText')}
        />
      ) : (
        <GlassCard className="flex flex-col divide-y divide-border p-0">
          {clients.data.items.map((c) => (
            <Link
              key={c.id}
              to={`${cabinet}/clients/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-muted"
            >
              <UserAvatar name={c.firstName} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium">{c.firstName ?? '—'}</span>
                  {c.isBlacklisted ? <Ban className="size-3.5 text-destructive" /> : null}
                  {c.hasTelegram ? (
                    <Send
                      className="size-3 text-sky-500"
                      aria-label={t('master.clients.telegram')}
                    />
                  ) : null}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {base === '/api/salon' ? `${c.masterName} · ` : ''}
                  {t('common.visits', { count: c.visitsCount })} ·{' '}
                  {c.lastVisitAt ? formatDate(c.lastVisitAt) : t('master.clients.noVisits')}
                </div>
              </div>
              <span className="shrink-0 text-[13px] font-semibold">
                {formatPrice(c.totalSpent, currency)}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </GlassCard>
      )}
      <GlassSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('master.clients.add')}
        footer={
          <GlassButton
            variant="primary"
            size="lg"
            block
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                {
                  firstName: draft.firstName.trim(),
                  phone: draft.phone || undefined,
                  phoneCountry: draft.phoneCountry,
                  username: draft.username || null,
                },
                {
                  onSuccess: (c) => {
                    toast.success(t('master.clients.created'));
                    setAddOpen(false);
                    navigate(`${cabinet}/clients/${c.id}`);
                  },
                },
              )
            }
          >
            {t('common.add')}
          </GlassButton>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t('client.profile.firstName')}>
            <GlassInput
              value={draft.firstName}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
            />
          </Field>
          <Field label={t('client.profile.phone')}>
            <PhoneInput
              value={draft.phone}
              country={draft.phoneCountry}
              onChange={(phone) => setDraft((d) => ({ ...d, phone }))}
              onCountryChange={(phoneCountry) => setDraft((d) => ({ ...d, phoneCountry }))}
            />
          </Field>
          <Field label={t('client.profile.username')}>
            <GlassInput
              value={draft.username}
              placeholder="@username"
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            />
          </Field>
        </div>
      </GlassSheet>
    </>
  );
}

export function ClientDetailView({
  base,
  id,
  currency,
  timezone,
  canWrite,
}: {
  base: CabinetBase;
  id: string;
  currency: string;
  timezone: string;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const detail = useClientDetail(base, id);
  const { update, remind } = useClientMutations(base);
  const blacklist = useBlacklistMutations();
  const [notes, setNotes] = useState('');
  const [remindOpen, setRemindOpen] = useState(false);
  const [text, setText] = useState('');
  const c = detail.data;
  useEffect(() => {
    if (c) setNotes(c.notes ?? '');
  }, [c]);
  if (detail.isLoading) return <PageLoader />;
  if (!c) return <ErrorState onRetry={() => void detail.refetch()} />;

  return (
    <>
      <GlassCard className="flex items-center gap-4">
        <UserAvatar name={c.firstName} size={64} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[20px] font-semibold">{c.firstName ?? '—'}</div>
          <div className="text-[13px] text-muted-foreground">
            {c.birthday ? (
              <span className="inline-flex items-center gap-1">
                <MonoEmoji>✦</MonoEmoji> {formatDate(c.birthday)}
              </span>
            ) : null}{' '}
            {c.gender ? `· ${t(`enums.gender.${c.gender}`)}` : null}
          </div>
          {c.isBlacklisted ? (
            <div className="mt-1 text-[13px] font-medium text-destructive">
              {t('master.clients.inBlacklist')}
            </div>
          ) : null}
        </div>
      </GlassCard>
      <div className="flex flex-wrap gap-2">
        {c.phone ? (
          <GlassButton asChild size="sm">
            <a href={`tel:${c.phone}`}>
              <Phone /> {formatPhone(c.phone)}
            </a>
          </GlassButton>
        ) : null}
        {c.username ? (
          <GlassButton size="sm" onClick={() => openUsername(c.username!)}>
            <Send /> @{c.username}
          </GlassButton>
        ) : null}
        {c.hasTelegram && canWrite ? (
          <GlassButton size="sm" variant="soft" onClick={() => setRemindOpen(true)}>
            <Bell /> {t('master.clients.remind')}
          </GlassButton>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('master.analytics.completed')} value={c.visitsCount} />
        <StatTile label={t('master.clients.spent')} value={formatPrice(c.totalSpent, currency)} />
        <StatTile
          label={t('master.clients.noShows')}
          value={c.noShowCount}
          hint={`${t('master.clients.lates')}: ${c.lateCount}`}
        />
      </div>
      {c.loyaltyProgress ? (
        <GlassCard>
          <LoyaltyProgressBar progress={c.loyaltyProgress} />
        </GlassCard>
      ) : null}
      <Field label={t('master.clients.notes')}>
        <GlassTextarea
          value={notes}
          disabled={!canWrite}
          placeholder={t('master.clients.notesPlaceholder')}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() =>
            notes !== (c.notes ?? '') &&
            update.mutate(
              { id: c.id, input: { notes: notes || null } },
              { onSuccess: () => toast.success(t('master.clients.saved')) },
            )
          }
        />
      </Field>
      <section>
        <SectionTitle>{t('master.clients.history')}</SectionTitle>
        <GlassCard className="flex flex-col divide-y divide-border p-0">
          {c.appointments.length ? (
            c.appointments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium capitalize">
                    {formatDateTime(a.startAt, timezone)}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {a.services.map((s) => s.name).join(', ')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[13px] font-semibold">
                    {formatPrice(a.price, currency)}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))
          ) : (
            <p className="px-4 py-4 text-[14px] text-muted-foreground">
              {t('master.clients.noVisits')}
            </p>
          )}
        </GlassCard>
      </section>
      {base === '/api/master' && canWrite && !c.isBlacklisted && (c.username || c.phone) ? (
        <GlassButton
          variant="destructive"
          block
          loading={blacklist.add.isPending}
          onClick={() =>
            blacklist.add.mutate(
              { username: c.username, phone: c.phone },
              {
                onSuccess: () => {
                  haptic.notify('warning');
                  toast.success(t('master.blacklist.added'));
                },
              },
            )
          }
        >
          <Ban /> {t('master.clients.toBlacklist')}
        </GlassButton>
      ) : null}
      <GlassSheet
        open={remindOpen}
        onOpenChange={setRemindOpen}
        title={t('master.clients.remind')}
        footer={
          <GlassButton
            variant="primary"
            size="lg"
            block
            loading={remind.isPending}
            onClick={() =>
              remind.mutate(
                { id: c.id, text: text.trim() || undefined },
                {
                  onSuccess: () => {
                    toast.success(t('master.dashboard.reminded'));
                    setRemindOpen(false);
                    setText('');
                  },
                },
              )
            }
          >
            <Send /> {t('master.clients.send')}
          </GlassButton>
        }
      >
        <GlassTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('master.clients.remindPlaceholder')}
          maxLength={1000}
        />
      </GlassSheet>
    </>
  );
}
