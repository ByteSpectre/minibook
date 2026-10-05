import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { JoinSalonPreviewDto } from '@nail-crm/shared';
import { api } from '@/api/client';
import { Page } from '@/components/layout/Page';
import { ErrorState, PageLoader } from '@/components/layout/states';
import { UserAvatar } from '@/components/domain/badges';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { haptic } from '@/lib/telegram';
import { useAuth } from '@/store/auth';

export default function JoinSalonPage() {
  const { t } = useTranslation();
  const { salonId, code } = useParams();
  const navigate = useNavigate();
  const preview = useQuery({
    queryKey: ['invite', salonId, code],
    queryFn: () => api.get<JoinSalonPreviewDto>(`/api/invites/${salonId}/${code}`),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () => api.post(`/api/invites/${salonId}/${code}/accept`),
    onSuccess: async () => {
      haptic.notify('success');
      toast.success(t('salon.join.accepted'));
      await useAuth
        .getState()
        .reauthenticate()
        .catch(() => false);
      navigate('/master', { replace: true });
    },
  });
  const decline = useMutation({
    mutationFn: () => api.post(`/api/invites/${salonId}/${code}/decline`),
    onSuccess: () => {
      toast.message(t('salon.join.declined'));
      navigate('/', { replace: true });
    },
  });

  if (preview.isLoading) return <PageLoader />;
  if (preview.isError || !preview.data) {
    return (
      <Page back bottomInset="none">
        <ErrorState text={t('salon.join.invalid')} />
      </Page>
    );
  }
  const { salon, invite, alreadyMember, isMaster } = preview.data;
  return (
    <Page back bottomInset="none" title={t('salon.join.title')} largeTitle={false}>
      <GlassCard strong className="mt-6 flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar src={salon.avatarUrl} name={salon.name} size={96} ring />
        <h1 className="text-[22px] font-semibold">{t('salon.join.text', { name: salon.name })}</h1>
        <p className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
          <Building2 className="size-4" /> {salon.cityName} ·{' '}
          {t('common.masters', { count: salon.mastersCount })}
        </p>
        <p className="rounded-2xl bg-accent px-3 py-2 text-[14px] text-accent-foreground">
          {t('salon.join.coverage')}
        </p>
        {!invite.valid ? (
          <p className="text-[15px] text-destructive">{t('salon.join.invalid')}</p>
        ) : alreadyMember ? (
          <p className="text-[15px]">{t('salon.join.alreadyMember')}</p>
        ) : isMaster ? (
          <div className="flex w-full flex-col gap-2">
            <GlassButton
              variant="primary"
              size="lg"
              block
              loading={accept.isPending}
              onClick={() => accept.mutate()}
            >
              {t('salon.join.accept')}
            </GlassButton>
            <GlassButton block loading={decline.isPending} onClick={() => decline.mutate()}>
              {t('salon.join.decline')}
            </GlassButton>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <p className="text-[14px] text-muted-foreground">{t('salon.join.needProfile')}</p>
            <GlassButton
              variant="primary"
              size="lg"
              block
              onClick={() => navigate(`/onboarding/master?join=${salonId}:${code}`)}
            >
              {t('salon.join.createProfile')}
            </GlassButton>
          </div>
        )}
      </GlassCard>
    </Page>
  );
}
