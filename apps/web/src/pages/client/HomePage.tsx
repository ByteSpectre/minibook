import { CalendarDays, Search, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMyMasters } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { UserAvatar } from '@/components/domain/badges';
import { GlassButton, GlassCard, SectionTitle } from '@/components/ui/glass';
import { cn } from '@/lib/utils';
import { useMe } from '@/store/auth';

const PROMO_KEY = 'glow:hide-become-master-promo';

function timeGreetingKey() {
  const h = new Date().getHours();
  if (h < 5) return 'client.home.greetingNight';
  if (h < 12) return 'client.home.greetingMorning';
  if (h < 18) return 'client.home.greetingDay';
  return 'client.home.greetingEvening';
}

function ActionCard({
  className,
  icon,
  title,
  subtitle,
  onClick,
  tall,
}: {
  className?: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'glass flex h-full min-h-[112px] flex-col rounded-[var(--card-radius)] p-[var(--card-p)] text-left transition-transform active:scale-[0.98]',
        tall && 'min-h-[176px]',
        className,
      )}
    >
      <span className="mb-3 flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
        {icon}
      </span>
      <span className="mt-auto flex flex-col gap-1">
        <span className="font-heading text-[17px] font-semibold leading-snug">{title}</span>
        <span className="text-[13px] leading-snug text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const masters = useMyMasters();
  const [hidePromo, setHidePromo] = useState(() => localStorage.getItem(PROMO_KEY) === '1');

  const mastersHint = useMemo(() => {
    const n = masters.data?.length ?? 0;
    if (!n) return t('client.home.myMastersNone');
    return t('client.home.myMastersCount', { count: n });
  }, [masters.data?.length, t]);

  const dismissPromo = () => {
    localStorage.setItem(PROMO_KEY, '1');
    setHidePromo(true);
  };

  return (
    <Page
      header={
        <header className="pt-safe bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-[var(--page-px)] pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted-foreground">{t(timeGreetingKey())}</p>
              <h1 className="font-heading truncate text-[28px] font-bold leading-tight tracking-tight">
                {t('common.appName')}
              </h1>
              <p className="truncate text-[13px] leading-snug text-muted-foreground">
                {t('client.home.subtitle')}
              </p>
            </div>
            <Link to="/client/profile" aria-label={t('nav.profile')}>
              <UserAvatar src={me?.user.photoUrl} name={me?.user.firstName} size={48} ring />
            </Link>
          </div>
        </header>
      }
    >
      <GlassCard
        strong
        className="border border-foreground/15 bg-foreground p-[var(--card-p)] text-background"
      >
        <h2 className="font-heading text-[22px] font-bold leading-snug tracking-tight">
          {t('client.home.heroTitle')}
        </h2>
        <p className="mt-2 max-w-[92%] text-[14px] leading-snug text-background/75">
          {t('client.home.heroText')}
        </p>
        <GlassButton
          variant="solid"
          className="mt-5 h-11 border border-background/20 bg-background text-foreground"
          onClick={() => navigate('/client/search')}
        >
          <Search className="size-4" /> {t('client.home.find')}
        </GlassButton>
      </GlassCard>

      <section>
        <SectionTitle>{t('client.home.actions')}</SectionTitle>
        <div className="grid auto-rows-fr grid-cols-2 gap-3">
          <ActionCard
            tall
            className="row-span-2"
            icon={<Search className="size-5" />}
            title={t('client.home.find')}
            subtitle={t('client.home.findHint')}
            onClick={() => navigate('/client/search')}
          />
          <ActionCard
            icon={<Users className="size-5" />}
            title={t('client.home.myMasters')}
            subtitle={mastersHint}
            onClick={() => navigate('/client/masters')}
          />
          <ActionCard
            icon={<CalendarDays className="size-5" />}
            title={t('client.home.myAppointments')}
            subtitle={t('client.home.myAppointmentsHint')}
            onClick={() => navigate('/client/calendar')}
          />
        </div>
      </section>

      {!hidePromo && !me?.master ? (
        <GlassCard className="relative flex flex-col gap-4 p-[var(--card-p)]">
          <button
            type="button"
            aria-label={t('client.home.dismissPromo')}
            className="absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            onClick={dismissPromo}
          >
            <X className="size-4" />
          </button>
          <div className="pr-10">
            <div className="font-heading text-[18px] font-semibold leading-snug">
              {t('client.home.becomeMaster')}
            </div>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
              {t('client.home.becomeMasterText')}
            </p>
          </div>
          <GlassButton
            variant="solid"
            className="self-start rounded-full px-6"
            onClick={() => navigate('/onboarding/master')}
          >
            {t('client.home.becomeMasterCta')}
          </GlassButton>
        </GlassCard>
      ) : null}
    </Page>
  );
}
