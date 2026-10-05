import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import type { ExperimentDto, ExperimentVariant } from '@nail-crm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useExperiments } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSheet,
  GlassTextarea,
} from '@/components/ui/glass';
import { formatDate } from '@/lib/format';
import { confirmDialog } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface VariantDraft {
  priceRub: string;
  paywallTitle: string;
  paywallText: string;
}

interface Draft {
  id: string | null;
  name: string;
  hypothesis: string;
  variantA: VariantDraft;
  variantB: VariantDraft;
  splitPercent: number;
  isActive: boolean;
}

const variantDraft = (v?: Record<string, unknown>): VariantDraft => ({
  priceRub: typeof v?.priceRub === 'number' ? String(v.priceRub) : '',
  paywallTitle: typeof v?.paywallTitle === 'string' ? v.paywallTitle : '',
  paywallText: typeof v?.paywallText === 'string' ? v.paywallText : '',
});

const toVariant = (v: VariantDraft): ExperimentVariant => ({
  ...(v.priceRub ? { priceRub: Number(v.priceRub) } : {}),
  ...(v.paywallTitle.trim() ? { paywallTitle: v.paywallTitle.trim() } : {}),
  ...(v.paywallText.trim() ? { paywallText: v.paywallText.trim() } : {}),
});

const toDraft = (e?: ExperimentDto): Draft => ({
  id: e?.id ?? null,
  name: e?.name ?? '',
  hypothesis: e?.hypothesis ?? '',
  variantA: variantDraft(e?.variantA),
  variantB: variantDraft(e?.variantB ?? { priceRub: 399 }),
  splitPercent: e?.splitPercent ?? 50,
  isActive: e?.isActive ?? false,
});

function VariantFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: VariantDraft;
  onChange: (v: VariantDraft) => void;
}) {
  const { t } = useTranslation();
  return (
    <GlassCard className="flex flex-col gap-2 p-3">
      <div className="text-[14px] font-semibold">{label}</div>
      <Field label={t('admin.experiments.priceRub')}>
        <GlassInput
          inputMode="numeric"
          value={value.priceRub}
          placeholder="449"
          onChange={(e) =>
            onChange({ ...value, priceRub: e.target.value.replace(/\D/g, '').slice(0, 6) })
          }
        />
      </Field>
      <Field label={t('admin.experiments.paywallTitle')}>
        <GlassInput
          value={value.paywallTitle}
          maxLength={120}
          onChange={(e) => onChange({ ...value, paywallTitle: e.target.value })}
        />
      </Field>
      <Field label={t('admin.experiments.paywallText')}>
        <GlassTextarea
          value={value.paywallText}
          maxLength={600}
          className="min-h-16"
          onChange={(e) => onChange({ ...value, paywallText: e.target.value })}
        />
      </Field>
    </GlassCard>
  );
}

export default function AdminExperimentsPage() {
  const { t } = useTranslation();
  const { list, save, remove } = useExperiments();
  const [draft, setDraft] = useState<Draft | null>(null);
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const submit = () =>
    draft &&
    save.mutate(
      {
        id: draft.id,
        input: {
          name: draft.name.trim(),
          hypothesis: draft.hypothesis.trim() || null,
          variantA: toVariant(draft.variantA),
          variantB: toVariant(draft.variantB),
          splitPercent: draft.splitPercent,
          isActive: draft.isActive,
        },
      },
      { onSuccess: () => (toast.success(t('admin.dict.saved')), setDraft(null)) },
    );

  return (
    <Page title={t('admin.experiments.title')} back bottomInset="none">
      <GlassButton variant="primary" block onClick={() => setDraft(toDraft())}>
        <Plus /> {t('admin.experiments.add')}
      </GlassButton>
      <p className="px-1 text-[12px] text-muted-foreground">{t('admin.experiments.onlyOne')}</p>
      {list.isLoading ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState emoji="🧪" />
      ) : (
        list.data.map((e) => (
          <GlassCard
            key={e.id}
            interactive
            className={cn('flex cursor-pointer flex-col gap-3', !e.isActive && 'opacity-80')}
            onClick={() => setDraft(toDraft(e))}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[16px] font-semibold">
                  <FlaskConical className="size-4 text-primary" /> {e.name}
                </div>
                {e.hypothesis ? (
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{e.hypothesis}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium',
                  e.isActive
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted',
                )}
              >
                {e.isActive ? t('admin.experiments.active') : t('admin.dict.inactive')}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t('admin.experiments.split', { pct: e.splitPercent })} · {formatDate(e.createdAt)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['A', 'B'] as const).map((v) => {
                const r = e.results.find((x) => x.variant === v);
                const cfg = v === 'A' ? e.variantA : e.variantB;
                return (
                  <div key={v} className="rounded-2xl bg-muted/60 p-3">
                    <div className="text-[13px] font-semibold">
                      {v === 'A'
                        ? t('admin.experiments.variantA')
                        : t('admin.experiments.variantB')}
                      {typeof cfg.priceRub === 'number' ? ` · ${cfg.priceRub} ₽` : ''}
                    </div>
                    <div className="mt-1 text-[22px] font-bold">{r?.conversionPct ?? 0}%</div>
                    <div className="text-[12px] text-muted-foreground">
                      {t('admin.experiments.paid')}: {r?.paid ?? 0} /{' '}
                      {t('admin.experiments.assigned')}: {r?.assigned ?? 0}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))
      )}

      <GlassSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? draft.name : t('admin.experiments.add')}
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
              disabled={!draft || draft.name.trim().length < 2}
              onClick={submit}
            >
              {t('common.save')}
            </GlassButton>
          </div>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <Field label={t('admin.experiments.name')}>
              <GlassInput
                value={draft.name}
                maxLength={80}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field label={t('admin.experiments.hypothesis')}>
              <GlassTextarea
                value={draft.hypothesis}
                maxLength={1000}
                className="min-h-16"
                onChange={(e) => set({ hypothesis: e.target.value })}
              />
            </Field>
            <VariantFields
              label={t('admin.experiments.variantA')}
              value={draft.variantA}
              onChange={(variantA) => set({ variantA })}
            />
            <VariantFields
              label={t('admin.experiments.variantB')}
              value={draft.variantB}
              onChange={(variantB) => set({ variantB })}
            />
            <Field label={t('admin.experiments.split', { pct: draft.splitPercent })}>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[draft.splitPercent]}
                onValueChange={(v) => set({ splitPercent: v[0] ?? 50 })}
                className="py-3"
              />
            </Field>
            <label className="flex items-center justify-between px-1 py-1 text-[15px]">
              {t('admin.experiments.active')}
              <Switch checked={draft.isActive} onCheckedChange={(isActive) => set({ isActive })} />
            </label>
          </div>
        ) : null}
      </GlassSheet>
    </Page>
  );
}
