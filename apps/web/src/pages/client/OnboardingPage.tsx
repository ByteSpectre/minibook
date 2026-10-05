import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  clientOnboardingSchema,
  defaultCountryForLocale,
  type ClientOnboardingInput,
} from '@nail-crm/shared';
import { useCompleteClientOnboarding } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { PhoneInput } from '@/components/domain/pickers';
import { Field, GlassCard, GlassInput } from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';
import { haptic, telegramEnv } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useMe } from '@/store/auth';

const STEPS = [
  ['firstName'],
  ['gender'],
  ['birthday'],
  ['phone', 'phoneCountry', 'username'],
] as const;

function maxBirthday(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 7);
  return d.toISOString().slice(0, 10);
}

export default function ClientOnboardingPage() {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const complete = useCompleteClientOnboarding();
  const form = useForm<ClientOnboardingInput>({
    resolver: zodResolver(clientOnboardingSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: me?.user.firstName ?? '',
      gender: undefined,
      birthday: '',
      phone: '',
      phoneCountry: defaultCountryForLocale(me?.user.languageCode ?? telegramEnv().languageCode),
      username: me?.user.username ?? '',
    },
  });
  const { register, control, formState, trigger, handleSubmit, watch, setValue } = form;
  const last = step === STEPS.length - 1;

  const submit = handleSubmit(async (values) => {
    await complete.mutateAsync(values);
    haptic.notify('success');
    toast.success(t('client.onboarding.done'));
    navigate(params.get('returnTo') ?? '/client', { replace: true });
  });

  const next = async () => {
    const ok = await trigger([...STEPS[step]!]);
    if (!ok) {
      haptic.notify('error');
      return;
    }
    if (last) void submit();
    else setStep((s) => s + 1);
  };

  useMainButton({
    text: last ? t('client.onboarding.finish') : t('common.next'),
    onClick: () => void next(),
    loading: complete.isPending,
  });

  const titles = [
    [t('client.onboarding.nameTitle'), t('client.onboarding.nameHint')],
    [t('client.onboarding.genderTitle'), t('client.onboarding.genderHint')],
    [t('client.onboarding.birthdayTitle'), t('client.onboarding.birthdayHint')],
    [t('client.onboarding.contactsTitle'), t('client.onboarding.contactsHint')],
  ] as const;

  return (
    <Page
      back={step > 0 ? () => setStep((s) => s - 1) : false}
      bottomInset="button"
      largeTitle={false}
      title={t('client.onboarding.stepOf', { step: step + 1, total: STEPS.length })}
    >
      <div className="flex gap-1.5" aria-hidden>
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-brand' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-5 pt-4"
        >
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">
              {titles[step]![0]}
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">{titles[step]![1]}</p>
          </div>

          {step === 0 ? (
            <Field error={formState.errors.firstName?.message}>
              <GlassInput
                autoFocus
                placeholder={t('client.onboarding.namePlaceholder')}
                autoComplete="given-name"
                {...register('firstName')}
              />
            </Field>
          ) : null}

          {step === 1 ? (
            <Controller
              control={control}
              name="gender"
              render={({ field, fieldState }) => (
                <Field error={fieldState.error?.message}>
                  <div className="grid grid-cols-2 gap-3">
                    {(['FEMALE', 'MALE'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={field.value === g}
                        onClick={() => {
                          haptic.select();
                          field.onChange(g);
                        }}
                        className={cn(
                          'flex h-28 flex-col items-center justify-center gap-2 rounded-3xl text-[16px] font-semibold transition-all active:scale-[0.98]',
                          field.value === g ? 'bg-foreground text-background shadow-xl' : 'glass',
                        )}
                      >
                        <span className="text-3xl">{g === 'FEMALE' ? '👩' : '👨'}</span>
                        {g === 'FEMALE'
                          ? t('client.onboarding.female')
                          : t('client.onboarding.male')}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            />
          ) : null}

          {step === 2 ? (
            <Field error={formState.errors.birthday?.message}>
              <GlassInput
                type="date"
                max={maxBirthday()}
                min="1915-01-01"
                {...register('birthday')}
                className="text-left"
              />
            </Field>
          ) : null}

          {step === 3 ? (
            <GlassCard className="flex flex-col gap-4">
              <Field
                label={t('client.onboarding.phone')}
                required
                error={formState.errors.phone?.message}
              >
                <PhoneInput
                  value={watch('phone')}
                  country={watch('phoneCountry')}
                  onChange={(v) => setValue('phone', v, { shouldValidate: formState.isSubmitted })}
                  onCountryChange={(c) => setValue('phoneCountry', c)}
                  invalid={!!formState.errors.phone}
                />
              </Field>
              <Field
                label={t('client.onboarding.username')}
                hint={t('client.onboarding.usernameHint')}
                error={formState.errors.username?.message}
              >
                <GlassInput
                  placeholder="@username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  {...register('username')}
                />
              </Field>
            </GlassCard>
          ) : null}
          {last ? (
            <p className="text-center text-[12px] text-muted-foreground">
              {t('client.onboarding.privacy')}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}
