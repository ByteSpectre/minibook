import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { EmptyState } from '@/components/layout/states';
import { GlassButton } from '@/components/ui/glass';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page back bottomInset="none">
      <EmptyState
        emoji="🧭"
        title={t('common.notFoundTitle')}
        text={t('common.notFoundText')}
        action={
          <GlassButton asChild variant="primary">
            <Link to="/">{t('common.goHome')}</Link>
          </GlassButton>
        }
        className="mt-16"
      />
    </Page>
  );
}
