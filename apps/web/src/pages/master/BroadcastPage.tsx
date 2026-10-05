import { useTranslation } from 'react-i18next';
import { useServices } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { BroadcastView } from '@/features/cabinet/BroadcastView';

export default function MasterBroadcastPage() {
  const { t } = useTranslation();
  const services = useServices();
  return (
    <Page title={t('master.broadcast.title')} back bottomInset="button">
      <BroadcastView
        base="/api/master"
        services={(services.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
      />
    </Page>
  );
}
