import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useMasterProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ClientDetailView } from '@/features/cabinet/ClientsViews';

export default function MasterClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const profile = useMasterProfile();
  return (
    <Page title={t('master.clients.title')} back largeTitle={false}>
      {id ? (
        <ClientDetailView
          base="/api/master"
          id={id}
          currency={profile.data?.currency ?? 'RUB'}
          timezone={profile.data?.timezone ?? 'Europe/Moscow'}
          canWrite={profile.data?.access.canWrite ?? true}
        />
      ) : null}
    </Page>
  );
}
