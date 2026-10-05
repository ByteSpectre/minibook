import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LOYALTY_TYPES, type LoyaltyRuleDto, type LoyaltyType } from '@nail-crm/shared';
import { useLoyaltyMutations, useLoyaltyRules } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ListSkeleton } from '@/components/layout/states';
import { LoyaltyRuleCard } from '@/components/domain/loyalty';
import { Chip, Field, GlassButton, GlassCard, GlassInput, GlassSheet } from '@/components/ui/glass';
import { confirmDialog } from '@/lib/telegram';

interface Draft {
  id?: string;
  type: LoyaltyType;
  threshold: string;
  discountPct: string;
}

const NEEDS_THRESHOLD: LoyaltyType[] = ['EVERY_N_VISIT', 'CUMULATIVE', 'BIRTHDAY'];

export default function LoyaltyPage() {
  const { t } = useTranslation();
  const rules = useLoyaltyRules();
  const { create, update, remove } = useLoyaltyMutations();
  const [draft, setDraft] = useState<Draft | null>(null);

  const open = (r?: LoyaltyRuleDto) =>
    setDraft(
      r
        ? {
            id: r.id,
            type: r.type,
            threshold: String(r.threshold ?? ''),
            discountPct: String(r.discountPct),
          }
        : { type: 'EVERY_N_VISIT', threshold: '5', discountPct: '20' },
    );

  const save = () => {
    if (!draft) return;
    const threshold = NEEDS_THRESHOLD.includes(draft.type) ? Number(draft.threshold) || null : null;
    const discountPct = Number(draft.discountPct);
    const onSuccess = () => (toast.success(t('master.loyalty.saved')), setDraft(null));
    if (draft.id) update.mutate({ id: draft.id, input: { threshold, discountPct } }, { onSuccess });
    else create.mutate({ type: draft.type, threshold, discountPct }, { onSuccess });
  };

  return (
    <Page
      title={t('master.loyalty.title')}
      back
      actions={
        <GlassButton
          size="icon"
          variant="primary"
          aria-label={t('master.loyalty.add')}
          onClick={() => open()}
        >
          <Plus />
        </GlassButton>
      }
    >
      <GlassCard className="text-[14px] text-muted-foreground">
        💡 {t('master.loyalty.hint')}
      </GlassCard>
      {rules.isLoading ? (
        <ListSkeleton />
      ) : !rules.data?.length ? (
        <EmptyState
          emoji="💝"
          title={t('master.loyalty.empty')}
          text={t('master.loyalty.emptyText')}
          action={
            <GlassButton variant="primary" onClick={() => open()}>
              {t('master.loyalty.add')}
            </GlassButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rules.data.map((r) => (
            <LoyaltyRuleCard
              key={r.id}
              rule={r}
              onEdit={() => open(r)}
              onToggle={(isActive) => update.mutate({ id: r.id, input: { isActive } })}
            />
          ))}
        </div>
      )}
      <GlassSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t(`enums.loyaltyType.${draft.type}`) : t('master.loyalty.add')}
        footer={
          <div className="flex gap-2">
            {draft?.id ? (
              <GlassButton
                variant="destructive"
                size="lg"
                aria-label={t('common.delete')}
                onClick={async () => {
                  if (
                    draft.id &&
                    (await confirmDialog(
                      t('master.loyalty.deleteConfirm'),
                      t('common.delete'),
                      t('common.cancel'),
                    ))
                  ) {
                    remove.mutate(draft.id, { onSuccess: () => setDraft(null) });
                  }
                }}
              >
                <Trash2 />
              </GlassButton>
            ) : null}
            <GlassButton
              variant="primary"
              size="lg"
              className="flex-1"
              loading={create.isPending || update.isPending}
              onClick={save}
            >
              {t('common.save')}
            </GlassButton>
          </div>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            {!draft.id ? (
              <Field label={t('master.loyalty.type')}>
                <div className="flex flex-wrap gap-2">
                  {LOYALTY_TYPES.map((type) => (
                    <Chip
                      key={type}
                      active={draft.type === type}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          type,
                          threshold: type === 'BIRTHDAY' ? '7' : type === 'CUMULATIVE' ? '10' : '5',
                        })
                      }
                    >
                      {t(`enums.loyaltyType.${type}`)}
                    </Chip>
                  ))}
                </div>
              </Field>
            ) : null}
            {NEEDS_THRESHOLD.includes(draft.type) ? (
              <Field label={t(`master.loyalty.threshold.${draft.type}`)}>
                <GlassInput
                  inputMode="numeric"
                  value={draft.threshold}
                  onChange={(e) =>
                    setDraft({ ...draft, threshold: e.target.value.replace(/\D/g, '') })
                  }
                />
              </Field>
            ) : null}
            <Field label={t('master.loyalty.discount')}>
              <GlassInput
                inputMode="numeric"
                value={draft.discountPct}
                onChange={(e) =>
                  setDraft({ ...draft, discountPct: e.target.value.replace(/\D/g, '') })
                }
              />
            </Field>
            <p className="text-[14px] text-muted-foreground">
              {t(`enums.loyaltyDescription.${draft.type}`, {
                n: draft.threshold || '…',
                pct: draft.discountPct || '…',
              })}
            </p>
          </div>
        ) : null}
      </GlassSheet>
    </Page>
  );
}
