import { Copy, Gift, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShare, useSubscription } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { QRCodeCard } from '@/components/domain/media';
import { GlassButton, GlassCard, SectionTitle } from '@/components/ui/glass';
import { copyText, shareLink } from '@/lib/telegram';

export default function SharePage() {
  const { t } = useTranslation();
  const share = useShare();
  const sub = useSubscription('/api/master');
  if (!share.data) return <PageLoader />;
  const s = share.data;
  return (
    <Page title={t('master.share.title')} back>
      <QRCodeCard
        link={s.link}
        title={s.name}
        avatarUrl={s.avatarUrl}
        fileName={`glow-${s.startParam}.png`}
      />
      <GlassCard className="flex flex-col gap-3">
        <div className="text-[13px] text-muted-foreground">{t('master.share.link')}</div>
        <div className="truncate rounded-2xl bg-muted px-3 py-2.5 font-mono text-[13px]">
          {s.link}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <GlassButton
            onClick={() =>
              void copyText(s.link).then(() => toast.success(t('master.share.copied')))
            }
          >
            <Copy /> {t('common.copy')}
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => void shareLink(s.link, t('master.share.shareText'))}
          >
            <Share2 /> {t('common.share')}
          </GlassButton>
        </div>
      </GlassCard>
      <section>
        <SectionTitle>{t('master.share.tips')}</SectionTitle>
        <GlassCard className="flex flex-col gap-2 text-[14px]">
          <p>🖨 {t('master.share.tip1')}</p>
          <p>📌 {t('master.share.tip2')}</p>
          <p>💌 {t('master.share.tip3')}</p>
        </GlassCard>
      </section>
      {sub.data?.referralLink ? (
        <GlassCard className="flex flex-col gap-3 border border-foreground/10">
          <div className="flex items-center gap-2 text-[16px] font-semibold">
            <Gift className="size-5 text-primary" /> {t('master.share.referral')}
          </div>
          <p className="text-[14px] text-muted-foreground">{t('master.share.referralText')}</p>
          <p className="text-[13px]">
            {t('master.share.referralsCount', { count: sub.data.referralsCount })}
          </p>
          <GlassButton
            variant="primary"
            onClick={() => void shareLink(sub.data!.referralLink!, t('master.share.referralShare'))}
          >
            <Share2 /> {t('common.share')}
          </GlassButton>
        </GlassCard>
      ) : null}
    </Page>
  );
}
