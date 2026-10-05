import { Plus, Trash2 } from 'lucide-react';
import { slugify } from '@nail-crm/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAdminCategories, useAdminCities, useAdminCountries } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { Switch } from '@/components/ui/switch';
import {
  Chip,
  Field,
  GlassButton,
  GlassInput,
  GlassSheet,
  ListGroup,
  ListRow,
} from '@/components/ui/glass';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { confirmDialog } from '@/lib/telegram';
import { cn } from '@/lib/utils';

type Draft = Record<string, string | boolean>;

function EditorSheet({
  open,
  title,
  onClose,
  onSave,
  onDelete,
  saving,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  saving: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <GlassSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      footer={
        <div className="flex gap-2">
          {onDelete ? (
            <GlassButton
              variant="destructive"
              size="icon"
              aria-label={t('common.delete')}
              onClick={onDelete}
            >
              <Trash2 />
            </GlassButton>
          ) : null}
          <GlassButton variant="primary" block loading={saving} onClick={onSave}>
            {t('common.save')}
          </GlassButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">{children}</div>
    </GlassSheet>
  );
}

const num = (v: string | boolean | undefined) =>
  typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined;
const str = (v: string | boolean | undefined) =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

function useEditor() {
  const [state, setState] = useState<{ id: string | null; draft: Draft } | null>(null);
  const set = (patch: Draft) =>
    setState((s) => (s ? { ...s, draft: { ...s.draft, ...patch } } : s));
  return {
    state,
    open: (id: string | null, draft: Draft) => setState({ id, draft }),
    close: () => setState(null),
    set,
  };
}

function TextField({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string | boolean | undefined; onChange: (v: string) => void } & Omit<
  React.ComponentProps<typeof GlassInput>,
  'value' | 'onChange'
>) {
  return (
    <Field label={label}>
      <GlassInput
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </Field>
  );
}

function ActiveRow({
  value,
  onChange,
}: {
  value: string | boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center justify-between px-1 py-1 text-[15px]">
      {t('admin.dict.active')}
      <Switch checked={value !== false} onCheckedChange={onChange} />
    </label>
  );
}

function CategoriesTab() {
  const { t } = useTranslation();
  const { list, save, remove } = useAdminCategories();
  const ed = useEditor();
  const d = ed.state?.draft ?? {};
  const submit = () =>
    ed.state &&
    save.mutate(
      {
        id: ed.state.id,
        input: {
          name: String(d.name ?? '').trim(),
          nameEn: str(d.nameEn),
          slug: String(d.slug ?? ''),
          emoji: str(d.emoji),
          sortOrder: num(d.sortOrder),
          isActive: d.isActive !== false,
        },
      },
      { onSuccess: () => (toast.success(t('admin.dict.saved')), ed.close()) },
    );
  return (
    <>
      <GlassButton
        variant="primary"
        block
        onClick={() => ed.open(null, { isActive: true, sortOrder: '0' })}
      >
        <Plus /> {t('admin.dict.add')}
      </GlassButton>
      {list.isLoading ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState />
      ) : (
        <ListGroup>
          {list.data.map((c) => (
            <ListRow
              key={c.id}
              className={cn(!c.isActive && 'opacity-50')}
              icon={c.emoji ?? '•'}
              title={c.name}
              subtitle={`${c.nameEn ?? '—'} · ${c.slug} · ${t('admin.dict.used', { count: c.mastersCount })}`}
              onClick={() =>
                ed.open(c.id, {
                  name: c.name,
                  nameEn: c.nameEn ?? '',
                  slug: c.slug,
                  emoji: c.emoji ?? '',
                  sortOrder: String(c.sortOrder),
                  isActive: c.isActive,
                })
              }
            />
          ))}
        </ListGroup>
      )}
      <EditorSheet
        open={!!ed.state}
        title={ed.state?.id ? t('admin.dict.edit') : t('admin.dict.add')}
        onClose={ed.close}
        onSave={submit}
        saving={save.isPending}
        onDelete={
          ed.state?.id
            ? async () => {
                if (
                  await confirmDialog(
                    t('admin.dict.deleteConfirm'),
                    t('common.delete'),
                    t('common.cancel'),
                  )
                )
                  remove.mutate(ed.state!.id!, { onSuccess: ed.close });
              }
            : undefined
        }
      >
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <TextField
            label={t('admin.dict.emoji')}
            value={d.emoji}
            maxLength={8}
            onChange={(emoji) => ed.set({ emoji })}
          />
          <TextField
            label={t('admin.dict.name')}
            value={d.name}
            onChange={(name) =>
              ed.set({ name, ...(ed.state?.id ? {} : { slug: slugify(String(d.nameEn || name)) }) })
            }
          />
        </div>
        <TextField
          label={t('admin.dict.nameEn')}
          value={d.nameEn}
          onChange={(nameEn) => ed.set({ nameEn })}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label={t('admin.dict.slug')}
            value={d.slug}
            autoCapitalize="none"
            onChange={(slug) => ed.set({ slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
          />
          <TextField
            label={t('admin.dict.sortOrder')}
            value={d.sortOrder}
            inputMode="numeric"
            onChange={(sortOrder) => ed.set({ sortOrder: sortOrder.replace(/\D/g, '') })}
          />
        </div>
        <ActiveRow value={d.isActive} onChange={(isActive) => ed.set({ isActive })} />
      </EditorSheet>
    </>
  );
}

function CountriesTab() {
  const { t } = useTranslation();
  const { list, save, remove } = useAdminCountries();
  const ed = useEditor();
  const d = ed.state?.draft ?? {};
  const submit = () =>
    ed.state &&
    save.mutate(
      {
        id: ed.state.id,
        input: {
          name: String(d.name ?? '').trim(),
          nameEn: str(d.nameEn),
          code: String(d.code ?? ''),
          flag: str(d.flag),
          sortOrder: num(d.sortOrder),
          isActive: d.isActive !== false,
        },
      },
      { onSuccess: () => (toast.success(t('admin.dict.saved')), ed.close()) },
    );
  return (
    <>
      <GlassButton
        variant="primary"
        block
        onClick={() => ed.open(null, { isActive: true, sortOrder: '0' })}
      >
        <Plus /> {t('admin.dict.add')}
      </GlassButton>
      {list.isLoading ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <ListGroup>
          {(list.data ?? []).map((c) => (
            <ListRow
              key={c.id}
              className={cn(!c.isActive && 'opacity-50')}
              icon={c.flag ?? c.code}
              title={c.name}
              subtitle={`${c.code} · ${c.nameEn ?? '—'} · ${c.citiesCount}`}
              onClick={() =>
                ed.open(c.id, {
                  name: c.name,
                  nameEn: c.nameEn ?? '',
                  code: c.code,
                  flag: c.flag ?? '',
                  sortOrder: String(c.sortOrder),
                  isActive: c.isActive,
                })
              }
            />
          ))}
        </ListGroup>
      )}
      <EditorSheet
        open={!!ed.state}
        title={ed.state?.id ? t('admin.dict.edit') : t('admin.dict.add')}
        onClose={ed.close}
        onSave={submit}
        saving={save.isPending}
        onDelete={
          ed.state?.id
            ? async () => {
                if (
                  await confirmDialog(
                    t('admin.dict.deleteConfirm'),
                    t('common.delete'),
                    t('common.cancel'),
                  )
                )
                  remove.mutate(ed.state!.id!, { onSuccess: ed.close });
              }
            : undefined
        }
      >
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <TextField
            label={t('admin.dict.flag')}
            value={d.flag}
            maxLength={8}
            onChange={(flag) => ed.set({ flag })}
          />
          <TextField
            label={t('admin.dict.name')}
            value={d.name}
            onChange={(name) => ed.set({ name })}
          />
        </div>
        <TextField
          label={t('admin.dict.nameEn')}
          value={d.nameEn}
          onChange={(nameEn) => ed.set({ nameEn })}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label={t('admin.dict.code')}
            value={d.code}
            maxLength={2}
            autoCapitalize="characters"
            onChange={(code) => ed.set({ code: code.toUpperCase().replace(/[^A-Z]/g, '') })}
          />
          <TextField
            label={t('admin.dict.sortOrder')}
            value={d.sortOrder}
            inputMode="numeric"
            onChange={(sortOrder) => ed.set({ sortOrder: sortOrder.replace(/\D/g, '') })}
          />
        </div>
        <ActiveRow value={d.isActive} onChange={(isActive) => ed.set({ isActive })} />
      </EditorSheet>
    </>
  );
}

function CitiesTab() {
  const { t } = useTranslation();
  const countries = useAdminCountries();
  const [countryId, setCountryId] = useState<string | undefined>();
  const activeCountry = countryId ?? countries.list.data?.[0]?.id;
  const { list, save, remove } = useAdminCities(
    activeCountry ? { countryId: activeCountry } : undefined,
  );
  const ed = useEditor();
  const d = ed.state?.draft ?? {};
  const submit = () =>
    ed.state &&
    save.mutate(
      {
        id: ed.state.id,
        input: {
          name: String(d.name ?? '').trim(),
          nameEn: str(d.nameEn),
          countryId: String(d.countryId ?? activeCountry ?? ''),
          timezone: String(d.timezone ?? '').trim(),
          latitude: num(d.latitude) ?? null,
          longitude: num(d.longitude) ?? null,
          sortOrder: num(d.sortOrder),
          isActive: d.isActive !== false,
        },
      },
      { onSuccess: () => (toast.success(t('admin.dict.saved')), ed.close()) },
    );
  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(countries.list.data ?? []).map((c) => (
          <Chip key={c.id} active={c.id === activeCountry} onClick={() => setCountryId(c.id)}>
            {c.flag} {c.name}
          </Chip>
        ))}
      </div>
      <GlassButton
        variant="primary"
        block
        disabled={!activeCountry}
        onClick={() =>
          ed.open(null, {
            isActive: true,
            sortOrder: '0',
            countryId: activeCountry ?? '',
            timezone: 'Europe/Moscow',
          })
        }
      >
        <Plus /> {t('admin.dict.add')}
      </GlassButton>
      {list.isLoading ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState />
      ) : (
        <ListGroup>
          {list.data.map((c) => (
            <ListRow
              key={c.id}
              className={cn(!c.isActive && 'opacity-50')}
              title={c.name}
              subtitle={`${c.timezone} · ${t('admin.dict.used', { count: c.mastersCount })}`}
              onClick={() =>
                ed.open(c.id, {
                  name: c.name,
                  nameEn: c.nameEn ?? '',
                  countryId: c.countryId,
                  timezone: c.timezone,
                  latitude: c.latitude?.toString() ?? '',
                  longitude: c.longitude?.toString() ?? '',
                  sortOrder: String(c.sortOrder),
                  isActive: c.isActive,
                })
              }
            />
          ))}
        </ListGroup>
      )}
      <EditorSheet
        open={!!ed.state}
        title={ed.state?.id ? t('admin.dict.edit') : t('admin.dict.add')}
        onClose={ed.close}
        onSave={submit}
        saving={save.isPending}
        onDelete={
          ed.state?.id
            ? async () => {
                if (
                  await confirmDialog(
                    t('admin.dict.deleteConfirm'),
                    t('common.delete'),
                    t('common.cancel'),
                  )
                )
                  remove.mutate(ed.state!.id!, { onSuccess: ed.close });
              }
            : undefined
        }
      >
        <TextField
          label={t('admin.dict.name')}
          value={d.name}
          onChange={(name) => ed.set({ name })}
        />
        <TextField
          label={t('admin.dict.nameEn')}
          value={d.nameEn}
          onChange={(nameEn) => ed.set({ nameEn })}
        />
        <TextField
          label={t('admin.dict.timezone')}
          value={d.timezone}
          autoCapitalize="none"
          placeholder="Europe/Moscow"
          onChange={(timezone) => ed.set({ timezone })}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label={t('admin.dict.latitude')}
            value={d.latitude}
            inputMode="decimal"
            onChange={(latitude) => ed.set({ latitude: latitude.replace(/[^\d.-]/g, '') })}
          />
          <TextField
            label={t('admin.dict.longitude')}
            value={d.longitude}
            inputMode="decimal"
            onChange={(longitude) => ed.set({ longitude: longitude.replace(/[^\d.-]/g, '') })}
          />
        </div>
        <TextField
          label={t('admin.dict.sortOrder')}
          value={d.sortOrder}
          inputMode="numeric"
          onChange={(sortOrder) => ed.set({ sortOrder: sortOrder.replace(/\D/g, '') })}
        />
        <ActiveRow value={d.isActive} onChange={(isActive) => ed.set({ isActive })} />
      </EditorSheet>
    </>
  );
}

export default function AdminDictionariesPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('admin.menu.dictionaries')} back bottomInset="none">
      <Tabs defaultValue="categories" className="gap-4">
        <TabsList className="glass h-11 w-full rounded-2xl p-1">
          <TabsTrigger value="categories" className="rounded-xl">
            {t('admin.menu.categories')}
          </TabsTrigger>
          <TabsTrigger value="countries" className="rounded-xl">
            {t('admin.menu.countries')}
          </TabsTrigger>
          <TabsTrigger value="cities" className="rounded-xl">
            {t('admin.menu.cities')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="flex flex-col gap-3">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="countries" className="flex flex-col gap-3">
          <CountriesTab />
        </TabsContent>
        <TabsContent value="cities" className="flex flex-col gap-3">
          <CitiesTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
