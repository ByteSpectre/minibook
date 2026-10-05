import { CreditCard, FlaskConical, Gift, Receipt, Repeat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  usePayments,
  useSubscription,
  useSubscriptionMutations,
  type CabinetBase,
} from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton, ErrorState } from '@/components/layout/states';
import { SubStatusBadge } from '@/components/domain/badges';
import { Switch } from '@/components/ui/switch';
import {
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  ListGroup,
  ListRow,
  SectionTitle,
} from '@/components/ui/glass';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { confirmDialog, haptic, openExternal } from '@/lib/telegram';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

export function SubscriptionView({ base }: { base: CabinetBase }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sub = useSubscription(base);
  const payments = usePayments(base);
  const m = useSubscriptionMutations(base);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [promo, setPromo] = useState('');

  useEffect(() => {
    const paid = params.get('paid');
    if (paid === null) return;
    if (paid === '1') {
      haptic.notify('success');
      toast.success(t('master.subscription.paid'));
      void refreshMe();
    }
    void sub.refetch();
    void payments.refetch();
    setParams({}, { replace: true });
  }, [params, setParams, sub, payments, refreshMe, t]);

  if (sub.isError) return <ErrorState onRetry={() => void sub.refetch()} />;
  const s = sub.data;

  const pay = async () => {
    if (!s) return;
    const res = await m.pay.mutateAsync(s.autoRenewEnabled);
    if (res.provider === 'mock') {
      navigate(`/pay/mock/${res.paymentId}`);
      return;
    }
    toast(t('master.subscription.redirect'));
    openExternal(res.confirmationUrl);
  };

  const cancel = async () => {
    if (!s) return;
    const ok = await confirmDialog(
      t('master.subscription.cancelText', {
        date: s.access.endsAt ? formatDate(s.access.endsAt) : '—',
      }),
      t('master.subscription.cancel'),
      t('common.back'),
    );
    if (!ok) return;
    await m.cancel.mutateAsync();
    toast.success(t('master.subscription.cancelled'));
    void refreshMe();
  };

  const applyPromo = async () => {
    const res = await m.promo.mutateAsync(promo.trim());
    setPromo('');
    haptic.notify('success');
    toast.success(
      `${t('master.subscription.promoApplied')}: ${
        res.type === 'FREE_DAYS'
          ? t('master.subscription.promoDays', { days: res.value })
          : t('master.subscription.promoDiscount', { pct: res.value })
      }`,
    );
    void refreshMe();
  };

  const covered = s?.coveredBySalon;
  const canPay = s && !covered && s.access.status !== 'BANNED';

  return (
    <Page title={t('master.subscription.title')} back bottomInset="none">
      {!s ? (
        <CardSkeleton lines={4} />
      ) : (
        <GlassCard strong className="relative flex flex-col gap-4 overflow-hidden p-5">
          <div
            aria-hidden
            className="bg-brand pointer-events-none absolute -top-16 -right-16 size-44 rounded-full opacity-25 blur-3xl"
          />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t('master.subscription.status')}
            </span>
            <SubStatusBadge status={s.access.status} />
          </div>
          {covered ? (
            <p className="text-[16px] font-medium">
              {t('master.subscription.covered', { name: covered.name })}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12px] text-muted-foreground">
                  {t('master.subscription.until')}
                </div>
                <div className="text-[17px] font-semibold">
                  {s.access.endsAt ? formatDate(s.access.endsAt) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-muted-foreground">
                  {t('master.subscription.daysLeft')}
                </div>
                <div className="text-[17px] font-semibold">
                  {t('common.days', { count: s.access.daysLeft })}
                </div>
              </div>
            </div>
          )}
          {!covered ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] text-muted-foreground">
                  {t('master.subscription.price')}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-bold tracking-tight">
                    {formatPrice(s.priceRub)}
                  </span>
                  {s.priceRub < s.basePriceRub ? (
                    <span className="text-[15px] text-muted-foreground line-through">
                      {formatPrice(s.basePriceRub)}
                    </span>
                  ) : null}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {t('master.subscription.perPeriod')}
                </div>
              </div>
              {s.pendingDiscountPct ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                  −{s.pendingDiscountPct}%
                </span>
              ) : null}
            </div>
          ) : null}
          {s.paywall.title ? (
            <div className="rounded-2xl bg-muted/60 p-3">
              <div className="text-[15px] font-semibold">{s.paywall.title}</div>
              {s.paywall.text ? (
                <p className="mt-0.5 text-[13px] text-muted-foreground">{s.paywall.text}</p>
              ) : null}
            </div>
          ) : null}
          {canPay ? (
            <GlassButton
              variant="primary"
              size="lg"
              block
              loading={m.pay.isPending}
              onClick={() => void pay()}
            >
              <CreditCard />
              {t('master.subscription.pay', { price: formatPrice(s.priceRub) })}
            </GlassButton>
          ) : null}
          {!covered ? (
            <p className="text-center text-[12px] text-muted-foreground">
              {t('master.subscription.methods')}
            </p>
          ) : null}
        </GlassCard>
      )}

      {s?.provider === 'mock' && !covered ? (
        <GlassCard className="flex items-start gap-3 p-3.5 text-[13px] text-muted-foreground">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber-500" />
          {t('master.subscription.mockMode')}
        </GlassCard>
      ) : null}

      {s && !covered ? (
        <ListGroup>
          <ListRow
            icon={<Repeat className="size-4" />}
            title={t('master.subscription.autoRenew')}
            subtitle={
              s.hasSavedPaymentMethod
                ? t('master.subscription.autoRenewHint')
                : t('master.subscription.noMethod')
            }
            right={
              <Switch
                checked={s.autoRenewEnabled}
                disabled={m.autoRenew.isPending}
                onCheckedChange={(v) => m.autoRenew.mutate(v)}
              />
            }
          />
          {s.access.status === 'ACTIVE' ? (
            <ListRow
              icon={<CreditCard className="size-4" />}
              title={t('master.subscription.cancel')}
              danger
              onClick={() => void cancel()}
            />
          ) : null}
        </ListGroup>
      ) : null}

      {s && !covered ? (
        <section>
          <SectionTitle>{t('master.subscription.promo')}</SectionTitle>
          <GlassCard className="flex items-end gap-2">
            <Field className="flex-1">
              <GlassInput
                value={promo}
                autoCapitalize="characters"
                placeholder={t('master.subscription.promoPlaceholder')}
                onChange={(e) => setPromo(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && promo.length >= 3 && void applyPromo()}
              />
            </Field>
            <GlassButton
              variant="solid"
              className="h-12"
              disabled={promo.length < 3}
              loading={m.promo.isPending}
              onClick={() => void applyPromo()}
            >
              <Gift />
              {t('common.apply')}
            </GlassButton>
          </GlassCard>
        </section>
      ) : null}

      <section>
        <SectionTitle>{t('master.subscription.payments')}</SectionTitle>
        {payments.isLoading ? (
          <CardSkeleton />
        ) : !payments.data?.length ? (
          <GlassCard className="py-6 text-center text-[14px] text-muted-foreground">
            {t('master.subscription.noPayments')}
          </GlassCard>
        ) : (
          <ListGroup>
            {payments.data.map((p) => (
              <ListRow
                key={p.id}
                icon={<Receipt className="size-4" />}
                title={formatPrice(p.amountRub)}
                subtitle={`${formatDateTime(p.paidAt ?? p.createdAt)}${p.isAutoPayment ? ` · ${t('master.subscription.autoPayment')}` : ''}`}
                right={
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium',
                      p.status === 'succeeded'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t(`enums.paymentStatus.${p.status}`)}
                  </span>
                }
              />
            ))}
          </ListGroup>
        )}
        <p className="mt-2 px-1 text-[12px] text-muted-foreground">
          {t('master.subscription.receipts')}
        </p>
      </section>
    </Page>
  );
}
