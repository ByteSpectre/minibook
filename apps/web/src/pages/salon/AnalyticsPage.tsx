import { useTranslation } from 'react-i18next';
import { Page } from '@/components/layout/Page';
import { AnalyticsView } from '@/pages/master/AnalyticsPage';

export default function SalonAnalyticsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('master.analytics.title')} back>
      <AnalyticsView base="/api/salon" />
    </Page>
  );
}
