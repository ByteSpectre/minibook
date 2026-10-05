import { useTranslation } from 'react-i18next';
import { useMasterProfile, useServices } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PromotionsView } from '@/features/cabinet/PromotionsView';

export default function MasterPromotionsPage() {
  const { t } = useTranslation();
  const profile = useMasterProfile();
  const services = useServices();
  return (
    <Page title={t('master.promotions.title')} back>
      <PromotionsView
        base="/api/master"
        timezone={profile.data?.timezone ?? 'Europe/Moscow'}
        services={(services.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
      />
    </Page>
  );
}
