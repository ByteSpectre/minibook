import { useTranslation } from 'react-i18next';
import { Page } from '@/components/layout/Page';
import { ThemeCustomizer } from '@/pages/master/ThemeCustomizerPage';
import { useMe } from '@/store/auth';

export default function SalonThemePage() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <Page title={t('master.theme.title')} back bottomInset="button">
      <ThemeCustomizer base="/api/salon" name={me?.salon?.name ?? t('master.theme.title')} />
    </Page>
  );
}
