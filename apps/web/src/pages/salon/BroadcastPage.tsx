import { useTranslation } from 'react-i18next';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { BroadcastView } from '@/features/cabinet/BroadcastView';
import { useSalonTeam } from '@/features/salon/useSalonTeam';

export default function SalonBroadcastPage() {
  const { t } = useTranslation();
  const { team, flatServices, isLoading } = useSalonTeam();
  if (isLoading) return <PageLoader />;
  return (
    <Page title={t('master.broadcast.title')} back bottomInset="button">
      <BroadcastView base="/api/salon" services={flatServices} masters={team} />
    </Page>
  );
}
