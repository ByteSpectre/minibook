import {
  BookOpen,
  Building2,
  FlaskConical,
  Filter,
  LogOut,
  Scissors,
  Settings,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useResetOwnerProfile } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { ListGroup, ListRow, SectionTitle } from '@/components/ui/glass';
import { confirmDialog, telegramEnv } from '@/lib/telegram';
import { useAuth, useMe } from '@/store/auth';

export default function AdminMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const setSession = useAuth((s) => s.setSession);
  const logout = useAuth((s) => s.logout);
  const resetProfile = useResetOwnerProfile();
  const go = (path: string) => () => navigate(path);

  const reset = async (kind: 'client' | 'master' | 'salon', confirmKey: string, has: boolean) => {
    if (!has) {
      toast.message(t('admin.devReset.none'));
      return;
    }
    if (!(await confirmDialog(t(confirmKey)))) return;
    const res = await resetProfile.mutateAsync({ kind });
    setSession(res);
    toast.success(t('admin.devReset.done'));
  };

  return (
    <Page title={t('nav.more')}>
      <section>
        <SectionTitle>{t('admin.menu.growth')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Filter className="size-4" />}
            title={t('admin.menu.funnel')}
            onClick={go('/admin/funnel')}
          />
          <ListRow
            icon={<Ticket className="size-4" />}
            title={t('admin.menu.promo')}
            onClick={go('/admin/promo-codes')}
          />
          <ListRow
            icon={<FlaskConical className="size-4" />}
            title={t('admin.menu.experiments')}
            onClick={go('/admin/experiments')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('admin.menu.dictionaries')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<BookOpen className="size-4" />}
            title={`${t('admin.menu.categories')} · ${t('admin.menu.countries')} · ${t('admin.menu.cities')}`}
            onClick={go('/admin/dictionaries')}
          />
          <ListRow
            icon={<Settings className="size-4" />}
            title={t('admin.menu.settings')}
            onClick={go('/admin/settings')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('admin.devReset.title')}</SectionTitle>
        <p className="mb-2.5 px-1 text-[13px] text-muted-foreground">{t('admin.devReset.hint')}</p>
        <ListGroup>
          <ListRow
            icon={<Trash2 className="size-4" />}
            title={t('admin.devReset.client')}
            danger
            onClick={() =>
              void reset('client', 'admin.devReset.confirmClient', !!me?.clientOnboarded)
            }
          />
          <ListRow
            icon={<Trash2 className="size-4" />}
            title={t('admin.devReset.master')}
            danger
            onClick={() => void reset('master', 'admin.devReset.confirmMaster', !!me?.master)}
          />
          <ListRow
            icon={<Trash2 className="size-4" />}
            title={t('admin.devReset.salon')}
            danger
            onClick={() => void reset('salon', 'admin.devReset.confirmSalon', !!me?.salon)}
          />
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
            icon={<Scissors className="size-4" />}
            title={t('common.masterCabinet')}
            onClick={go(me?.master ? '/master' : '/onboarding/master')}
          />
          <ListRow
            icon={<Building2 className="size-4" />}
            title={t('common.salonCabinet')}
            onClick={go(me?.salon ? '/salon' : '/onboarding/salon')}
          />
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
    </Page>
  );
}
