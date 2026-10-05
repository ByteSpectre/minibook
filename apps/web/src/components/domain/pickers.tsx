import { Check, ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AsYouType, type CountryCode } from 'libphonenumber-js/min';
import { callingCodeOf, countryFlag, type CategoryDto } from '@nail-crm/shared';
import { useCategories, useCities, useCountries } from '@/api/common';
import { Chip, GlassInput, GlassSheet } from '@/components/ui/glass';
import { cn } from '@/lib/utils';
import { categoryName } from './MasterCard';

function PickerButton({
  label,
  value,
  onClick,
  className,
}: {
  label: string;
  value?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'glass flex h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 text-left active:scale-[0.99]',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[11px] leading-tight text-muted-foreground">{label}</span>
        <span className="block truncate text-[15px] font-medium">{value}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

interface Option {
  id: string;
  label: string;
  prefix?: string;
}

function OptionSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onSelect,
  allowEmpty,
  emptyLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: Option[];
  value: string | null;
  onSelect: (id: string | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  const choose = (id: string | null) => {
    onSelect(id);
    onOpenChange(false);
    setQuery('');
  };
  return (
    <GlassSheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <GlassInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search')}
          className="pl-10"
        />
      </div>
      <div className="flex flex-col gap-1 pb-2">
        {allowEmpty ? (
          <button
            type="button"
            onClick={() => choose(null)}
            className="flex min-h-12 items-center justify-between rounded-2xl px-3 text-left active:bg-muted"
          >
            <span className="text-[15px]">{emptyLabel}</span>
            {value === null ? <Check className="size-4 text-primary" /> : null}
          </button>
        ) : null}
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => choose(o.id)}
            className="flex min-h-12 items-center justify-between rounded-2xl px-3 text-left active:bg-muted"
          >
            <span className="text-[15px]">
              {o.prefix ? <span className="mr-2">{o.prefix}</span> : null}
              {o.label}
            </span>
            {value === o.id ? <Check className="size-4 text-primary" /> : null}
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('components.country.empty')}
          </p>
        ) : null}
      </div>
    </GlassSheet>
  );
}

export function CountryPicker({
  value,
  onChange,
  allowEmpty,
  label,
  className,
}: {
  value: string | null;
  onChange: (countryId: string | null) => void;
  allowEmpty?: boolean;
  label?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { data = [] } = useCountries();
  const [open, setOpen] = useState(false);
  const selected = data.find((c) => c.id === value);
  const name = (c: (typeof data)[number]) =>
    i18n.language === 'en' && c.nameEn ? c.nameEn : c.name;
  return (
    <>
      <PickerButton
        label={label ?? t('client.home.country')}
        value={
          selected
            ? `${selected.flag ?? countryFlag(selected.code)} ${name(selected)}`
            : t('client.home.anyCountry')
        }
        onClick={() => setOpen(true)}
        className={className}
      />
      <OptionSheet
        open={open}
        onOpenChange={setOpen}
        title={t('components.country.title')}
        options={data.map((c) => ({
          id: c.id,
          label: name(c),
          prefix: c.flag ?? countryFlag(c.code),
        }))}
        value={value}
        onSelect={onChange}
        allowEmpty={allowEmpty}
        emptyLabel={t('client.home.anyCountry')}
      />
    </>
  );
}

export function CityPicker({
  countryId,
  value,
  onChange,
  allowEmpty,
  label,
  className,
}: {
  countryId: string | null;
  value: string | null;
  onChange: (
    cityId: string | null,
    city?: { latitude: number | null; longitude: number | null; timezone: string },
  ) => void;
  allowEmpty?: boolean;
  label?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { data = [] } = useCities(countryId);
  const [open, setOpen] = useState(false);
  const selected = data.find((c) => c.id === value);
  const name = (c: (typeof data)[number]) =>
    i18n.language === 'en' && c.nameEn ? c.nameEn : c.name;
  return (
    <>
      <PickerButton
        label={label ?? t('client.home.city')}
        value={selected ? name(selected) : t('client.home.anyCity')}
        onClick={() => countryId && setOpen(true)}
        className={cn(!countryId && 'opacity-60', className)}
      />
      <OptionSheet
        open={open}
        onOpenChange={setOpen}
        title={label ?? t('client.home.city')}
        options={data.map((c) => ({ id: c.id, label: name(c) }))}
        value={value}
        onSelect={(id) => {
          const city = data.find((c) => c.id === id);
          onChange(
            id,
            city
              ? { latitude: city.latitude, longitude: city.longitude, timezone: city.timezone }
              : undefined,
          );
        }}
        allowEmpty={allowEmpty}
        emptyLabel={t('client.home.anyCity')}
      />
    </>
  );
}

export function CategoryChips({
  value,
  onChange,
  categories: provided,
  className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  categories?: CategoryDto[];
  className?: string;
}) {
  const { i18n } = useTranslation();
  const { data } = useCategories();
  const categories = provided ?? data ?? [];
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1', className)}>
      {categories.map((c) => (
        <Chip key={c.id} active={value.includes(c.id)} onClick={() => toggle(c.id)}>
          <span aria-hidden>{c.emoji}</span>
          {categoryName(c, i18n.language)}
        </Chip>
      ))}
    </div>
  );
}

export function CategoryGrid({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { i18n } = useTranslation();
  const { data = [] } = useCategories();
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="grid grid-cols-2 gap-2">
      {data.map((c) => {
        const active = value.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(c.id)}
            className={cn(
              'flex min-h-14 items-center gap-2.5 rounded-2xl px-3 text-left text-[15px] font-medium transition-all active:scale-[0.98]',
              active ? 'bg-foreground text-background shadow-lg' : 'glass',
            )}
          >
            <span className="text-xl" aria-hidden>
              {c.emoji}
            </span>
            {categoryName(c, i18n.language)}
          </button>
        );
      })}
    </div>
  );
}

const PHONE_COUNTRIES: CountryCode[] = [
  'RU',
  'KZ',
  'BY',
  'UZ',
  'KG',
  'AM',
  'GE',
  'AZ',
  'RS',
  'TR',
  'AE',
  'CY',
  'DE',
  'US',
  'GB',
];

export function PhoneInput({
  value,
  country,
  onChange,
  onCountryChange,
  invalid,
  id,
}: {
  value: string;
  country: string;
  onChange: (value: string) => void;
  onCountryChange: (country: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const code = callingCodeOf(country);
  const display = useMemo(() => {
    if (!value) return '';
    const digits = value.startsWith('+') ? value : value;
    return new AsYouType(country as CountryCode).input(digits);
  }, [value, country]);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass flex h-12 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[15px] font-medium"
        aria-label={t('components.country.title')}
      >
        <span className="text-lg">{countryFlag(country)}</span>
        <span className="text-muted-foreground">{code}</span>
      </button>
      <GlassInput
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        aria-invalid={invalid}
        value={display}
        onChange={(e) => onChange(e.target.value)}
        placeholder="900 000-00-00"
        className="flex-1"
      />
      <OptionSheet
        open={open}
        onOpenChange={setOpen}
        title={t('components.country.title')}
        options={PHONE_COUNTRIES.map((c) => ({
          id: c,
          label: `${c} ${callingCodeOf(c)}`,
          prefix: countryFlag(c),
        }))}
        value={country}
        onSelect={(id) => id && onCountryChange(id)}
      />
    </div>
  );
}
