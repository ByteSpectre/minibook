import { useTranslation } from 'react-i18next';
import { useSalonProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { ScheduleView } from '@/features/cabinet/ScheduleView';
import { useSalonTeam } from '@/features/salon/useSalonTeam';

export default function SalonSchedulePage() {
  const { t } = useTranslation();
  const profile = useSalonProfile();
  const { team } = useSalonTeam();
  if (!profile.data) return <PageLoader />;
  return (
    <Page title={t('master.schedule.title')}>
      <ScheduleView
        base="/api/salon"
        timezone={profile.data.timezone}
        currency={profile.data.currency}
        masters={team}
        canWrite={profile.data.access.canWrite}
      />
    </Page>
  );
}
