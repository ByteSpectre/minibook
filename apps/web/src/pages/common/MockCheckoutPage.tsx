import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { PaymentDto } from '@nail-crm/shared';
import { api } from '@/api/client';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';

type MockPayment = PaymentDto & { kind: 'master' | 'salon'; tenantName: string };

/** Local stand-in for the YooKassa checkout page (used when shop credentials are not set). */
export default function MockCheckoutPage() {
  const { t } = useTranslation();
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const payment = useQuery({
    queryKey: ['mock-payment', paymentId],
    queryFn: () => api.get<MockPayment>(`/api/dev/mock-payments/${paymentId}`),
  });
  const complete = useMutation({
    mutationFn: (outcome: 'succeed' | 'cancel') =>
      api.post<MockPayment>(`/api/dev/mock-payments/${paymentId}/${outcome}`),
    onSuccess: (p) => {
      haptic.notify(p.status === 'succeeded' ? 'success' : 'warning');
      void qc.invalidateQueries();
      void payment.refetch();
    },
  });
  if (payment.isLoading || !payment.data) return <PageLoader />;
  const p = payment.data;
  const done = p.status === 'succeeded' || p.status === 'canceled';
  return (
    <Page
      back
      bottomInset="none"
      title={t('checkout.title')}
      subtitle={t('checkout.subtitle')}
      largeTitle={false}
    >
      <GlassCard strong className="mt-4 flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-500" /> YooKassa · sandbox
        </div>
        <div>
          <div className="text-[13px] text-muted-foreground">{t('checkout.amount')}</div>
          <div className="text-[34px] font-bold tracking-tight">{formatPrice(p.amountRub)}</div>
          <div className="text-[14px] text-muted-foreground">{p.description ?? p.tenantName}</div>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2
              className={
                p.status === 'succeeded'
                  ? 'size-14 text-emerald-500'
                  : 'size-14 text-muted-foreground'
              }
            />
            <div className="text-[18px] font-semibold">
              {p.status === 'succeeded' ? t('checkout.success') : t('checkout.canceled')}
            </div>
            <GlassButton
              variant="primary"
              block
              className="mt-2"
              onClick={() =>
                navigate(`/${p.kind}/subscription?paid=${p.status === 'succeeded' ? 1 : 0}`, {
                  replace: true,
                })
              }
            >
              {t('checkout.back')}
            </GlassButton>
          </div>
        ) : (
          <>
            <div className="glass flex items-center gap-3 rounded-2xl p-3">
              <CreditCard className="size-5" />
              <span className="text-[15px]">{t('checkout.card')}</span>
            </div>
            <GlassButton
              variant="primary"
              size="lg"
              block
              loading={complete.isPending && complete.variables === 'succeed'}
              onClick={() => complete.mutate('succeed')}
            >
              {t('checkout.pay')} {formatPrice(p.amountRub)}
            </GlassButton>
            <GlassButton
              block
              loading={complete.isPending && complete.variables === 'cancel'}
              onClick={() => complete.mutate('cancel')}
            >
              {t('checkout.cancel')}
            </GlassButton>
          </>
        )}
      </GlassCard>
    </Page>
  );
}
