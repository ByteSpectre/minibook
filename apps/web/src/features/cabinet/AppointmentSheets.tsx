import { Ban, Check, CheckCheck, Phone, RefreshCw, RotateCcw, Send, UserX, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatPhone, type MasterAppointmentDto } from '@nail-crm/shared';
import {
  useAppointmentMutations,
  useClients,
  useMasterSlots,
  useServices,
  useTimeBlockMutations,
  type CabinetBase,
} from '@/api/cabinetApi';
import { StatusBadge } from '@/components/domain/badges';
import { PhotoStrip } from '@/components/domain/media';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import { PhoneInput } from '@/components/domain/pickers';
import { Chip, Field, GlassButton, GlassCard, GlassInput, GlassSheet } from '@/components/ui/glass';
import { Switch } from '@/components/ui/switch';
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  formatTime,
  todayIn,
  zonedIso,
} from '@/lib/format';
import { haptic, openUsername } from '@/lib/telegram';
import { cn } from '@/lib/utils';

function useDone() {
  const { t } = useTranslation();
  return () => {
    haptic.notify('success');
    toast.success(t('master.schedule.updated'));
  };
}

function RescheduleBlock({
  appointment,
  timezone,
  base,
  onDone,
}: {
  appointment: MasterAppointmentDto;
  timezone: string;
  base: CabinetBase;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [day, setDay] = useState(todayIn(timezone));
  const [time, setTime] = useState(formatTime(appointment.startAt, timezone));
  const slots = useMasterSlots(
    base === '/api/master' ? appointment.services.map((s) => s.serviceId) : [],
    day,
  );
  const { update } = useAppointmentMutations(base);
  const done = useDone();
  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="text-[15px] font-semibold">{t('master.schedule.moveTo')}</div>
      <div className="grid grid-cols-2 gap-2">
        <GlassInput type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <GlassInput type="time" step={600} value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      {slots.data?.periods.length ? (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {slots.data.periods
            .flatMap((p) => p.slots)
            .slice(0, 24)
            .map((s) => (
              <Chip key={s.startAt} active={s.time === time} onClick={() => setTime(s.time)}>
                {s.time}
              </Chip>
            ))}
        </div>
      ) : null}
      <GlassButton
        variant="primary"
        loading={update.isPending}
        onClick={() =>
          update.mutate(
            { id: appointment.id, input: { startAt: zonedIso(day, time, timezone) } },
            { onSuccess: () => (done(), onDone()) },
          )
        }
      >
        <RefreshCw /> {t('master.schedule.reschedule')}
      </GlassButton>
    </GlassCard>
  );
}

export function AppointmentSheet({
  appointment,
  timezone,
  currency,
  base,
  onClose,
}: {
  appointment: MasterAppointmentDto | null;
  timezone: string;
  currency: string;
  base: CabinetBase;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { update, photos } = useAppointmentMutations(base);
  const done = useDone();
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  useEffect(() => setMode('view'), [appointment?.id]);
  if (!appointment) return null;
  const a = appointment;
  const setStatus = (status: MasterAppointmentDto['status']) =>
    update.mutate(
      { id: a.id, input: { status } },
      { onSuccess: () => (done(), status !== 'COMPLETED' && onClose()) },
    );
  const duration = Math.round(
    (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000,
  );
  const active = a.status === 'PENDING' || a.status === 'CONFIRMED';

  return (
    <GlassSheet
      open={!!appointment}
      onOpenChange={(o) => !o && onClose()}
      title={formatDateTime(a.startAt, timezone)}
      description={`${a.masterName} · ${formatDuration(duration)}`}
    >
      <div className="flex flex-col gap-4 pb-2">
        <GlassCard className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[17px] font-semibold">
                {a.client.firstName ?? '—'}{' '}
                {a.client.isNew ? (
                  <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                    {t('master.schedule.newClient')}
                  </span>
                ) : null}
              </div>
              <div className="text-[13px] text-muted-foreground">
                {t('common.visits', { count: a.client.visitsCount })}
              </div>
            </div>
            <StatusBadge status={a.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {a.client.phone ? (
              <GlassButton asChild size="sm">
                <a href={`tel:${a.client.phone}`}>
                  <Phone /> {formatPhone(a.client.phone)}
                </a>
              </GlassButton>
            ) : null}
            {a.client.username ? (
              <GlassButton size="sm" onClick={() => openUsername(a.client.username!)}>
                <Send /> @{a.client.username}
              </GlassButton>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-1.5">
          {a.services.map((s) => (
            <div key={s.id} className="flex justify-between text-[14px]">
              <span>{s.name}</span>
              <span className="text-muted-foreground">{formatPrice(s.price, currency)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-[15px] font-semibold">
            <span>
              {t('client.calendar.total')}
              {a.discountPct ? (
                <span className="ml-2 text-[12px] font-medium text-primary">
                  {t('master.schedule.discount', { pct: a.discountPct })}
                </span>
              ) : null}
            </span>
            <span>{formatPrice(a.price, currency)}</span>
          </div>
        </GlassCard>

        {a.clientComment ? (
          <Field label={t('master.schedule.clientComment')}>
            <p className="rounded-2xl bg-muted px-3 py-2 text-[14px]">{a.clientComment}</p>
          </Field>
        ) : null}
        {a.photos.length ? (
          <Field label={t('master.schedule.references')}>
            <PhotoStrip photos={a.photos} size={88} />
          </Field>
        ) : null}

        {a.status === 'COMPLETED' && base === '/api/master' ? (
          <GlassCard className="flex flex-col gap-3">
            <div className="text-[15px] font-semibold">{t('master.schedule.photos')}</div>
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <SinglePhotoUploader
                  endpoint="/api/master/upload"
                  kind="appointment"
                  value={a.beforePhotoUrl}
                  onChange={(url) =>
                    photos.mutate({ id: a.id, beforePhotoUrl: url, afterPhotoUrl: a.afterPhotoUrl })
                  }
                />
                <span className="text-[12px] text-muted-foreground">
                  {t('master.schedule.before')}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <SinglePhotoUploader
                  endpoint="/api/master/upload"
                  kind="appointment"
                  value={a.afterPhotoUrl}
                  onChange={(url) =>
                    photos.mutate({
                      id: a.id,
                      beforePhotoUrl: a.beforePhotoUrl,
                      afterPhotoUrl: url,
                    })
                  }
                />
                <span className="text-[12px] text-muted-foreground">
                  {t('master.schedule.after')}
                </span>
              </div>
            </div>
            <label className="flex items-center justify-between text-[14px]">
              {t('master.schedule.late')}
              <Switch
                checked={a.clientLate}
                onCheckedChange={(clientLate) => update.mutate({ id: a.id, input: { clientLate } })}
              />
            </label>
          </GlassCard>
        ) : null}

        {mode === 'reschedule' ? (
          <RescheduleBlock appointment={a} timezone={timezone} base={base} onDone={onClose} />
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {a.status === 'PENDING' ? (
            <GlassButton
              variant="primary"
              loading={update.isPending}
              onClick={() => setStatus('CONFIRMED')}
            >
              <Check /> {t('master.schedule.confirm')}
            </GlassButton>
          ) : null}
          {a.status === 'CONFIRMED' || a.status === 'PENDING' ? (
            <GlassButton
              variant={a.status === 'CONFIRMED' ? 'primary' : 'glass'}
              loading={update.isPending}
              onClick={() => setStatus('COMPLETED')}
            >
              <CheckCheck /> {t('master.schedule.complete')}
            </GlassButton>
          ) : null}
          {active ? (
            <>
              <GlassButton onClick={() => setMode(mode === 'reschedule' ? 'view' : 'reschedule')}>
                <RefreshCw /> {t('master.schedule.reschedule')}
              </GlassButton>
              <GlassButton onClick={() => setStatus('NO_SHOW')}>
                <UserX /> {t('master.schedule.noShow')}
              </GlassButton>
              <GlassButton
                variant="destructive"
                className="col-span-2"
                onClick={() => setStatus('CANCELLED')}
              >
                <Ban /> {t('master.schedule.cancel')}
              </GlassButton>
            </>
          ) : null}
          {a.status === 'NO_SHOW' || a.status === 'COMPLETED' ? (
            <GlassButton onClick={() => setStatus('CONFIRMED')}>
              <RotateCcw /> {t('master.schedule.restore')}
            </GlassButton>
          ) : null}
        </div>
      </div>
    </GlassSheet>
  );
}

export function NewAppointmentSheet({
  open,
  onClose,
  base,
  timezone,
  currency,
  masters,
  defaultDay,
}: {
  open: boolean;
  onClose: () => void;
  base: CabinetBase;
  timezone: string;
  currency: string;
  /** Salon cabinets pick a master first; services come with each master. */
  masters?: {
    id: string;
    name: string;
    services: { id: string; name: string; price: number; duration: number }[];
  }[];
  defaultDay?: string;
}) {
  const { t } = useTranslation();
  const ownServices = useServices();
  const [masterId, setMasterId] = useState<string | null>(masters?.[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [client, setClient] = useState({ firstName: '', phone: '', phoneCountry: 'RU' });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [day, setDay] = useState(defaultDay ?? todayIn(timezone));
  const [time, setTime] = useState('12:00');
  const [force, setForce] = useState(false);
  const clients = useClients(base, { q: query || undefined, page: 1 });
  const slots = useMasterSlots(base === '/api/master' ? serviceIds : [], day);
  const { create } = useAppointmentMutations(base);

  useEffect(() => {
    if (open) {
      setDay(defaultDay ?? todayIn(timezone));
      setServiceIds([]);
      setClientId(null);
      setNewClient(false);
      setQuery('');
    }
  }, [open, defaultDay, timezone]);

  const services = useMemo(
    () =>
      masters
        ? (masters.find((m) => m.id === masterId)?.services ?? [])
        : (ownServices.data ?? []).filter((s) => s.isActive),
    [masters, masterId, ownServices.data],
  );
  const clientList = (clients.data?.items ?? []).filter((c) => !masters || c.masterId === masterId);
  const total = services.filter((s) => serviceIds.includes(s.id)).reduce((s, x) => s + x.price, 0);

  const submit = () => {
    if (!serviceIds.length || (!clientId && !(newClient && client.firstName.trim()))) {
      haptic.notify('error');
      toast.error(t('validation.client'));
      return;
    }
    create.mutate(
      {
        ...(masters && masterId ? { masterId } : {}),
        serviceIds,
        startAt: zonedIso(day, time, timezone),
        status: 'CONFIRMED',
        force,
        ...(clientId
          ? { clientId }
          : {
              newClient: {
                firstName: client.firstName.trim(),
                phone: client.phone || undefined,
                phoneCountry: client.phoneCountry,
              },
            }),
      },
      {
        onSuccess: () => {
          haptic.notify('success');
          toast.success(t('master.schedule.created'));
          onClose();
        },
      },
    );
  };

  return (
    <GlassSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('master.schedule.newAppointment')}
      footer={
        <GlassButton variant="primary" size="lg" block loading={create.isPending} onClick={submit}>
          {t('common.create')} {total ? `· ${formatPrice(total, currency)}` : ''}
        </GlassButton>
      }
    >
      <div className="flex flex-col gap-4">
        {masters ? (
          <Field label={t('salon.promotions.master')}>
            <div className="flex flex-wrap gap-2">
              {masters.map((m) => (
                <Chip
                  key={m.id}
                  active={m.id === masterId}
                  onClick={() => (setMasterId(m.id), setServiceIds([]), setClientId(null))}
                >
                  {m.name}
                </Chip>
              ))}
            </div>
          </Field>
        ) : null}
        <Field label={t('master.schedule.client')}>
          <div className="flex gap-2">
            <Chip active={!newClient} onClick={() => setNewClient(false)}>
              {t('master.schedule.searchClient')}
            </Chip>
            <Chip active={newClient} onClick={() => (setNewClient(true), setClientId(null))}>
              {t('master.schedule.addNewClient')}
            </Chip>
          </div>
        </Field>
        {newClient ? (
          <GlassCard className="flex flex-col gap-3">
            <GlassInput
              placeholder={t('client.profile.firstName')}
              value={client.firstName}
              onChange={(e) => setClient((c) => ({ ...c, firstName: e.target.value }))}
            />
            <PhoneInput
              value={client.phone}
              country={client.phoneCountry}
              onChange={(phone) => setClient((c) => ({ ...c, phone }))}
              onCountryChange={(phoneCountry) => setClient((c) => ({ ...c, phoneCountry }))}
            />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-2">
            <GlassInput
              placeholder={t('master.clients.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {clientList.slice(0, 20).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  className={cn(
                    'flex min-h-11 items-center justify-between rounded-2xl px-3 text-left text-[14px]',
                    clientId === c.id ? 'bg-foreground text-background' : 'active:bg-muted',
                  )}
                >
                  <span className="truncate">{c.firstName ?? '—'}</span>
                  <span
                    className={cn(
                      'text-[12px]',
                      clientId === c.id ? 'opacity-80' : 'text-muted-foreground',
                    )}
                  >
                    {c.phone ? formatPhone(c.phone) : c.username ? `@${c.username}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label={t('master.schedule.services')}>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <Chip
                key={s.id}
                active={serviceIds.includes(s.id)}
                onClick={() =>
                  setServiceIds((ids) =>
                    ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id],
                  )
                }
              >
                {s.name} · {formatPrice(s.price, currency)}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('master.schedule.date')}>
            <GlassInput type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label={t('master.schedule.time')}>
            <GlassInput
              type="time"
              step={600}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        {slots.data?.periods.length ? (
          <Field label={t('master.schedule.freeSlots')}>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {slots.data.periods
                .flatMap((p) => p.slots)
                .slice(0, 30)
                .map((s) => (
                  <Chip key={s.startAt} active={s.time === time} onClick={() => setTime(s.time)}>
                    {s.time}
                  </Chip>
                ))}
            </div>
          </Field>
        ) : null}
        <label className="flex items-center justify-between text-[14px]">
          {t('master.schedule.force')}
          <Switch checked={force} onCheckedChange={setForce} />
        </label>
      </div>
    </GlassSheet>
  );
}

export function TimeBlockSheet({
  open,
  onClose,
  timezone,
  defaultDay,
}: {
  open: boolean;
  onClose: () => void;
  timezone: string;
  defaultDay?: string;
}) {
  const { t } = useTranslation();
  const { create } = useTimeBlockMutations();
  const [day, setDay] = useState(defaultDay ?? todayIn(timezone));
  const [from, setFrom] = useState('13:00');
  const [to, setTo] = useState('14:00');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setDay(defaultDay ?? todayIn(timezone));
  }, [open, defaultDay, timezone]);
  return (
    <GlassSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('master.schedule.blockTitle')}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              {
                startAt: zonedIso(day, from, timezone),
                endAt: zonedIso(day, to, timezone),
                reason: reason.trim() || null,
              },
              {
                onSuccess: () => {
                  haptic.notify('success');
                  toast.success(t('master.schedule.blocked'));
                  onClose();
                },
              },
            )
          }
        >
          <X /> {t('master.dashboard.blockTime')}
        </GlassButton>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t('master.schedule.date')}>
          <GlassInput type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('master.schedule.from')}>
            <GlassInput
              type="time"
              step={600}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t('master.schedule.to')}>
            <GlassInput type="time" step={600} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label={t('master.schedule.blockReason')}>
          <GlassInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </GlassSheet>
  );
}
