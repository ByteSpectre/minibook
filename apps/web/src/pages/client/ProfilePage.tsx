import { CircleHelp, FileText, Scissors, Store, UserCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatPhone } from '@nail-crm/shared';
import { useClientProfile } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton } from '@/components/layout/states';
import { UserAvatar } from '@/components/domain/badges';
import { GlassButton, GlassCard, SectionTitle } from '@/components/ui/glass';
import { openExternal } from '@/lib/telegram';
import { useMe } from '@/store/auth';

const APP_VERSION = '0.1.0';
const BOT =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.replace(/^@/, '') ?? 'glow_beauty_bot';

function ExtraCard({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass flex min-h-[120px] flex-col items-start gap-2.5 rounded-[var(--card-radius)] p-[var(--card-p)] text-left transition-transform active:scale-[0.98]"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="font-heading block text-[15px] font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export default function ClientProfilePage() {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const profile = useClientProfile();
  const p = profile.data;

  const help = () => openExternal(`https://t.me/${BOT}`);

  return (
    <Page title={t('client.profile.title')} bottomInset="tabbar">
      {profile.isLoading && !p ? (
        <CardSkeleton />
      ) : (
        <div className="flex flex-col items-center gap-2 pt-2 pb-1 text-center">
          <div className="relative">
            <UserAvatar src={p.avatarUrl ?? me?.user.photoUrl} name={p.firstName} size={96} ring />
          </div>
          <div className="font-heading mt-2 text-[22px] font-semibold tracking-tight">
            {p.firstName}
          </div>
          <div className="text-[14px] text-muted-foreground">
            {p.username ? `@${p.username}` : formatPhone(p.phone)}
          </div>
        </div>
      )}

      <GlassCard className="flex items-center gap-3 border border-foreground/15 bg-foreground p-3.5 text-background">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-background/20 bg-background/10">
          {me?.master ? <Scissors className="size-5" /> : <Store className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">
            {me?.master ? t('common.masterCabinet') : t('client.profile.becomeMaster')}
          </div>
          <div className="truncate text-[12px] text-background/75">
            {me?.master ? t('client.profile.openCabinet') : t('client.profile.becomeMasterHint')}
          </div>
        </div>
        <GlassButton
          size="sm"
          variant="solid"
          className="shrink-0 border border-background/20 bg-background text-foreground"
          onClick={() => navigate(me?.master ? '/master' : '/onboarding/master')}
        >
          {me?.master ? t('common.open') : t('client.profile.becomeMasterCta')}
        </GlassButton>
      </GlassCard>

      <section>
        <SectionTitle>{t('client.profile.additional')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2.5">
          <ExtraCard
            icon={<CircleHelp className="size-4" />}
            title={t('client.profile.help')}
            hint={t('client.profile.helpHint')}
            onClick={help}
          />
          <ExtraCard
            icon={<FileText className="size-4" />}
            title={t('client.profile.about')}
            hint={t('client.profile.aboutHint', { version: APP_VERSION })}
            onClick={() =>
              toast(t('common.appName'), {
                description: `${t('common.tagline')} · v${APP_VERSION}`,
              })
            }
          />
          <ExtraCard
            icon={<UserCog className="size-4" />}
            title={t('client.profile.account')}
            hint={t('client.profile.accountHint')}
            onClick={() => navigate('/client/account')}
          />
        </div>
      </section>
    </Page>
  );
}
