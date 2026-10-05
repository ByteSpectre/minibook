import { Plus, Trash2 } from 'lucide-react';
import { PROMO_TYPES, type PromoCodeDto, type PromoType } from '@nail-crm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePromoCodes } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { Switch } from '@/components/ui/switch';
import {
  Chip,
  Field,
  GlassButton,
  GlassInput,
  GlassSheet,
  ListGroup,
  ListRow,
} from '@/components/ui/glass';
import { formatDate } from '@/lib/format';
import { confirmDialog } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface Draft {
  id: string | null;
  code: string;
  type: PromoType;
  value: string;
  maxUsages: string;
  expiresAt: string;
  isActive: boolean;
}

const toDraft = (p?: PromoCodeDto): Draft => ({
  id: p?.id ?? null,
  code: p?.code ?? '',
  type: p?.type ?? 'DISCOUNT_PERCENT',
  value: p ? String(p.value) : '20',
  maxUsages: p?.maxUsages ? String(p.maxUsages) : '',
  expiresAt: p?.expiresAt ? p.expiresAt.slice(0, 10) : '',
  isActive: p?.isActive ?? true,
});

export default function AdminPromoCodesPage() {
  const { t } = useTranslation();
  const { list, save, remove } = usePromoCodes();
  const [draft, setDraft] = useState<Draft | null>(null);
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const submit = () =>
    draft &&
    save.mutate(
      {
        id: draft.id,
        input: {
          code: draft.code,
          type: draft.type,
          value: Number(draft.value),
          maxUsages: draft.maxUsages ? Number(draft.maxUsages) : null,
          expiresAt: draft.expiresAt || null,
          isActive: draft.isActive,
        },
      },
      { onSuccess: () => (toast.success(t('admin.dict.saved')), setDraft(null)) },
    );

  const [now] = useState(Date.now);
  return (
    <Page title={t('admin.promo.title')} back>
      <GlassButton variant="primary" block onClick={() => setDraft(toDraft())}>
        <Plus /> {t('admin.promo.add')}
      </GlassButton>
      {list.isLoading ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState emoji="🎟" />
      ) : (
        <ListGroup>
          {list.data.map((p) => {
            const expired = !!p.expiresAt && new Date(p.expiresAt).getTime() < now;
            return (
              <ListRow
                key={p.id}
                className={cn((!p.isActive || expired) && 'opacity-55')}
                title={<span className="font-mono tracking-wide">{p.code}</span>}
                subtitle={`${p.type === 'FREE_DAYS' ? t('master.subscription.promoDays', { days: p.value }) : `−${p.value}%`} · ${t(
                  'admin.promo.used',
                  {
                    used: p.usedCount,
                    max: p.maxUsages ?? t('admin.promo.unlimited'),
                  },
                )}${p.expiresAt ? ` · ${t('common.to')} ${formatDate(p.expiresAt)}` : ''}`}
                right={
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium">
                    {expired
                      ? t('admin.promo.expired')
                      : p.isActive
                        ? t('admin.promo.active')
                        : t('admin.dict.inactive')}
                  </span>
                }
                onClick={() => setDraft(toDraft(p))}
              />
            );
          })}
        </ListGroup>
      )}

      <GlassSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? draft.code : t('admin.promo.add')}
        footer={
          <div className="flex gap-2">
            {draft?.id ? (
              <GlassButton
                variant="destructive"
                size="icon"
                aria-label={t('common.delete')}
                onClick={async () => {
                  if (
                    await confirmDialog(
                      t('admin.dict.deleteConfirm'),
                      t('common.delete'),
                      t('common.cancel'),
                    )
                  )
                    remove.mutate(draft.id!, { onSuccess: () => setDraft(null) });
                }}
              >
                <Trash2 />
              </GlassButton>
            ) : null}
            <GlassButton
              variant="primary"
              block
              loading={save.isPending}
              disabled={!draft || draft.code.length < 3 || !Number(draft.value)}
              onClick={submit}
            >
              {t('common.save')}
            </GlassButton>
          </div>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <Field label={t('admin.promo.code')}>
              <GlassInput
                value={draft.code}
                autoCapitalize="characters"
                className="font-mono"
                onChange={(e) =>
                  set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })
                }
              />
            </Field>
            <Field label={t('admin.promo.type')}>
              <div className="flex gap-2">
                {PROMO_TYPES.map((type) => (
                  <Chip key={type} active={draft.type === type} onClick={() => set({ type })}>
                    {t(`enums.promoType.${type}`)}
                  </Chip>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label={
                  draft.type === 'FREE_DAYS'
                    ? t('admin.promo.valueDays')
                    : t('admin.promo.valuePct')
                }
              >
                <GlassInput
                  inputMode="numeric"
                  value={draft.value}
                  onChange={(e) => set({ value: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                />
              </Field>
              <Field label={t('admin.promo.maxUsages')}>
                <GlassInput
                  inputMode="numeric"
                  value={draft.maxUsages}
                  placeholder="∞"
                  onChange={(e) => set({ maxUsages: e.target.value.replace(/\D/g, '') })}
                />
              </Field>
            </div>
            <Field label={t('admin.promo.expiresAt')}>
              <GlassInput
                type="date"
                value={draft.expiresAt}
                onChange={(e) => set({ expiresAt: e.target.value })}
              />
            </Field>
            <label className="flex items-center justify-between px-1 py-1 text-[15px]">
              {t('admin.promo.active')}
              <Switch checked={draft.isActive} onCheckedChange={(isActive) => set({ isActive })} />
            </label>
          </div>
        ) : null}
      </GlassSheet>
    </Page>
  );
}
