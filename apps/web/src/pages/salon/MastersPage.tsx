import { CalendarDays, Copy, ExternalLink, Link2, UserMinus, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useSalonInvites,
  useSalonMasters,
  useSalonMemberMutations,
  useSalonProfile,
} from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { OnlineBadge, UserAvatar } from '@/components/domain/badges';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassButton, GlassCard, ListGroup, ListRow, SectionTitle } from '@/components/ui/glass';
import { formatDate, formatPrice } from '@/lib/format';
import { confirmDialog, copyText } from '@/lib/telegram';

export default function SalonMastersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useSalonProfile();
  const masters = useSalonMasters();
  const invites = useSalonInvites();
  const { remove, revoke } = useSalonMemberMutations();
  const currency = profile.data?.currency ?? 'RUB';
  const pending = (invites.data ?? []).filter((i) => i.status === 'pending');

  const onRemove = async (id: string, name: string) => {
    if (
      !(await confirmDialog(
        `${t('salon.masters.removeTitle')}\n\n${name}: ${t('salon.masters.removeText')}`,
        t('salon.masters.remove'),
        t('common.cancel'),
      ))
    )
      return;
    await remove.mutateAsync(id);
    toast.success(t('salon.masters.removed'));
  };

  return (
    <Page
      title={t('salon.masters.title')}
      actions={
        <GlassButton asChild variant="primary" size="icon" aria-label={t('salon.masters.invite')}>
          <Link to="/salon/masters/invite">
            <UserPlus />
          </Link>
        </GlassButton>
      }
    >
      {masters.isLoading ? (
        <ListSkeleton />
      ) : masters.isError ? (
        <ErrorState onRetry={() => void masters.refetch()} />
      ) : !masters.data?.length ? (
        <EmptyState
          emoji="👩‍🎨"
          title={t('salon.masters.empty')}
          text={t('salon.masters.emptyText')}
          action={
            <GlassButton asChild variant="primary">
              <Link to="/salon/masters/invite">{t('salon.masters.invite')}</Link>
            </GlassButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {masters.data.map((m) => (
            <GlassCard key={m.id} className="flex items-center gap-3">
              <UserAvatar src={m.avatarUrl} name={m.name} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[16px] font-semibold">{m.name}</span>
                  {m.isOnlineOpen ? <OnlineBadge /> : null}
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {t('salon.masters.upcoming', { count: m.upcomingCount })} ·{' '}
                  {t('salon.masters.appointments', { count: m.appointmentsCount })}
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {t('salon.masters.revenue', { amount: formatPrice(m.monthRevenue, currency) })}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassButton size="icon-sm" aria-label={t('common.more')}>
                    ⋯
                  </GlassButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong rounded-2xl">
                  <DropdownMenuItem onSelect={() => navigate(`/salon/schedule?master=${m.id}`)}>
                    <CalendarDays /> {t('salon.masters.schedule')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate(`/m/${m.slug}`)}>
                    <ExternalLink /> {t('master.menu.publicPage')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void onRemove(m.id, m.name)}
                  >
                    <UserMinus /> {t('salon.masters.remove')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </GlassCard>
          ))}
        </div>
      )}

      {pending.length ? (
        <section>
          <SectionTitle>{t('salon.masters.invites')}</SectionTitle>
          <ListGroup>
            {pending.map((i) => (
              <ListRow
                key={i.id}
                icon={i.invitedUsername ? '@' : <Link2 className="size-4" />}
                title={i.invitedUsername ? `@${i.invitedUsername}` : t('salon.masters.linkInvite')}
                subtitle={`${t(`enums.inviteStatus.${i.status}`)} · ${t('common.to')} ${formatDate(i.expiresAt)}`}
                right={
                  <div className="flex shrink-0 gap-1.5">
                    <GlassButton
                      size="icon-sm"
                      aria-label={t('salon.masters.copyLink')}
                      onClick={() =>
                        void copyText(i.link).then(() => toast.success(t('common.copied')))
                      }
                    >
                      <Copy />
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="destructive"
                      loading={revoke.isPending && revoke.variables === i.id}
                      onClick={() =>
                        revoke.mutate(i.id, {
                          onSuccess: () => toast.success(t('salon.masters.revoked')),
                        })
                      }
                    >
                      {t('salon.masters.revoke')}
                    </GlassButton>
                  </div>
                }
              />
            ))}
          </ListGroup>
        </section>
      ) : null}
    </Page>
  );
}
