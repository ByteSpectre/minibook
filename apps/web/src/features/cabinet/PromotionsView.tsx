import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { PromotionDto } from '@nail-crm/shared';
import { usePromotionMutations, usePromotions, type CabinetBase } from '@/api/cabinetApi';
import { EmptyState, ListSkeleton } from '@/components/layout/states';
import {
  Chip,
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSheet,
  GlassTextarea,
} from '@/components/ui/glass';
import { Switch } from '@/components/ui/switch';
import { promotionConditions } from '@/features/public/promo';
import { todayIn } from '@/lib/format';
import { confirmDialog } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface Draft {
  id?: string;
  masterId?: string;
  title: string;
  description: string;
  serviceId: string | null;
  discountPct: string;
  validFrom: string;
  validTo: string;
  daysOfWeek: number[];
  timeFrom: string;
  timeTo: string;
  isActive: boolean;
}

export function PromotionsView({
  base,
  timezone,
  services,
  masters,
}: {
  base: CabinetBase;
  timezone: string;
  services: { id: string; name: string; masterId?: string }[];
  masters?: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const promotions = usePromotions(base);
  const { create, update, remove } = usePromotionMutations(base);
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = todayIn(timezone);
  const [now] = useState(Date.now);

  const open = (p?: PromotionDto) =>
    setDraft(
      p
        ? {
            id: p.id,
            title: p.title,
            description: p.description ?? '',
            serviceId: p.serviceId,
            discountPct: String(p.discountPct),
            validFrom: p.validFrom.slice(0, 10),
            validTo: p.validTo.slice(0, 10),
            daysOfWeek: p.daysOfWeek,
            timeFrom: p.timeFrom ?? '',
            timeTo: p.timeTo ?? '',
            isActive: p.isActive,
          }
        : {
            masterId: masters?.[0]?.id,
            title: '',
            description: '',
            serviceId: null,
            discountPct: '15',
            validFrom: today,
            validTo: today.slice(0, 8) + '28',
            daysOfWeek: [],
            timeFrom: '',
            timeTo: '',
            isActive: true,
          },
    );

  const save = () => {
    if (!draft) return;
    const input = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      serviceId: draft.serviceId,
      discountPct: Number(draft.discountPct),
      validFrom: draft.validFrom,
      validTo: draft.validTo,
      daysOfWeek: draft.daysOfWeek,
      timeFrom: draft.timeFrom || null,
      timeTo: draft.timeTo || null,
      isActive: draft.isActive,
    };
    const onSuccess = () => (toast.success(t('master.promotions.saved')), setDraft(null));
    if (draft.id) update.mutate({ id: draft.id, input }, { onSuccess });
    else
      create.mutate(
        { ...input, ...(draft.masterId ? { masterId: draft.masterId } : {}) },
        { onSuccess },
      );
  };

  const status = (p: PromotionDto) => {
    if (!p.isActive) return t('master.promotions.paused');
    if (new Date(p.validTo).getTime() < now) return t('master.promotions.ended');
    if (new Date(p.validFrom).getTime() > now) return t('master.promotions.scheduled');
    return t('master.promotions.active');
  };
  const draftServices = services.filter(
    (s) => !draft?.masterId || !s.masterId || s.masterId === draft.masterId,
  );

  return (
    <>
      <GlassButton variant="primary" block onClick={() => open()}>
        <Plus /> {t('master.promotions.add')}
      </GlassButton>
      {promotions.isLoading ? (
        <ListSkeleton />
      ) : !promotions.data?.length ? (
        <EmptyState
          emoji="🎁"
          title={t('master.promotions.empty')}
          text={t('master.promotions.emptyText')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {promotions.data.map((p) => (
            <GlassCard
              key={p.id}
              interactive
              onClick={() => open(p)}
              className={cn('flex cursor-pointer flex-col gap-2', !p.isActive && 'opacity-60')}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-semibold">{p.title}</span>
                <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[13px] font-bold text-white">
                  −{p.discountPct}%
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground">
                {p.serviceName ?? t('master.promotions.anyService')} ·{' '}
                {promotionConditions(t, p, timezone)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium">{status(p)}</span>
                {base === '/api/master' ? (
                  <GlassButton
                    size="sm"
                    variant="soft"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/master/broadcast?promotion=${p.id}`);
                    }}
                  >
                    <Megaphone /> {t('master.promotions.send')}
                  </GlassButton>
                ) : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <GlassSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('master.promotions.edit') : t('master.promotions.add')}
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
                      t('master.promotions.deleteConfirm'),
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
            {masters && !draft.id ? (
              <Field label={t('salon.promotions.master')}>
                <div className="flex flex-wrap gap-2">
                  {masters.map((m) => (
                    <Chip
                      key={m.id}
                      active={draft.masterId === m.id}
                      onClick={() => setDraft({ ...draft, masterId: m.id, serviceId: null })}
                    >
                      {m.name}
                    </Chip>
                  ))}
                </div>
              </Field>
            ) : null}
            <Field label={t('master.promotions.name')}>
              <GlassInput
                value={draft.title}
                placeholder={t('master.promotions.namePlaceholder')}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label={t('master.promotions.description')}>
              <GlassTextarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <Field label={t('master.promotions.service')}>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!draft.serviceId}
                  onClick={() => setDraft({ ...draft, serviceId: null })}
                >
                  {t('master.promotions.anyService')}
                </Chip>
                {draftServices.map((s) => (
                  <Chip
                    key={s.id}
                    active={draft.serviceId === s.id}
                    onClick={() => setDraft({ ...draft, serviceId: s.id })}
                  >
                    {s.name}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t('master.promotions.discount')}>
              <GlassInput
                inputMode="numeric"
                value={draft.discountPct}
                onChange={(e) =>
                  setDraft({ ...draft, discountPct: e.target.value.replace(/\D/g, '') })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('master.promotions.from')}>
                <GlassInput
                  type="date"
                  value={draft.validFrom}
                  onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })}
                />
              </Field>
              <Field label={t('master.promotions.to')}>
                <GlassInput
                  type="date"
                  value={draft.validTo}
                  onChange={(e) => setDraft({ ...draft, validTo: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t('master.promotions.days')}>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <Chip
                    key={d}
                    active={draft.daysOfWeek.includes(d)}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        daysOfWeek: draft.daysOfWeek.includes(d)
                          ? draft.daysOfWeek.filter((x) => x !== d)
                          : [...draft.daysOfWeek, d],
                      })
                    }
                  >
                    {t(`common.weekdaysShort.${String(d) as '1'}`)}
                  </Chip>
                ))}
              </div>
              {!draft.daysOfWeek.length ? (
                <span className="px-1 text-[12px] text-muted-foreground">
                  {t('master.promotions.allDays')}
                </span>
              ) : null}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('master.promotions.timeFrom')}>
                <GlassInput
                  type="time"
                  value={draft.timeFrom}
                  onChange={(e) => setDraft({ ...draft, timeFrom: e.target.value })}
                />
              </Field>
              <Field label={t('master.promotions.timeTo')}>
                <GlassInput
                  type="time"
                  value={draft.timeTo}
                  onChange={(e) => setDraft({ ...draft, timeTo: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center justify-between text-[15px]">
              {t('master.promotions.active')}
              <Switch
                checked={draft.isActive}
                onCheckedChange={(isActive) => setDraft({ ...draft, isActive })}
              />
            </label>
          </div>
        ) : null}
      </GlassSheet>
    </>
  );
}
