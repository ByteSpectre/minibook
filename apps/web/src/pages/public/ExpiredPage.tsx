import { useLocation, useParams } from 'react-router-dom';
import { usePublicPage } from '@/api/publicApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { ExpiredScreen } from '@/components/domain/screens';

export default function ExpiredPage() {
  const { slug } = useParams();
  const location = useLocation();
  const fromState = location.state as { name: string; avatarUrl: string | null } | null;
  const page = usePublicPage(fromState ? undefined : slug);
  const data = fromState ?? (page.data?.kind === 'expired' ? page.data : null);
  if (!data) return <PageLoader />;
  return (
    <Page back bottomInset="none">
      <div className="pt-10">
        <ExpiredScreen name={data.name} avatarUrl={data.avatarUrl} />
      </div>
    </Page>
  );
}
