import { AtSign, Copy, Link2, Send, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isValidUsername, normalizeUsername, type SalonInviteDto } from '@nail-crm/shared';
import { useSalonMemberMutations } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { Field, GlassButton, GlassCard, GlassInput } from '@/components/ui/glass';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/format';
import { copyText, haptic, shareLink } from '@/lib/telegram';

export default function SalonInviteMasterPage() {
  const { t } = useTranslation();
  const { inviteByUsername, inviteLink } = useSalonMemberMutations();
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<{ invite: SalonInviteDto; delivered: boolean } | null>(null);
  const [link, setLink] = useState<SalonInviteDto | null>(null);
  const valid = isValidUsername(username);

  const sendByUsername = async () => {
    const res = await inviteByUsername.mutateAsync(normalizeUsername(username)!);
    haptic.notify(res.delivered ? 'success' : 'warning');
    setResult(res);
    if (res.delivered) toast.success(t('salon.invite.delivered'));
  };

  const createLink = async () => {
    setLink(await inviteLink.mutateAsync(undefined));
    haptic.notify('success');
  };

  const copy = (url: string) => void copyText(url).then(() => toast.success(t('common.copied')));

  return (
    <Page title={t('salon.invite.title')} back bottomInset="none">
      <Tabs defaultValue="username" className="gap-4">
        <TabsList className="glass h-11 w-full rounded-2xl p-1">
          <TabsTrigger value="username" className="rounded-xl">
            <AtSign /> {t('salon.invite.byUsername')}
          </TabsTrigger>
          <TabsTrigger value="link" className="rounded-xl">
            <Link2 /> {t('salon.invite.byLink')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="username" className="flex flex-col gap-3">
          <GlassCard className="flex flex-col gap-3">
            <Field
              label={t('salon.invite.username')}
              error={username && !valid ? t('validation.username') : undefined}
            >
              <GlassInput
                value={username}
                placeholder="@username"
                autoCapitalize="none"
                autoFocus
                onChange={(e) => {
                  setUsername(e.target.value);
                  setResult(null);
                }}
              />
            </Field>
            <GlassButton
              variant="primary"
              block
              disabled={!valid}
              loading={inviteByUsername.isPending}
              onClick={() => void sendByUsername()}
            >
              <Send /> {t('salon.invite.send')}
            </GlassButton>
          </GlassCard>
          {result ? (
            <GlassCard className="flex flex-col gap-3">
              <p className="text-[14px]">
                {result.delivered ? t('salon.invite.delivered') : t('salon.invite.notDelivered')}
              </p>
              {!result.delivered ? (
                <div className="grid grid-cols-2 gap-2">
                  <GlassButton onClick={() => copy(result.invite.link)}>
                    <Copy /> {t('common.copy')}
                  </GlassButton>
                  <GlassButton
                    variant="solid"
                    onClick={() => void shareLink(result.invite.link, t('salon.invite.shareText'))}
                  >
                    <Share2 /> {t('common.share')}
                  </GlassButton>
                </div>
              ) : null}
            </GlassCard>
          ) : null}
        </TabsContent>

        <TabsContent value="link" className="flex flex-col gap-3">
          <GlassCard className="flex flex-col gap-3">
            <p className="text-[14px] text-muted-foreground">{t('salon.invite.linkHint')}</p>
            {link ? (
              <>
                <button
                  type="button"
                  onClick={() => copy(link.link)}
                  className="glass rounded-2xl px-4 py-3 text-left text-[14px] font-medium break-all text-primary"
                >
                  {link.link}
                </button>
                <p className="text-[12px] text-muted-foreground">
                  {t('common.to')} {formatDate(link.expiresAt)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <GlassButton onClick={() => copy(link.link)}>
                    <Copy /> {t('common.copy')}
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={() => void shareLink(link.link, t('salon.invite.shareText'))}
                  >
                    <Share2 /> {t('salon.invite.share')}
                  </GlassButton>
                </div>
              </>
            ) : (
              <GlassButton
                variant="primary"
                block
                loading={inviteLink.isPending}
                onClick={() => void createLink()}
              >
                <Link2 /> {t('salon.invite.createLink')}
              </GlassButton>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
