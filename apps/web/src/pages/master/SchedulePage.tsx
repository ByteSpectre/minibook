import { useTranslation } from 'react-i18next';
import { useMasterProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { ScheduleView } from '@/features/cabinet/ScheduleView';

export default function MasterSchedulePage() {
  const { t } = useTranslation();
  const profile = useMasterProfile();
  if (!profile.data) return <PageLoader />;
  return (
    <Page title={t('master.schedule.title')}>
      <ScheduleView
        base="/api/master"
        timezone={profile.data.timezone}
        currency={profile.data.currency}
        canWrite={profile.data.access.canWrite}
      />
    </Page>
  );
}
