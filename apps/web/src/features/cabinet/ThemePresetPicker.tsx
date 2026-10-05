import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEME_PRESET_VALUES, THEME_PRESETS, type ThemePreset } from '@nail-crm/shared';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export function ThemePresetPicker({
  value,
  onChange,
}: {
  value: ThemePreset | null;
  onChange: (preset: ThemePreset) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      {THEME_PRESETS.map((preset) => {
        const v = THEME_PRESET_VALUES[preset];
        const active = value === preset;
        return (
          <button
            key={preset}
            type="button"
            aria-pressed={active}
            onClick={() => {
              haptic.select();
              onChange(preset);
            }}
            className={cn(
              'relative overflow-hidden rounded-3xl p-3 text-left transition-transform active:scale-[0.98]',
              active ? 'ring-3 ring-primary' : 'ring-1 ring-border',
            )}
            style={{ background: v.bgValue, color: v.textColor, fontFamily: v.fontFamily }}
          >
            <div
              className="mb-2 flex flex-col gap-1.5 p-2.5"
              style={{
                background: v.cardBg,
                borderRadius: v.radius,
                backdropFilter: `blur(${v.blur}px)`,
              }}
            >
              <span
                className="h-2 w-2/3 rounded-full opacity-60"
                style={{ background: v.textColor }}
              />
              <span
                className="h-2 w-1/3 rounded-full opacity-30"
                style={{ background: v.textColor }}
              />
              <span
                className="mt-1 h-5 rounded-full"
                style={{ background: v.btnBg, borderRadius: v.radius }}
              />
            </div>
            <span className="text-[14px] font-semibold">{t(`enums.preset.${preset}`)}</span>
            {active ? (
              <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-white">
                <Check className="size-4" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
