import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { BlockedScreenDto } from '@nail-crm/shared';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { assetUrl } from '@/lib/assets';
import { openExternal, openTelegram } from '@/lib/telegram';
import { UserAvatar } from './badges';

export function BlockedScreen({
  screen,
  preview,
}: {
  screen: BlockedScreenDto;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const image = assetUrl(screen.imageUrl);
  return (
    <GlassCard strong className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      {image ? (
        <img src={image} alt="" className="mb-1 h-40 w-full rounded-2xl object-cover" />
      ) : (
        <div className="text-5xl">🔒</div>
      )}
      <h1 className="text-[20px] font-semibold">{screen.title}</h1>
      <p className="text-[15px] text-muted-foreground">{screen.text}</p>
      {screen.buttonText && screen.buttonUrl ? (
        <GlassButton
          variant="primary"
          className="mt-2"
          onClick={() => {
            if (preview) return;
            const url = screen.buttonUrl!;
            if (url.startsWith('https://t.me/')) openTelegram(url);
            else openExternal(url);
          }}
        >
          {screen.buttonText}
        </GlassButton>
      ) : null}
      {!preview ? (
        <GlassButton asChild variant="ghost" className="mt-1">
          <Link to="/">{t('public.blocked.back')}</Link>
        </GlassButton>
      ) : null}
    </GlassCard>
  );
}

export function ExpiredScreen({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const { t } = useTranslation();
  return (
    <GlassCard strong className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <UserAvatar src={avatarUrl} name={name} size={88} className="grayscale" />
      <h1 className="text-[20px] font-semibold">{name}</h1>
      <p className="text-[16px] font-medium">{t('public.expired.title')}</p>
      <p className="text-[14px] text-muted-foreground">{t('public.expired.text')}</p>
      <GlassButton asChild variant="primary" className="mt-2">
        <Link to="/client/search">{t('public.expired.search')}</Link>
      </GlassButton>
    </GlassCard>
  );
}
