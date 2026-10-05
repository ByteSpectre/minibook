import { ArrowDown, ArrowUp, Clock, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ServiceDto } from '@nail-crm/shared';
import {
  useMasterCategories,
  useMasterProfile,
  useServiceMutations,
  useServices,
  useSetMasterCategories,
} from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ListSkeleton } from '@/components/layout/states';
import { categoryName } from '@/components/domain/MasterCard';
import { CategoryChips } from '@/components/domain/pickers';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import {
  Chip,
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSheet,
  GlassTextarea,
  SectionTitle,
} from '@/components/ui/glass';
import { Switch } from '@/components/ui/switch';
import { assetUrl } from '@/lib/assets';
import { formatDuration, formatPrice } from '@/lib/format';
import { confirmDialog } from '@/lib/telegram';

interface Draft {
  id?: string;
  name: string;
  description: string;
  price: string;
  duration: string;
  categoryId: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

const emptyDraft: Draft = {
  name: '',
  description: '',
  price: '',
  duration: '60',
  categoryId: null,
  imageUrl: null,
  isActive: true,
};

export default function ServicesPage() {
  const { t, i18n } = useTranslation();
  const profile = useMasterProfile();
  const services = useServices();
  const categories = useMasterCategories();
  const setCategories = useSetMasterCategories();
  const { create, update, remove, reorder } = useServiceMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const currency = profile.data?.currency ?? 'RUB';
  useEffect(() => {
    if (categories.data) setSelectedCats(categories.data.selectedIds);
  }, [categories.data]);

  const open = (s?: ServiceDto) =>
    setDraft(
      s
        ? {
            id: s.id,
            name: s.name,
            description: s.description ?? '',
            price: String(s.price),
            duration: String(s.duration),
            categoryId: s.categoryId,
            imageUrl: s.imageUrl,
            isActive: s.isActive,
          }
        : { ...emptyDraft, categoryId: categories.data?.selectedIds[0] ?? null },
    );

  const save = () => {
    if (!draft) return;
    const input = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: Number(draft.price) || 0,
      duration: Number(draft.duration) || 0,
      categoryId: draft.categoryId,
      imageUrl: draft.imageUrl,
      isActive: draft.isActive,
    };
    const onSuccess = () => {
      toast.success(t('master.services.saved'));
      setDraft(null);
    };
    if (draft.id) update.mutate({ id: draft.id, input }, { onSuccess });
    else create.mutate(input, { onSuccess });
  };

  const move = (index: number, dir: -1 | 1) => {
    const list = [...(services.data ?? [])];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
    reorder.mutate(list.map((s) => s.id));
  };

  const categoryOptions = categories.data?.all ?? [];

  return (
    <Page
      title={t('master.services.title')}
      back
      actions={
        <GlassButton
          size="icon"
          variant="primary"
          aria-label={t('master.services.add')}
          onClick={() => open()}
        >
          <Plus />
        </GlassButton>
      }
    >
      <section>
        <SectionTitle>{t('master.services.categories')}</SectionTitle>
        <p className="-mt-1 mb-2 px-1 text-[12px] text-muted-foreground">
          {t('master.services.categoriesHint')}
        </p>
        <CategoryChips
          value={selectedCats}
          onChange={(ids) => {
            if (!ids.length) return;
            setSelectedCats(ids);
            setCategories.mutate(ids);
          }}
        />
      </section>

      {services.isLoading ? (
        <ListSkeleton />
      ) : !services.data?.length ? (
        <EmptyState
          emoji="💅"
          title={t('master.services.empty')}
          action={
            <GlassButton variant="primary" onClick={() => open()}>
              {t('master.services.add')}
            </GlassButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {services.data.map((s, i) => {
            const cat = categoryOptions.find((c) => c.id === s.categoryId);
            return (
              <GlassCard key={s.id} className="flex items-center gap-3 p-2.5">
                <button
                  type="button"
                  onClick={() => open(s)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="size-[60px] shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {s.imageUrl ? (
                      <img src={assetUrl(s.imageUrl)} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl">
                        {cat?.emoji ?? '✨'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-medium">{s.name}</span>
                      {!s.isActive ? (
                        <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Clock className="size-3.5" /> {formatDuration(s.duration)}{' '}
                      {cat ? `· ${categoryName(cat, i18n.language)}` : ''}
                    </div>
                    <div className="text-[14px] font-semibold">
                      {formatPrice(s.price, currency)}
                    </div>
                  </div>
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={t('master.services.moveUp')}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex size-8 items-center justify-center rounded-full bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('master.services.moveDown')}
                    disabled={i === services.data.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex size-8 items-center justify-center rounded-full bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <GlassSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('master.services.edit') : t('master.services.add')}
        footer={
          <div className="flex gap-2">
            {draft?.id ? (
              <GlassButton
                variant="destructive"
                size="lg"
                aria-label={t('common.delete')}
                onClick={async () => {
                  if (
                    !draft.id ||
                    !(await confirmDialog(
                      t('master.services.deleteConfirm'),
                      t('common.delete'),
                      t('common.cancel'),
                    ))
                  )
                    return;
                  remove.mutate(draft.id, {
                    onSuccess: () => (toast.success(t('master.services.deleted')), setDraft(null)),
                  });
                }}
              >
                <Trash2 />
              </GlassButton>
            ) : null}
            <GlassButton
              variant="primary"
              size="lg"
              className="flex-1"
              loading={create.isPending || update.isPending}
              onClick={save}
            >
              {t('common.save')}
            </GlassButton>
          </div>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <SinglePhotoUploader
                endpoint="/api/master/upload"
                kind="service"
                value={draft.imageUrl}
                onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
                size={84}
              />
              <Field label={t('master.services.name')} className="flex-1">
                <GlassInput
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('master.services.price')}>
                <GlassInput
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) =>
                    setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })
                  }
                />
              </Field>
              <Field label={t('master.services.duration')}>
                <GlassInput
                  inputMode="numeric"
                  value={draft.duration}
                  onChange={(e) =>
                    setDraft({ ...draft, duration: e.target.value.replace(/\D/g, '') })
                  }
                />
              </Field>
            </div>
            <Field label={t('master.services.category')}>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!draft.categoryId}
                  onClick={() => setDraft({ ...draft, categoryId: null })}
                >
                  {t('master.services.noCategory')}
                </Chip>
                {categoryOptions
                  .filter((c) => selectedCats.includes(c.id) || c.id === draft.categoryId)
                  .map((c) => (
                    <Chip
                      key={c.id}
                      active={draft.categoryId === c.id}
                      onClick={() => setDraft({ ...draft, categoryId: c.id })}
                    >
                      {c.emoji} {categoryName(c, i18n.language)}
                    </Chip>
                  ))}
              </div>
            </Field>
            <Field label={t('master.services.description')}>
              <GlassTextarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <label className="flex items-center justify-between text-[15px]">
              {t('master.services.active')}
              <Switch
                checked={draft.isActive}
                onCheckedChange={(isActive) => setDraft({ ...draft, isActive })}
              />
            </label>
          </div>
        ) : null}
      </GlassSheet>
    </Page>
  );
}
