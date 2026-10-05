import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useSalonProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ClientDetailView } from '@/features/cabinet/ClientsViews';

export default function SalonClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const profile = useSalonProfile();
  return (
    <Page title={t('master.clients.title')} back largeTitle={false}>
      {id ? (
        <ClientDetailView
          base="/api/salon"
          id={id}
          currency={profile.data?.currency ?? 'RUB'}
          timezone={profile.data?.timezone ?? 'Europe/Moscow'}
          canWrite={profile.data?.access.canWrite ?? true}
        />
      ) : null}
    </Page>
  );
}
