import { PAYMENT_STATUSES } from '@nail-crm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminPayments } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { Chip, GlassButton, ListGroup, ListRow } from '@/components/ui/glass';
import { formatDateTime, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function AdminPaymentsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const list = useAdminPayments({ status, page });
  const pick = (s?: string) => {
    setStatus(s);
    setPage(1);
  };
  return (
    <Page title={t('admin.payments.title')}>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={!status} onClick={() => pick()}>
          {t('admin.payments.all')}
        </Chip>
        {PAYMENT_STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => pick(s)}>
            {t(`enums.paymentStatus.${s}`)}
          </Chip>
        ))}
      </div>
      {list.isLoading ? (
        <ListSkeleton count={5} />
      ) : list.isError || !list.data ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data.items.length ? (
        <EmptyState emoji="🧾" title={t('admin.payments.empty')} />
      ) : (
        <>
          <ListGroup>
            {list.data.items.map((p) => (
              <ListRow
                key={p.id}
                title={
                  <span className="flex items-center gap-2">
                    {formatPrice(p.amountRub)}
                    <span className="truncate text-[13px] font-normal text-muted-foreground">
                      {p.tenant?.name ?? '—'}
                    </span>
                  </span>
                }
                subtitle={`${formatDateTime(p.paidAt ?? p.createdAt)} · ${p.provider}${p.isAutoPayment ? ` · ${t('admin.payments.auto')}` : ''}`}
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
          <div className="flex items-center justify-between">
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
        </>
      )}
    </Page>
  );
}
