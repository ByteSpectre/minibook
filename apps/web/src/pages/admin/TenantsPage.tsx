import { Ban, CalendarPlus, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import {
  SUB_STATUSES,
  type AdminTenantRowDto,
  type SubStatus,
  type TenantKind,
} from '@nail-crm/shared';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTenantAction, useTenants } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { SubStatusBadge } from '@/components/domain/badges';
import { Chip, Field, GlassButton, GlassCard, GlassInput, GlassSheet } from '@/components/ui/glass';
import { formatDate, formatPrice } from '@/lib/format';

function TenantSheet({
  kind,
  tenant,
  onClose,
}: {
  kind: TenantKind;
  tenant: AdminTenantRowDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const action = useTenantAction(kind);
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  if (!tenant) return null;
  const run = (input: Parameters<typeof action.mutate>[0]['input']) =>
    action.mutate(
      { id: tenant.id, input },
      {
        onSuccess: () => {
          toast.success(t('admin.tenants.done'));
          onClose();
        },
      },
    );
  const banned = tenant.status === 'BANNED';
  return (
    <GlassSheet
      open={!!tenant}
      onOpenChange={(o) => !o && onClose()}
      title={tenant.name}
      description={`/${kind === 'master' ? 'm' : 's'}/${tenant.slug}`}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-[14px]">
          {[
            [
              t('master.subscription.status'),
              <SubStatusBadge key="s" status={tenant.effectiveStatus} />,
            ],
            [t('admin.tenants.created'), formatDate(tenant.createdAt)],
            [
              t('admin.tenants.trialUntil'),
              tenant.trialEndsAt ? formatDate(tenant.trialEndsAt) : '—',
            ],
            [
              t('admin.tenants.subUntil'),
              tenant.subscriptionEndsAt ? formatDate(tenant.subscriptionEndsAt) : '—',
            ],
            [t('admin.tenants.paid'), formatPrice(tenant.paidTotalRub)],
            [t('admin.tenants.appointments'), tenant.appointmentsCount],
            [t('admin.tenants.owner'), tenant.ownerTelegramId ?? '—'],
            [
              t('master.subscription.autoRenew'),
              tenant.autoRenewEnabled ? t('common.yes') : t('common.no'),
            ],
          ].map(([label, value], i) => (
            <div key={i}>
              <dt className="text-[12px] text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {tenant.salonName ? (
          <p className="text-[13px] text-muted-foreground">
            {t('admin.tenants.inSalon', { name: tenant.salonName })}
          </p>
        ) : null}
        {tenant.experimentVariant ? (
          <p className="text-[13px] text-muted-foreground">
            {t('admin.tenants.variant', { v: tenant.experimentVariant })}
          </p>
        ) : null}
        {tenant.bannedReason ? (
          <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {tenant.bannedReason}
          </p>
        ) : null}

        <GlassButton
          block
          onClick={() => navigate(`/${kind === 'master' ? 'm' : 's'}/${tenant.slug}`)}
        >
          <ExternalLink /> {t('admin.tenants.open')}
        </GlassButton>

        <GlassCard className="flex items-end gap-2 p-3">
          <Field label={t('admin.tenants.extendDays')} className="w-24">
            <GlassInput
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </Field>
          <GlassButton
            variant="solid"
            className="h-12 flex-1"
            disabled={!Number(days)}
            loading={action.isPending && action.variables?.input.action === 'extend'}
            onClick={() => run({ action: 'extend', days: Number(days) })}
          >
            <CalendarPlus /> {t('admin.tenants.extend')}
          </GlassButton>
        </GlassCard>

        {banned ? (
          <GlassButton
            variant="primary"
            block
            loading={action.isPending}
            onClick={() => run({ action: 'unban' })}
          >
            <ShieldCheck /> {t('admin.tenants.unban')}
          </GlassButton>
        ) : (
          <GlassCard className="flex flex-col gap-2 p-3">
            <Field label={t('admin.tenants.banReason')}>
              <GlassInput
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <GlassButton
              variant="destructive"
              block
              loading={action.isPending && action.variables?.input.action === 'ban'}
              onClick={() => run({ action: 'ban', reason: reason.trim() || undefined })}
            >
              <Ban /> {t('admin.tenants.ban')}
            </GlassButton>
          </GlassCard>
        )}
      </div>
    </GlassSheet>
  );
}

export function TenantsView({ kind }: { kind: TenantKind }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as SubStatus | null) ?? undefined;
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const deferredQ = useDeferredValue(q.trim());
  const list = useTenants(kind, { q: deferredQ || undefined, status, page });
  const [open, setOpen] = useState<AdminTenantRowDto | null>(null);
  const setStatus = (s?: SubStatus) => {
    setPage(1);
    setParams(s ? { status: s } : {}, { replace: true });
  };

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <GlassInput
          value={q}
          placeholder={t('admin.tenants.search')}
          className="pl-10"
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={!status} onClick={() => setStatus()}>
          {t('admin.tenants.allStatuses')}
        </Chip>
        {SUB_STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {t(`enums.subStatus.${s}`)}
          </Chip>
        ))}
      </div>
      {list.isLoading ? (
        <ListSkeleton count={5} />
      ) : list.isError || !list.data ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data.items.length ? (
        <EmptyState emoji="🔍" title={t('admin.tenants.empty')} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.data.items.map((r) => (
            <GlassCard
              key={r.id}
              interactive
              className="flex cursor-pointer items-center gap-3 p-3.5"
              onClick={() => setOpen(r)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{r.name}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  /{kind === 'master' ? 'm' : 's'}/{r.slug}
                  {r.cityName ? ` · ${r.cityName}` : ''}
                  {r.mastersCount !== null
                    ? ` · ${t('components.mastersInSalon', { count: r.mastersCount })}`
                    : ''}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {t('admin.tenants.paid')}: {formatPrice(r.paidTotalRub)} ·{' '}
                  {t('admin.tenants.appointments')}: {r.appointmentsCount}
                </div>
              </div>
              <SubStatusBadge status={r.effectiveStatus} />
            </GlassCard>
          ))}
          <div className="flex items-center justify-between pt-1">
            <GlassButton size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ←
            </GlassButton>
            <span className="text-[13px] text-muted-foreground">
              {page} · {list.data.total}
            </span>
            <GlassButton
              size="sm"
              disabled={!list.data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </GlassButton>
          </div>
        </div>
      )}
      <TenantSheet
        key={open?.id ?? 'none'}
        kind={kind}
        tenant={open}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

export function AdminMastersPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('admin.menu.masters')}>
      <TenantsView kind="master" />
    </Page>
  );
}

export function AdminSalonsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('admin.menu.salons')}>
      <TenantsView kind="salon" />
    </Page>
  );
}
