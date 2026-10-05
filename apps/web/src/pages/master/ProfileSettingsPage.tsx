import { useMasterProfile, usePatchMasterProfile } from '@/api/cabinetApi';
import { ErrorState, PageLoader } from '@/components/layout/states';
import { TenantProfileForm } from '@/features/cabinet/TenantProfileForm';
import { useAuth } from '@/store/auth';

export default function MasterProfileSettingsPage() {
  const profile = useMasterProfile();
  const patch = usePatchMasterProfile();
  const refreshMe = useAuth((s) => s.refreshMe);
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <PageLoader />;
  return (
    <TenantProfileForm
      kind="master"
      profile={profile.data}
      saving={patch.isPending}
      onSave={async (input) => {
        await patch.mutateAsync(input);
        await refreshMe();
      }}
    />
  );
}
