import { Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BROADCAST_SEGMENTS,
  type BroadcastPreviewInput,
  type BroadcastSegment,
} from '@nail-crm/shared';
import {
  useBroadcastPreview,
  useBroadcasts,
  useClients,
  usePromotions,
  useSendBroadcast,
  type CabinetBase,
} from '@/api/cabinetApi';
import { PhotoUploader } from '@/components/domain/PhotoUploader';
import {
  Chip,
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassTextarea,
  SectionTitle,
} from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';
import { formatDateTime } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export function BroadcastView({
  base,
  services,
  masters,
}: {
  base: CabinetBase;
  services: { id: string; name: string; masterId?: string }[];
  masters?: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [masterId, setMasterId] = useState<string | undefined>(masters?.[0]?.id);
  const [segment, setSegment] = useState<BroadcastSegment>('all');
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | undefined>();
  const [ageFrom, setAgeFrom] = useState('');
  const [ageTo, setAgeTo] = useState('');
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string[]>([]);
  const [promotionId, setPromotionId] = useState<string | undefined>(
    params.get('promotion') ?? undefined,
  );
  const history = useBroadcasts(base);
  const promotions = usePromotions(base);
  const clients = useClients(base, { page: 1 });
  const send = useSendBroadcast(base);

  const previewInput = useMemo<(BroadcastPreviewInput & { masterId?: string }) | null>(() => {
    if (masters && !masterId) return null;
    return {
      segment,
      params: {
        ...(segment === 'service' && serviceId ? { serviceId } : {}),
        ...(segment === 'demographic'
          ? {
              gender,
              ageFrom: ageFrom ? Number(ageFrom) : undefined,
              ageTo: ageTo ? Number(ageTo) : undefined,
            }
          : {}),
        ...(segment === 'manual' ? { clientIds } : {}),
      },
      ...(masterId ? { masterId } : {}),
    };
  }, [segment, serviceId, gender, ageFrom, ageTo, clientIds, masterId, masters]);
  const preview = useBroadcastPreview(base, previewInput);
  const canSend =
    !!previewInput &&
    !!text.trim() &&
    (preview.data?.canSendToday ?? true) &&
    (preview.data?.reachable ?? 0) > 0;

  const submit = () => {
    if (!previewInput) return;
    send.mutate(
      { ...previewInput, text: text.trim(), imageUrl: image[0] ?? null, promotionId },
      {
        onSuccess: () => {
          haptic.notify('success');
          toast.success(t('master.broadcast.sent'));
          setText('');
          setImage([]);
        },
      },
    );
  };
  useMainButton({
    text: t('master.broadcast.send'),
    enabled: canSend,
    loading: send.isPending,
    onClick: submit,
  });

  const clientOptions = (clients.data?.items ?? []).filter(
    (c) => c.hasTelegram && (!masterId || c.masterId === masterId),
  );
  const promoOptions = (promotions.data ?? []).filter((p) => p.isActive);

  return (
    <>
      <GlassCard className="text-[13px] text-muted-foreground">
        ℹ️ {t('master.broadcast.rules')}
      </GlassCard>
      {masters ? (
        <Field label={t('salon.promotions.master')}>
          <div className="flex flex-wrap gap-2">
            {masters.map((m) => (
              <Chip key={m.id} active={masterId === m.id} onClick={() => setMasterId(m.id)}>
                {m.name}
              </Chip>
            ))}
          </div>
        </Field>
      ) : null}
      <Field label={t('master.broadcast.segment')}>
        <div className="flex flex-wrap gap-2">
          {BROADCAST_SEGMENTS.map((s) => (
            <Chip key={s} active={segment === s} onClick={() => setSegment(s)}>
              {t(`enums.segment.${s}`)}
            </Chip>
          ))}
        </div>
      </Field>
      {segment === 'service' ? (
        <Field label={t('master.broadcast.service')}>
          <div className="flex flex-wrap gap-2">
            {services
              .filter((s) => !masterId || !s.masterId || s.masterId === masterId)
              .map((s) => (
                <Chip key={s.id} active={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                  {s.name}
                </Chip>
              ))}
          </div>
        </Field>
      ) : null}
      {segment === 'demographic' ? (
        <GlassCard className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Chip active={!gender} onClick={() => setGender(undefined)}>
              {t('master.broadcast.anyGender')}
            </Chip>
            {(['FEMALE', 'MALE'] as const).map((g) => (
              <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
                {t(`enums.gender.${g}`)}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GlassInput
              inputMode="numeric"
              placeholder={t('master.broadcast.ageFrom')}
              value={ageFrom}
              onChange={(e) => setAgeFrom(e.target.value.replace(/\D/g, ''))}
            />
            <GlassInput
              inputMode="numeric"
              placeholder={t('master.broadcast.ageTo')}
              value={ageTo}
              onChange={(e) => setAgeTo(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </GlassCard>
      ) : null}
      {segment === 'manual' ? (
        <Field
          label={`${t('master.broadcast.pickClients')} · ${t('master.broadcast.selected', { count: clientIds.length })}`}
        >
          <GlassCard className="flex max-h-60 flex-col gap-1 overflow-y-auto p-2">
            {clientOptions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setClientIds((ids) =>
                    ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                  )
                }
                className={cn(
                  'flex min-h-11 items-center rounded-xl px-3 text-left text-[14px]',
                  clientIds.includes(c.id) ? 'bg-foreground text-background' : 'active:bg-muted',
                )}
              >
                {c.firstName ?? '—'}
              </button>
            ))}
          </GlassCard>
        </Field>
      ) : null}

      <GlassCard className="flex items-center justify-between text-[14px]">
        <span>{t('master.broadcast.total', { count: preview.data?.total ?? 0 })}</span>
        <span className="font-semibold">
          {t('master.broadcast.reachable', { count: preview.data?.reachable ?? 0 })}
        </span>
      </GlassCard>
      {preview.data && !preview.data.canSendToday && preview.data.nextAvailableAt ? (
        <GlassCard className="bg-amber-400/15 text-[14px]">
          ⏳ {t('master.broadcast.limit', { date: formatDateTime(preview.data.nextAvailableAt) })}
        </GlassCard>
      ) : null}

      <Field label={t('master.broadcast.text')}>
        <GlassTextarea
          value={text}
          maxLength={3500}
          rows={5}
          placeholder={t('master.broadcast.textPlaceholder')}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Field label={t('master.broadcast.image')}>
        <PhotoUploader
          value={image}
          onChange={setImage}
          max={1}
          kind="broadcast"
          endpoint={base === '/api/master' ? '/api/master/upload' : '/api/salon/upload'}
        />
      </Field>
      {promoOptions.length ? (
        <Field label={t('master.broadcast.promotion')}>
          <div className="flex flex-wrap gap-2">
            <Chip active={!promotionId} onClick={() => setPromotionId(undefined)}>
              {t('master.broadcast.noPromotion')}
            </Chip>
            {promoOptions.map((p) => (
              <Chip key={p.id} active={promotionId === p.id} onClick={() => setPromotionId(p.id)}>
                {p.title} · −{p.discountPct}%
              </Chip>
            ))}
          </div>
        </Field>
      ) : null}

      <section>
        <SectionTitle>{t('master.broadcast.history')}</SectionTitle>
        {history.data?.length ? (
          <GlassCard className="flex flex-col divide-y divide-border p-0">
            {history.data.map((b) => (
              <div key={b.id} className="flex flex-col gap-0.5 px-4 py-3">
                <div className="flex justify-between text-[12px] text-muted-foreground">
                  <span>
                    {t(`enums.segment.${b.segment}`)} ·{' '}
                    {t('master.broadcast.recipients', { count: b.recipients })}
                  </span>
                  <span>{formatDateTime(b.sentAt)}</span>
                </div>
                <p className="line-clamp-2 text-[14px]">{b.text}</p>
              </div>
            ))}
          </GlassCard>
        ) : (
          <p className="px-1 text-[14px] text-muted-foreground">{t('master.broadcast.empty')}</p>
        )}
      </section>
      <GlassButton
        variant="primary"
        size="lg"
        block
        disabled={!canSend}
        loading={send.isPending}
        onClick={submit}
        className="hidden"
      >
        <Send /> {t('master.broadcast.send')}
      </GlassButton>
    </>
  );
}
