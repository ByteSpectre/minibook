import { useTranslation } from 'react-i18next';
import { useMasterProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ClientsListView } from '@/features/cabinet/ClientsViews';

export default function MasterClientsPage() {
  const { t } = useTranslation();
  const profile = useMasterProfile();
  return (
    <Page title={t('master.clients.title')}>
      <ClientsListView
        base="/api/master"
        currency={profile.data?.currency ?? 'RUB'}
        canWrite={profile.data?.access.canWrite ?? true}
      />
    </Page>
  );
}
