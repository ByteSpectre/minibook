import type { PlatformSettingsPatchInput } from '@nail-crm/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAdminSettings, usePatchAdminSettings } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, PageLoader } from '@/components/layout/states';
import { Switch } from '@/components/ui/switch';
import {
  Field,
  GlassCard,
  GlassInput,
  ListGroup,
  ListRow,
  SectionTitle,
} from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';

const FIELDS = ['masterPriceRub', 'salonPriceRub', 'trialDays', 'referralBonusDays'] as const;
type NumericField = (typeof FIELDS)[number];

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const settings = useAdminSettings();
  const patch = usePatchAdminSettings();
  const [v, setV] = useState<Record<NumericField, string> | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (s)
      setV({
        masterPriceRub: String(s.masterPriceRub),
        salonPriceRub: String(s.salonPriceRub),
        trialDays: String(s.trialDays),
        referralBonusDays: String(s.referralBonusDays),
      });
  }, [settings.data]);

  const save = (input: PlatformSettingsPatchInput) =>
    patch.mutate(input, { onSuccess: () => toast.success(t('admin.settings.saved')) });

  useMainButton({
    text: t('common.save'),
    visible: !!v,
    loading: patch.isPending,
    onClick: () =>
      v &&
      save(Object.fromEntries(FIELDS.map((k) => [k, Number(v[k])])) as PlatformSettingsPatchInput),
  });

  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} />;
  if (!settings.data || !v) return <PageLoader />;
  const s = settings.data;

  return (
    <Page title={t('admin.settings.title')} back bottomInset="button">
      <section>
        <SectionTitle>{t('admin.settings.prices')}</SectionTitle>
        <GlassCard className="grid grid-cols-2 gap-3">
          {FIELDS.map((k) => (
            <Field
              key={k}
              label={t(
                `admin.settings.${k === 'masterPriceRub' ? 'masterPrice' : k === 'salonPriceRub' ? 'salonPrice' : k}`,
              )}
            >
              <GlassInput
                inputMode="numeric"
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </Field>
          ))}
        </GlassCard>
        <p className="mt-2 px-1 text-[12px] text-muted-foreground">{t('admin.settings.envHint')}</p>
      </section>

      <ListGroup>
        <ListRow
          title={t('admin.settings.weeklyDigest')}
          right={
            <Switch
              checked={s.weeklyDigestEnabled}
              onCheckedChange={(weeklyDigestEnabled) => save({ weeklyDigestEnabled })}
            />
          }
        />
      </ListGroup>

      <section>
        <SectionTitle>{t('admin.settings.integrations')}</SectionTitle>
        <ListGroup>
          {[
            [
              t('admin.settings.provider'),
              s.paymentProvider === 'yookassa' ? 'YooKassa' : t('admin.settings.mock'),
              s.paymentProvider === 'yookassa',
            ],
            [
              t('admin.settings.bot'),
              s.botConnected ? t('admin.settings.connected') : t('admin.settings.mock'),
              s.botConnected,
            ],
            [
              t('admin.settings.maps'),
              s.yandexMapsConfigured ? t('admin.settings.connected') : t('admin.settings.mock'),
              s.yandexMapsConfigured,
            ],
          ].map(([label, value, ok]) => (
            <ListRow
              key={String(label)}
              title={label as string}
              right={
                <span
                  className={
                    ok
                      ? 'text-[14px] font-medium text-emerald-600'
                      : 'text-[14px] font-medium text-amber-600'
                  }
                >
                  {value as string}
                </span>
              }
            />
          ))}
        </ListGroup>
      </section>
    </Page>
  );
}
