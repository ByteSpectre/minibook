import {
  BarChart3,
  Ban,
  Building2,
  CreditCard,
  Download,
  ExternalLink,
  Gift,
  LogOut,
  Megaphone,
  Palette,
  Percent,
  QrCode,
  Scissors,
  Settings,
  Shield,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { exportLink, useMasterProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton } from '@/components/layout/states';
import { SubStatusBadge, UserAvatar } from '@/components/domain/badges';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GlassCard, ListGroup, ListRow, SectionTitle } from '@/components/ui/glass';
import { download, telegramEnv } from '@/lib/telegram';
import { useAuth, useMe } from '@/store/auth';

export default function MasterMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const logout = useAuth((s) => s.logout);
  const profile = useMasterProfile();
  const [leave, setLeave] = useState(false);
  const p = profile.data;
  const go = (path: string) => () => navigate(path);
  const doExport = async (entity: 'clients' | 'appointments') => {
    const { url } = await exportLink(entity);
    await download(url, `${p?.slug ?? 'export'}-${entity}.csv`);
  };

  return (
    <Page title={t('master.menu.title')}>
      {p ? (
        <GlassCard className="flex items-center gap-4">
          <UserAvatar src={p.avatarUrl} name={p.name} size={60} ring />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] font-semibold">{p.name}</div>
            <div className="truncate text-[13px] text-muted-foreground">/m/{p.slug}</div>
            <div className="mt-1 flex items-center gap-2">
              <SubStatusBadge status={p.access.status} />
              {p.salon ? (
                <span className="truncate text-[12px] text-muted-foreground">
                  {t('master.menu.salonMember', { name: p.salon.name })}
                </span>
              ) : null}
            </div>
          </div>
        </GlassCard>
      ) : (
        <CardSkeleton />
      )}

      <ListGroup>
        <ListRow
          icon={<ExternalLink className="size-4" />}
          title={t('master.menu.publicPage')}
          onClick={go(`/m/${p?.slug ?? me?.master?.slug}`)}
        />
      </ListGroup>

      <section>
        <SectionTitle>{t('master.menu.sectionProfile')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<UserRound className="size-4" />}
            title={t('master.menu.profileSettings')}
            onClick={go('/master/profile')}
          />
          <ListRow
            icon={<Palette className="size-4" />}
            title={t('master.menu.theme')}
            onClick={go('/master/theme')}
          />
          <ListRow
            icon={<QrCode className="size-4" />}
            title={t('master.menu.share')}
            onClick={go('/master/share')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('master.menu.sectionWork')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Scissors className="size-4" />}
            title={t('master.menu.services')}
            onClick={go('/master/services')}
          />
          <ListRow
            icon={<Star className="size-4" />}
            title={t('master.menu.reviews')}
            onClick={go('/master/reviews')}
          />
          <ListRow
            icon={<BarChart3 className="size-4" />}
            title={t('master.menu.analytics')}
            onClick={go('/master/analytics')}
          />
          <ListRow
            icon={<Settings className="size-4" />}
            title={t('master.menu.settings')}
            onClick={go('/master/settings')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('master.menu.sectionMarketing')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Gift className="size-4" />}
            title={t('master.menu.loyalty')}
            onClick={go('/master/loyalty')}
          />
          <ListRow
            icon={<Percent className="size-4" />}
            title={t('master.menu.promotions')}
            onClick={go('/master/promotions')}
          />
          <ListRow
            icon={<Megaphone className="size-4" />}
            title={t('master.menu.broadcast')}
            onClick={go('/master/broadcast')}
          />
          <ListRow
            icon={<Ban className="size-4" />}
            title={t('master.menu.blacklist')}
            onClick={go('/master/blacklist')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('master.menu.sectionAccount')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<CreditCard className="size-4" />}
            title={t('master.menu.subscription')}
            onClick={go('/master/subscription')}
          />
          <ListRow
            icon={<Download className="size-4" />}
            title={`${t('master.menu.export')} · ${t('master.menu.exportClients')}`}
            onClick={() => void doExport('clients')}
          />
          <ListRow
            icon={<Download className="size-4" />}
            title={`${t('master.menu.export')} · ${t('master.menu.exportAppointments')}`}
            onClick={() => void doExport('appointments')}
          />
          {p?.salon ? (
            <ListRow
              icon={<Building2 className="size-4" />}
              title={t('master.menu.leaveSalon')}
              danger
              onClick={() => setLeave(true)}
            />
          ) : null}
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('common.switchRole')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Users className="size-4" />}
            title={t('common.clientCabinet')}
            onClick={go(me?.clientOnboarded ? '/client' : '/onboarding/client')}
          />
          <ListRow
            icon={<Building2 className="size-4" />}
            title={t('common.salonCabinet')}
            onClick={go(me?.salon ? '/salon' : '/onboarding/salon')}
          />
          {me?.isOwner ? (
            <ListRow
              icon={<Shield className="size-4" />}
              title={t('common.platformAdmin')}
              onClick={go('/admin')}
            />
          ) : null}
          {!telegramEnv().inTelegram ? (
            <ListRow
              icon={<LogOut className="size-4" />}
              title={t('dev.logout')}
              danger
              onClick={logout}
            />
          ) : null}
        </ListGroup>
      </section>

      <AlertDialog open={leave} onOpenChange={setLeave}>
        <AlertDialogContent className="glass-strong rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('master.menu.leaveSalon')}?</AlertDialogTitle>
            <AlertDialogDescription>{t('master.menu.leaveSalonConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-2xl">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-2xl bg-destructive text-white"
              onClick={async () => {
                await api.post('/api/master/salon/leave');
                toast.success(t('master.menu.leftSalon'));
                void profile.refetch();
              }}
            >
              {t('master.menu.leaveSalon')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
