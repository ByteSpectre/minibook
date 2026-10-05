import { useTranslation } from 'react-i18next';
import { Page } from '@/components/layout/Page';
import { ReviewsView } from '@/pages/master/ReviewsPage';

export default function SalonReviewsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('salon.menu.reviews')} back>
      <ReviewsView base="/api/salon" />
    </Page>
  );
}
