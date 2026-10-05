import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  FONT_FAMILIES,
  THEME_BG_TYPES,
  type ThemeDto,
  type ThemePatchInput,
} from '@nail-crm/shared';
import { useApplyPreset, usePatchTheme, useTheme, type CabinetBase } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import {
  Chip,
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  SectionTitle,
} from '@/components/ui/glass';
import { Slider } from '@/components/ui/slider';
import { ThemePresetPicker } from '@/features/cabinet/ThemePresetPicker';
import { themeBackground, themeStyle, useGoogleFont } from '@/features/theme/ThemedSurface';
import { useMainButton } from '@/hooks/telegram';

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[14px]">{label}</span>
      <span className="flex items-center gap-2">
        <GlassInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-36 rounded-xl px-3 text-[13px]"
        />
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 cursor-pointer rounded-xl border border-border bg-transparent p-1"
          aria-label={label}
        />
      </span>
    </label>
  );
}

function Preview({ theme, name }: { theme: ThemeDto; name: string }) {
  const { t } = useTranslation();
  useGoogleFont(theme.fontFamily);
  return (
    <div
      className="overflow-hidden rounded-3xl border border-border"
      style={{ ...themeBackground(theme) }}
    >
      <div className="flex flex-col gap-3 p-4" style={themeStyle(theme)}>
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-brand" />
          <div>
            <div className="text-[17px] font-bold">{name}</div>
            <div className="text-[12px] opacity-70">★ 4.9 · 48</div>
          </div>
        </div>
        <div className="glass flex items-center justify-between rounded-[var(--card-radius)] p-3">
          <div>
            <div className="text-[14px] font-semibold">{t('master.theme.sampleService')}</div>
            <div className="text-[12px] opacity-70">1 ч 30 мин</div>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: theme.accent }}>
            2 500 ₽
          </span>
        </div>
        <GlassButton variant="primary" block>
          {t('master.theme.sampleButton')}
        </GlassButton>
      </div>
    </div>
  );
}

export function ThemeCustomizer({ base, name }: { base: CabinetBase; name: string }) {
  const { t } = useTranslation();
  const theme = useTheme(base);
  const patch = usePatchTheme(base);
  const preset = useApplyPreset(base);
  const [draft, setDraft] = useState<ThemeDto | null>(null);
  useEffect(() => {
    if (theme.data) setDraft(theme.data);
  }, [theme.data]);
  const dirty = !!draft && !!theme.data && JSON.stringify(draft) !== JSON.stringify(theme.data);
  useMainButton({
    text: t('common.save'),
    visible: dirty,
    loading: patch.isPending,
    onClick: () => {
      if (!draft) return;
      const { preset: _p, ...values } = draft;
      patch.mutate(values as ThemePatchInput, {
        onSuccess: () => toast.success(t('master.theme.saved')),
      });
    },
  });
  if (!draft) return <PageLoader />;
  const set = (p: Partial<ThemeDto>) => setDraft((d) => (d ? { ...d, ...p } : d));
  return (
    <>
      <section>
        <SectionTitle>{t('master.theme.preview')}</SectionTitle>
        <Preview theme={draft} name={name} />
        <p className="mt-1.5 px-1 text-[12px] text-muted-foreground">
          {t('master.theme.previewHint')}
        </p>
      </section>
      <section>
        <SectionTitle>{t('master.theme.presets')}</SectionTitle>
        <ThemePresetPicker
          value={draft.preset}
          onChange={(p) =>
            preset.mutate(p, {
              onSuccess: (th) => (setDraft(th), toast.success(t('master.theme.saved'))),
            })
          }
        />
      </section>
      <section>
        <SectionTitle>{t('master.theme.custom')}</SectionTitle>
        <GlassCard className="flex flex-col gap-3">
          <Field label={t('master.theme.background')}>
            <div className="flex gap-2">
              {THEME_BG_TYPES.map((type) => (
                <Chip
                  key={type}
                  active={draft.bgType === type}
                  onClick={() => set({ bgType: type })}
                >
                  {t(`enums.bgType.${type}`)}
                </Chip>
              ))}
            </div>
          </Field>
          {draft.bgType === 'image' ? (
            <SinglePhotoUploader
              endpoint={`${base}/upload`}
              kind="theme"
              value={
                draft.bgValue.startsWith('/') || draft.bgValue.startsWith('http')
                  ? draft.bgValue
                  : null
              }
              onChange={(url) => url && set({ bgValue: url })}
              size={120}
            />
          ) : draft.bgType === 'gradient' ? (
            <GlassInput value={draft.bgValue} onChange={(e) => set({ bgValue: e.target.value })} />
          ) : (
            <ColorField
              label={t('master.theme.color')}
              value={draft.bgValue}
              onChange={(bgValue) => set({ bgValue })}
            />
          )}
          <ColorField
            label={t('master.theme.buttonBg')}
            value={draft.btnBg}
            onChange={(btnBg) => set({ btnBg })}
          />
          <ColorField
            label={t('master.theme.buttonText')}
            value={draft.btnText}
            onChange={(btnText) => set({ btnText })}
          />
          <ColorField
            label={t('master.theme.accent')}
            value={draft.accent}
            onChange={(accent) => set({ accent })}
          />
          <ColorField
            label={t('master.theme.cardBg')}
            value={draft.cardBg}
            onChange={(cardBg) => set({ cardBg })}
          />
          <ColorField
            label={t('master.theme.text')}
            value={draft.textColor}
            onChange={(textColor) => set({ textColor })}
          />
          <Field label={t('master.theme.font')}>
            <div className="flex flex-wrap gap-2">
              {FONT_FAMILIES.map((f) => (
                <Chip
                  key={f}
                  active={draft.fontFamily === f}
                  onClick={() => set({ fontFamily: f })}
                  style={{ fontFamily: f }}
                >
                  {f}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={`${t('master.theme.radius')}: ${draft.radius}px`}>
            <Slider
              value={[draft.radius]}
              min={0}
              max={32}
              step={1}
              onValueChange={([radius]) => set({ radius: radius ?? 0 })}
            />
          </Field>
          <Field label={`${t('master.theme.blur')}: ${draft.blur}px`}>
            <Slider
              value={[draft.blur]}
              min={0}
              max={40}
              step={1}
              onValueChange={([blur]) => set({ blur: blur ?? 0 })}
            />
          </Field>
        </GlassCard>
      </section>
    </>
  );
}

export default function ThemeCustomizerPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('master.theme.title')} back bottomInset="button">
      <ThemeCustomizer base="/api/master" name={t('master.theme.title')} />
    </Page>
  );
}
