import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMasterProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { UserAvatar } from '@/components/domain/badges';
import { GlassButton } from '@/components/ui/glass';
import { DashboardView } from '@/features/cabinet/DashboardView';
import { useMe } from '@/store/auth';

export default function MasterDashboardPage() {
  const { t } = useTranslation();
  const me = useMe();
  const profile = useMasterProfile();
  return (
    <Page
      title={t('master.dashboard.title')}
      subtitle={me?.master?.name}
      actions={
        <>
          <GlassButton asChild size="icon" aria-label={t('master.menu.publicPage')}>
            <Link to={`/m/${me?.master?.slug}`}>
              <ExternalLink />
            </Link>
          </GlassButton>
          <Link to="/master/menu" aria-label={t('nav.profile')}>
            <UserAvatar src={me?.master?.avatarUrl} name={me?.master?.name} size={44} ring />
          </Link>
        </>
      }
    >
      <DashboardView base="/api/master" access={profile.data?.access ?? me?.master?.access} />
    </Page>
  );
}
