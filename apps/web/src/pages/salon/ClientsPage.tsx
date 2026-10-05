import { useTranslation } from 'react-i18next';
import { useSalonProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ClientsListView } from '@/features/cabinet/ClientsViews';

export default function SalonClientsPage() {
  const { t } = useTranslation();
  const profile = useSalonProfile();
  return (
    <Page title={t('master.clients.title')}>
      <ClientsListView
        base="/api/salon"
        currency={profile.data?.currency ?? 'RUB'}
        canWrite={profile.data?.access.canWrite ?? true}
      />
    </Page>
  );
}
