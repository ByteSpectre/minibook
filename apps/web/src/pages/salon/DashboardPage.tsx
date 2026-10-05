import { ExternalLink, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSalonProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { UserAvatar } from '@/components/domain/badges';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { DashboardView } from '@/features/cabinet/DashboardView';
import { useSalonTeam } from '@/features/salon/useSalonTeam';
import { useMe } from '@/store/auth';

export default function SalonDashboardPage() {
  const { t } = useTranslation();
  const me = useMe();
  const profile = useSalonProfile();
  const { team, isLoading } = useSalonTeam();
  const p = profile.data;
  return (
    <Page
      title={t('salon.dashboard.title')}
      subtitle={me?.salon?.name}
      actions={
        <>
          <GlassButton asChild size="icon" aria-label={t('master.menu.publicPage')}>
            <Link to={`/s/${me?.salon?.slug}`}>
              <ExternalLink />
            </Link>
          </GlassButton>
          <Link to="/salon/menu" aria-label={t('nav.profile')}>
            <UserAvatar src={me?.salon?.avatarUrl} name={me?.salon?.name} size={44} ring />
          </Link>
        </>
      }
    >
      {!isLoading && team.length === 0 ? (
        <GlassCard strong className="flex flex-col items-start gap-3 p-5">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted">
            <Users className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[17px] font-semibold">{t('salon.masters.empty')}</div>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {t('salon.dashboard.inviteFirst')}
            </p>
          </div>
          <GlassButton asChild variant="primary">
            <Link to="/salon/masters/invite">
              <UserPlus /> {t('salon.masters.invite')}
            </Link>
          </GlassButton>
        </GlassCard>
      ) : null}
      <DashboardView
        base="/api/salon"
        access={p?.access ?? me?.salon?.access}
        salonMasters={team}
        header={
          p ? (
            <Link to="/salon/masters">
              <GlassCard interactive className="flex items-center justify-between p-3.5">
                <span className="text-[14px] text-muted-foreground">
                  {t('salon.dashboard.mastersCount')}
                </span>
                <span className="text-[20px] font-semibold">{p.mastersCount}</span>
              </GlassCard>
            </Link>
          ) : null
        }
      />
    </Page>
  );
}
