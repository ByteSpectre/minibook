import {
  BarChart3,
  CreditCard,
  ExternalLink,
  LogOut,
  Megaphone,
  Palette,
  Percent,
  QrCode,
  Scissors,
  Shield,
  Star,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSalonProfile } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton } from '@/components/layout/states';
import { SubStatusBadge, UserAvatar } from '@/components/domain/badges';
import { QRCodeCard } from '@/components/domain/media';
import { GlassCard, GlassSheet, ListGroup, ListRow, SectionTitle } from '@/components/ui/glass';
import { telegramEnv } from '@/lib/telegram';
import { useAuth, useMe } from '@/store/auth';

export default function SalonMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const logout = useAuth((s) => s.logout);
  const profile = useSalonProfile();
  const [qr, setQr] = useState(false);
  const p = profile.data;
  const go = (path: string) => () => navigate(path);

  return (
    <Page title={t('master.menu.title')}>
      {p ? (
        <GlassCard className="flex items-center gap-4">
          <UserAvatar src={p.avatarUrl} name={p.name} size={60} ring />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] font-semibold">{p.name}</div>
            <div className="truncate text-[13px] text-muted-foreground">/s/{p.slug}</div>
            <div className="mt-1 flex items-center gap-2">
              <SubStatusBadge status={p.access.status} />
              <span className="text-[12px] text-muted-foreground">
                {t('components.mastersInSalon', { count: p.mastersCount })}
              </span>
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
          onClick={go(`/s/${p?.slug ?? me?.salon?.slug}`)}
        />
        {p ? (
          <ListRow
            icon={<QrCode className="size-4" />}
            title={t('master.menu.share')}
            onClick={() => setQr(true)}
          />
        ) : null}
      </ListGroup>

      <section>
        <SectionTitle>{t('salon.menu.masters')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Users className="size-4" />}
            title={t('salon.menu.masters')}
            onClick={go('/salon/masters')}
          />
          <ListRow
            icon={<UserPlus className="size-4" />}
            title={t('salon.menu.invite')}
            onClick={go('/salon/masters/invite')}
          />
          <ListRow
            icon={<Scissors className="size-4" />}
            title={t('salon.menu.services')}
            onClick={go('/salon/services')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('master.menu.sectionProfile')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<UserRound className="size-4" />}
            title={t('master.menu.profileSettings')}
            onClick={go('/salon/profile')}
          />
          <ListRow
            icon={<Palette className="size-4" />}
            title={t('master.menu.theme')}
            onClick={go('/salon/theme')}
          />
          <ListRow
            icon={<Star className="size-4" />}
            title={t('salon.menu.reviews')}
            onClick={go('/salon/reviews')}
          />
          <ListRow
            icon={<BarChart3 className="size-4" />}
            title={t('master.menu.analytics')}
            onClick={go('/salon/analytics')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('master.menu.sectionMarketing')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<Percent className="size-4" />}
            title={t('master.menu.promotions')}
            onClick={go('/salon/promotions')}
          />
          <ListRow
            icon={<Megaphone className="size-4" />}
            title={t('master.menu.broadcast')}
            onClick={go('/salon/broadcast')}
          />
        </ListGroup>
      </section>
      <section>
        <SectionTitle>{t('master.menu.sectionAccount')}</SectionTitle>
        <ListGroup>
          <ListRow
            icon={<CreditCard className="size-4" />}
            title={t('master.menu.subscription')}
            onClick={go('/salon/subscription')}
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

      {p ? (
        <GlassSheet open={qr} onOpenChange={setQr} title={t('master.share.title')}>
          <QRCodeCard
            link={p.publicLink}
            title={p.name}
            avatarUrl={p.avatarUrl}
            fileName={`${p.slug}-qr.png`}
          />
        </GlassSheet>
      ) : null}
    </Page>
  );
}
