import { useLocation, useParams } from 'react-router-dom';
import type { BlockedScreenDto } from '@nail-crm/shared';
import { usePublicPage } from '@/api/publicApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { BlockedScreen } from '@/components/domain/screens';

/** Shows only the master's custom stub — never the real page or the reason. */
export default function BlockedPage() {
  const { slug } = useParams();
  const location = useLocation();
  const fromState = location.state as BlockedScreenDto | null;
  const page = usePublicPage(fromState ? undefined : slug);
  const screen = fromState ?? (page.data?.kind === 'blocked' ? page.data.screen : null);
  if (!screen) return <PageLoader />;
  return (
    <Page back bottomInset="none">
      <div className="pt-10">
        <BlockedScreen screen={screen} />
      </div>
    </Page>
  );
}
