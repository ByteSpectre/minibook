import {
  EVENING_REMINDER_TIMES,
  SLOT_STEPS,
  type MasterSettingsDto,
  type SettingsPatchInput,
} from '@nail-crm/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useMasterProfile,
  usePatchMasterProfile,
  usePatchSettings,
  useSettings,
} from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, PageLoader } from '@/components/layout/states';
import { Switch } from '@/components/ui/switch';
import {
  Chip,
  Field,
  GlassCard,
  GlassInput,
  GlassTextarea,
  ListGroup,
  ListRow,
  SectionTitle,
} from '@/components/ui/glass';
import { cn } from '@/lib/utils';

const BUFFERS = [0, 5, 10, 15, 20, 30];
const LEADS = [0, 30, 60, 120, 180, 720, 1440];
const HORIZONS = [7, 14, 30, 60, 90, 120];
const ONLINE_HOURS = [1, 2, 3, 4, 6, 8];
const PERIODS = ['morning', 'day', 'evening', 'night'] as const;

function ChoiceRow<T extends string | number>({
  label,
  hint,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {options.map((o) => (
          <Chip key={o} active={o === value} onClick={() => o !== value && onChange(o)}>
            {format(o)}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

export default function MasterSettingsPage() {
  const { t } = useTranslation();
  const settings = useSettings();
  const profile = useMasterProfile();
  const patch = usePatchSettings();
  const patchProfile = usePatchMasterProfile();
  const [s, setS] = useState<MasterSettingsDto | null>(null);
  const [postVisit, setPostVisit] = useState('');

  useEffect(() => {
    if (settings.data) setS(settings.data);
  }, [settings.data]);
  useEffect(() => {
    if (profile.data) setPostVisit(profile.data.postVisitMessage ?? '');
  }, [profile.data]);

  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} />;
  if (!s || !profile.data) return <PageLoader />;
  const p = profile.data;

  const save = (input: SettingsPatchInput) => {
    const prev = s;
    setS({ ...s, ...input } as MasterSettingsDto);
    patch.mutate(input, {
      onSuccess: () => toast.success(t('master.settings.saved'), { id: 'settings-saved' }),
      onError: () => setS(prev),
    });
  };
  const minutes = (v: number) =>
    v < 60 || v % 60
      ? t('master.settings.minutes', { count: v })
      : v % 1440 === 0
        ? t('common.days', { count: v / 1440 })
        : t('common.hours', { count: v / 60 });

  return (
    <Page title={t('master.settings.title')} back bottomInset="none">
      <section>
        <SectionTitle>{t('master.settings.booking')}</SectionTitle>
        <ListGroup>
          <ListRow
            title={t('master.settings.autoConfirm')}
            subtitle={t('master.settings.autoConfirmHint')}
            right={
              <Switch
                checked={p.autoConfirm}
                onCheckedChange={(autoConfirm) => patchProfile.mutate({ autoConfirm })}
              />
            }
          />
          <ListRow
            title={t('master.settings.multiService')}
            right={
              <Switch
                checked={p.allowMultiService}
                onCheckedChange={(allowMultiService) => patchProfile.mutate({ allowMultiService })}
              />
            }
          />
        </ListGroup>
      </section>

      <GlassCard className="flex flex-col gap-4">
        <ChoiceRow
          label={t('master.settings.slotStep')}
          options={SLOT_STEPS}
          value={s.slotStep as (typeof SLOT_STEPS)[number]}
          format={minutes}
          onChange={(slotStep) => save({ slotStep })}
        />
        <ChoiceRow
          label={t('master.settings.buffer')}
          options={BUFFERS}
          value={s.bufferMinutes}
          format={minutes}
          onChange={(bufferMinutes) => save({ bufferMinutes })}
        />
        <ChoiceRow
          label={t('master.settings.minLead')}
          options={LEADS}
          value={s.minLeadMinutes}
          format={minutes}
          onChange={(minLeadMinutes) => save({ minLeadMinutes })}
        />
        <ChoiceRow
          label={t('master.settings.horizon')}
          options={HORIZONS}
          value={s.bookingHorizonDays}
          format={(v) => t('common.days', { count: v })}
          onChange={(bookingHorizonDays) => save({ bookingHorizonDays })}
        />
      </GlassCard>

      <section>
        <SectionTitle>{t('master.settings.periods')}</SectionTitle>
        <ListGroup>
          {PERIODS.map((period) => {
            const enabled = s[`${period}Enabled`];
            return (
              <div key={period} className="flex items-center gap-3 px-4 py-3">
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => save({ [`${period}Enabled`]: v })}
                  aria-label={t(`enums.period.${period}`)}
                />
                <span
                  className={cn(
                    'w-16 text-[15px] font-medium',
                    !enabled && 'text-muted-foreground',
                  )}
                >
                  {t(`enums.period.${period}`)}
                </span>
                <div
                  className={cn(
                    'flex flex-1 items-center justify-end gap-1.5',
                    !enabled && 'pointer-events-none opacity-50',
                  )}
                >
                  <GlassInput
                    type="time"
                    step={300}
                    className="h-10 w-[92px] px-2 text-center text-[15px]"
                    value={s[`${period}Start`]}
                    onChange={(e) => e.target.value && save({ [`${period}Start`]: e.target.value })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <GlassInput
                    type="time"
                    step={300}
                    className="h-10 w-[92px] px-2 text-center text-[15px]"
                    value={s[`${period}End`]}
                    onChange={(e) => e.target.value && save({ [`${period}End`]: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </ListGroup>
        <p className="mt-2 px-1 text-[12px] text-muted-foreground">
          {t('master.settings.periodsHint')}
        </p>
      </section>

      <section>
        <SectionTitle>{t('master.settings.notifications')}</SectionTitle>
        <ListGroup>
          <ListRow
            title={t('master.settings.evening')}
            subtitle={t('master.settings.eveningHint')}
            right={
              <Switch
                checked={s.dailyReminderEnabled}
                onCheckedChange={(dailyReminderEnabled) => save({ dailyReminderEnabled })}
              />
            }
          />
          {s.dailyReminderEnabled ? (
            <>
              <div className="px-4 py-3">
                <ChoiceRow
                  label={t('master.settings.eveningTime')}
                  options={EVENING_REMINDER_TIMES}
                  value={s.dailyReminderTime as (typeof EVENING_REMINDER_TIMES)[number]}
                  format={(v) => v}
                  onChange={(dailyReminderTime) => save({ dailyReminderTime })}
                />
              </div>
              <ListRow
                title={t('master.settings.eveningEmpty')}
                right={
                  <Switch
                    checked={s.dailyReminderSendEmpty}
                    onCheckedChange={(dailyReminderSendEmpty) => save({ dailyReminderSendEmpty })}
                  />
                }
              />
            </>
          ) : null}
          <ListRow
            title={t('master.settings.morning')}
            right={
              <Switch
                checked={s.morningSummaryEnabled}
                onCheckedChange={(morningSummaryEnabled) => save({ morningSummaryEnabled })}
              />
            }
          />
          <ListRow
            title={t('master.settings.slotAlerts')}
            subtitle={t('master.settings.slotAlertsHint')}
            right={
              <Switch
                checked={s.slotAlertsEnabled}
                onCheckedChange={(slotAlertsEnabled) => save({ slotAlertsEnabled })}
              />
            }
          />
        </ListGroup>
      </section>

      <GlassCard className="flex flex-col gap-4">
        <ChoiceRow
          label={t('master.settings.onlineDuration')}
          hint={t('master.settings.online')}
          options={ONLINE_HOURS}
          value={s.onlineDurationHours}
          format={(v) => t('common.hours', { count: v })}
          onChange={(onlineDurationHours) => save({ onlineDurationHours })}
        />
      </GlassCard>

      <section>
        <SectionTitle>{t('master.settings.postVisit')}</SectionTitle>
        <GlassCard>
          <Field hint={t('master.settings.postVisitHint')}>
            <GlassTextarea
              value={postVisit}
              maxLength={1000}
              placeholder={t('master.settings.postVisitPlaceholder')}
              onChange={(e) => setPostVisit(e.target.value)}
              onBlur={() => {
                const next = postVisit.trim() || null;
                if (next !== (p.postVisitMessage ?? null))
                  patchProfile.mutate(
                    { postVisitMessage: next },
                    {
                      onSuccess: () =>
                        toast.success(t('master.settings.saved'), { id: 'settings-saved' }),
                    },
                  );
              }}
            />
          </Field>
        </GlassCard>
      </section>
    </Page>
  );
}
