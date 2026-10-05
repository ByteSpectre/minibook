import { usePatchSalonProfile, useSalonProfile } from '@/api/cabinetApi';
import { ErrorState, PageLoader } from '@/components/layout/states';
import { TenantProfileForm } from '@/features/cabinet/TenantProfileForm';
import { useAuth } from '@/store/auth';

export default function SalonProfileSettingsPage() {
  const profile = useSalonProfile();
  const patch = usePatchSalonProfile();
  const refreshMe = useAuth((s) => s.refreshMe);
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <PageLoader />;
  return (
    <TenantProfileForm
      kind="salon"
      profile={profile.data}
      saving={patch.isPending}
      onSave={async (input) => {
        await patch.mutateAsync(input);
        await refreshMe();
      }}
    />
  );
}
