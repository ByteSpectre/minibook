import {
  ArrowDown,
  ArrowUp,
  Clock,
  Download,
  EyeOff,
  Layers,
  Lightbulb,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import type { CategoryDto, ServiceDto } from '@nail-crm/shared';
import {
  useMasterCategories,
  useMasterProfile,
  useServiceMutations,
  useServices,
  useSetMasterCategories,
} from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ListSkeleton } from '@/components/layout/states';
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
import { OnboardingSteps, StickyBottomBar } from '@/components/ui/master-ui';
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

const DURATION_PRESETS = [30, 45, 60, 90, 120] as const;

type ServiceGroup = {
  key: string | null;
  category: CategoryDto | null;
  services: ServiceDto[];
};

export default function ServicesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const profile = useMasterProfile();
  const services = useServices();
  const categories = useMasterCategories();
  const setCategories = useSetMasterCategories();
  const { create, update, remove, reorder } = useServiceMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const currency = profile.data?.currency ?? 'RUB';

  useEffect(() => {
    if (categories.data) setSelectedCats(categories.data.selectedIds);
  }, [categories.data]);

  const categoryOptions = categories.data?.all ?? [];
  const list = services.data ?? [];

  const groups = useMemo((): ServiceGroup[] => {
    const map = new Map<string | null, ServiceDto[]>();
    for (const s of list) {
      const key = s.categoryId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const orderedKeys = [
      ...selectedCats.filter((id) => map.has(id)),
      ...[...map.keys()].filter((k) => k !== null && !selectedCats.includes(k)),
      ...(map.has(null) ? [null] : []),
    ];
    const seen = new Set<string | null>();
    return orderedKeys
      .filter((k) => {
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((key) => ({
        key,
        category: key ? (categoryOptions.find((c) => c.id === key) ?? null) : null,
        services: map.get(key) ?? [],
      }));
  }, [list, selectedCats, categoryOptions]);

  const catCount = new Set(list.map((s) => s.categoryId).filter(Boolean)).size;

  const open = (s?: ServiceDto, categoryId?: string | null) => {
    setCustomDuration(false);
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
        : {
            ...emptyDraft,
            categoryId: categoryId ?? categories.data?.selectedIds[0] ?? null,
          },
    );
    if (s && !DURATION_PRESETS.includes(s.duration as (typeof DURATION_PRESETS)[number])) {
      setCustomDuration(true);
    }
  };

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
    const ordered = [...list];
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    reorder.mutate(ordered.map((s) => s.id));
  };

  const globalIndex = (id: string) => list.findIndex((s) => s.id === id);

  const priceRange = (items: ServiceDto[]) => {
    if (!items.length) return '';
    const prices = items.map((s) => Number(s.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max
      ? formatPrice(min, currency)
      : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
  };

  const draftCategory = draft?.categoryId
    ? categoryOptions.find((c) => c.id === draft.categoryId)
    : null;

  const onboardingSteps = [
    { title: t('master.services.onboardingStep1'), hint: t('master.services.onboardingStep1Hint') },
    { title: t('master.services.onboardingStep2'), hint: t('master.services.onboardingStep2Hint') },
  ];

  return (
    <Page
      title={t('master.services.title')}
      subtitle={t('master.services.stats', {
        count: list.length,
        cats: catCount || selectedCats.length,
      })}
      back
      bottomInset="button"
      actions={
        <GlassButton size="sm" onClick={() => navigate('/master/share')}>
          <Download className="size-4" />
          {t('master.services.priceList')}
        </GlassButton>
      }
    >
      {services.isLoading ? (
        <ListSkeleton />
      ) : !list.length ? (
        <div className="flex flex-col gap-4">
          <p className="text-center text-[17px] font-semibold">
            {t('master.services.onboardingTitle')}
          </p>
          <OnboardingSteps steps={onboardingSteps} />
          <div>
            <SectionTitle>{t('master.services.example')}</SectionTitle>
            <GlassCard className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-muted text-[14px] font-semibold">
                  2
                </span>
                <div>
                  <div className="text-[15px] font-semibold">Маникюр</div>
                  <div className="text-[12px] text-muted-foreground">
                    2 услуги · 1 500 – 2 500 ₽
                  </div>
                </div>
              </div>
              <div className="ml-11 flex flex-col gap-2">
                <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
                  <div className="text-[14px] font-medium">Комбинированный маникюр</div>
                  <div className="flex justify-between text-[12px] text-muted-foreground">
                    <span>1,5 ч</span>
                    <span>2 500 ₽</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
                  <div className="text-[14px] font-medium">Покрытие гель-лак</div>
                  <div className="flex justify-between text-[12px] text-muted-foreground">
                    <span>45 мин</span>
                    <span>1 500 ₽</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
          {showCategories ? (
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
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const title = group.category
              ? categoryName(group.category, i18n.language)
              : t('master.services.noCategory');
            const emoji = group.category?.emoji ?? '✦';
            return (
              <GlassCard
                key={group.key ?? 'none'}
                className="flex flex-col gap-0 overflow-hidden p-0"
              >
                <div className="flex items-center gap-3 p-3.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-[16px]">
                    {group.services.length ? group.services.length : <MonoEmoji>{emoji}</MonoEmoji>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{title}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {group.services.length
                        ? `${group.services.length} · ${priceRange(group.services)}`
                        : t('master.services.noServicesInCategory')}
                    </div>
                  </div>
                  <GlassButton
                    size="icon-sm"
                    aria-label={t('master.services.edit')}
                    onClick={() => setShowCategories(true)}
                  >
                    <Pencil className="size-4" />
                  </GlassButton>
                </div>
                {group.services.length ? (
                  <div className="flex flex-col divide-y divide-border border-t border-border">
                    {group.services.map((s) => {
                      const idx = globalIndex(s.id);
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-2.5">
                          <button
                            type="button"
                            onClick={() => open(s)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
                              {s.imageUrl ? (
                                <img
                                  src={assetUrl(s.imageUrl)}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-xl">
                                  <MonoEmoji>{emoji}</MonoEmoji>
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
                                <Clock className="size-3.5" /> {formatDuration(s.duration)}
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
                              disabled={idx === 0}
                              onClick={() => move(idx, -1)}
                              className="flex size-8 items-center justify-center rounded-full bg-muted disabled:opacity-30"
                            >
                              <ArrowUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={t('master.services.moveDown')}
                              disabled={idx === list.length - 1}
                              onClick={() => move(idx, 1)}
                              className="flex size-8 items-center justify-center rounded-full bg-muted disabled:opacity-30"
                            >
                              <ArrowDown className="size-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border-t border-dashed border-border p-3">
                    <div className="mb-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Lightbulb className="size-4 shrink-0" />
                      {t('master.services.startWithServices')}
                    </div>
                    <GlassButton block onClick={() => open(undefined, group.key)}>
                      {t('master.services.add')}
                    </GlassButton>
                  </div>
                )}
              </GlassCard>
            );
          })}

          {showCategories ? (
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
          ) : null}
        </div>
      )}

      <StickyBottomBar>
        <div className="flex gap-2">
          <GlassButton className="shrink-0" onClick={() => setShowCategories((v) => !v)}>
            <Layers className="size-4" />
            {t('master.services.manageCategories')}
          </GlassButton>
          <GlassButton variant="primary" block onClick={() => open()}>
            <Plus className="size-4" />
            {t('master.services.add')}
          </GlassButton>
        </div>
      </StickyBottomBar>

      <GlassSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('master.services.edit') : t('master.services.newService')}
        description={
          draftCategory
            ? t('master.services.inCategory', {
                name: categoryName(draftCategory, i18n.language),
              })
            : undefined
        }
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
            <Field label={t('master.services.category')} required>
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
                      <MonoEmoji>{c.emoji}</MonoEmoji> {categoryName(c, i18n.language)}
                    </Chip>
                  ))}
              </div>
            </Field>
            <Field label={t('master.services.name')} required>
              <GlassInput
                value={draft.name}
                placeholder={t('master.services.name')}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field
              label={
                <>
                  {t('master.services.description')}{' '}
                  <span className="font-normal text-muted-foreground">
                    {t('master.services.descriptionOptional')}
                  </span>
                </>
              }
            >
              <GlassTextarea
                value={draft.description}
                placeholder={t('master.services.description')}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <Field label={t('master.services.image')}>
              <SinglePhotoUploader
                endpoint="/api/master/upload"
                kind="service"
                value={draft.imageUrl}
                onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
                size={84}
              />
              <p className="mt-1.5 px-1 text-[12px] text-muted-foreground">
                {t('master.services.photoHint')}
              </p>
            </Field>
            <Field label={t('master.services.price')}>
              <GlassInput
                inputMode="decimal"
                value={draft.price}
                placeholder="2 500"
                onChange={(e) =>
                  setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })
                }
              />
            </Field>
            <Field label={t('master.services.duration')}>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((mins) => (
                  <Chip
                    key={mins}
                    active={!customDuration && Number(draft.duration) === mins}
                    onClick={() => {
                      setCustomDuration(false);
                      setDraft({ ...draft, duration: String(mins) });
                    }}
                  >
                    {formatDuration(mins)}
                  </Chip>
                ))}
                <Chip active={customDuration} onClick={() => setCustomDuration(true)}>
                  {t('master.services.durationOther')}
                </Chip>
              </div>
              {customDuration ? (
                <GlassInput
                  className="mt-2"
                  inputMode="numeric"
                  value={draft.duration}
                  onChange={(e) =>
                    setDraft({ ...draft, duration: e.target.value.replace(/\D/g, '') })
                  }
                />
              ) : null}
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
