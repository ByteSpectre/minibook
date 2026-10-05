import {
  BookOpen,
  Building2,
  FlaskConical,
  Filter,
  LogOut,
  Scissors,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { ListGroup, ListRow, SectionTitle } from '@/components/ui/glass';
import { telegramEnv } from '@/lib/telegram';
import { useAuth, useMe } from '@/store/auth';

export default function AdminMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const logout = useAuth((s) => s.logout);
  const go = (path: string) => () => navigate(path);
  return (
    <Page title={t('admin.menu.title')}>
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
