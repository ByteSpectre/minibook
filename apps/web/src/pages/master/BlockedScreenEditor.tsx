import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { BlockedScreenDto } from '@nail-crm/shared';
import { useBlockedScreen, useSaveBlockedScreen } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import { BlockedScreen } from '@/components/domain/screens';
import { Field, GlassCard, GlassInput, GlassTextarea, SectionTitle } from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';

export default function BlockedScreenEditor() {
  const { t } = useTranslation();
  const screen = useBlockedScreen();
  const save = useSaveBlockedScreen();
  const [draft, setDraft] = useState<BlockedScreenDto | null>(null);
  useEffect(() => {
    if (screen.data) setDraft(screen.data);
  }, [screen.data]);
  useMainButton({
    text: t('common.save'),
    loading: save.isPending,
    visible: !!draft,
    onClick: () =>
      draft &&
      save.mutate(draft, { onSuccess: () => toast.success(t('master.blockedScreen.saved')) }),
  });
  if (!draft) return <PageLoader />;
  const set = (p: Partial<BlockedScreenDto>) => setDraft((d) => (d ? { ...d, ...p } : d));
  return (
    <Page title={t('master.blockedScreen.title')} back bottomInset="button">
      <GlassCard className="flex flex-col gap-3">
        <Field label={t('master.blockedScreen.titleLabel')}>
          <GlassInput
            value={draft.title}
            maxLength={80}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        <Field label={t('master.blockedScreen.text')}>
          <GlassTextarea
            value={draft.text}
            maxLength={600}
            onChange={(e) => set({ text: e.target.value })}
          />
        </Field>
        <Field label={t('master.blockedScreen.image')}>
          <SinglePhotoUploader
            endpoint="/api/master/upload"
            kind="blocked"
            value={draft.imageUrl}
            onChange={(imageUrl) => set({ imageUrl })}
            size={100}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('master.blockedScreen.buttonText')}>
            <GlassInput
              value={draft.buttonText ?? ''}
              onChange={(e) => set({ buttonText: e.target.value || null })}
            />
          </Field>
          <Field label={t('master.blockedScreen.buttonUrl')}>
            <GlassInput
              value={draft.buttonUrl ?? ''}
              placeholder="https://"
              onChange={(e) => set({ buttonUrl: e.target.value || null })}
            />
          </Field>
        </div>
      </GlassCard>
      <section>
        <SectionTitle>{t('master.blockedScreen.preview')}</SectionTitle>
        <BlockedScreen screen={draft} preview />
      </section>
    </Page>
  );
}
