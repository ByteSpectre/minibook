import { useTranslation } from 'react-i18next';
import { useSalonProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PromotionsView } from '@/features/cabinet/PromotionsView';
import { useSalonTeam } from '@/features/salon/useSalonTeam';

export default function SalonPromotionsPage() {
  const { t } = useTranslation();
  const profile = useSalonProfile();
  const { team, flatServices } = useSalonTeam();
  return (
    <Page title={t('master.promotions.title')} back>
      <PromotionsView
        base="/api/salon"
        timezone={profile.data?.timezone ?? 'Europe/Moscow'}
        services={flatServices}
        masters={team}
      />
    </Page>
  );
}
