import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatPhone } from '@nail-crm/shared';
import { useBlacklist, useBlacklistMutations } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ListSkeleton } from '@/components/layout/states';
import { PhoneInput } from '@/components/domain/pickers';
import { Field, GlassButton, GlassCard, GlassInput, GlassSheet } from '@/components/ui/glass';

export default function BlacklistPage() {
  const { t } = useTranslation();
  const list = useBlacklist();
  const { add, remove } = useBlacklistMutations();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ username: '', phone: '', phoneCountry: 'RU', reason: '' });
  return (
    <Page
      title={t('master.blacklist.title')}
      back
      actions={
        <GlassButton
          size="icon"
          variant="primary"
          aria-label={t('master.blacklist.add')}
          onClick={() => setOpen(true)}
        >
          <Plus />
        </GlassButton>
      }
    >
      <GlassCard className="flex gap-3 text-[14px] text-muted-foreground">
        <ShieldAlert className="size-5 shrink-0 text-primary" />
        {t('master.blacklist.hint')}
      </GlassCard>
      <GlassButton asChild block>
        <Link to="/master/blacklist/screen">{t('master.blacklist.editScreen')}</Link>
      </GlassButton>
      {list.isLoading ? (
        <ListSkeleton />
      ) : !list.data?.length ? (
        <EmptyState emoji="🛡" title={t('master.blacklist.empty')} />
      ) : (
        <GlassCard className="flex flex-col divide-y divide-border p-0">
          {list.data.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">
                  {[e.username ? `@${e.username}` : null, e.phone ? formatPhone(e.phone) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {e.reason ? (
                  <div className="truncate text-[12px] text-muted-foreground">{e.reason}</div>
                ) : null}
              </div>
              <GlassButton
                size="icon-sm"
                variant="destructive"
                aria-label={t('master.blacklist.remove')}
                onClick={() =>
                  remove.mutate(e.id, {
                    onSuccess: () => toast.success(t('master.blacklist.removed')),
                  })
                }
              >
                <Trash2 />
              </GlassButton>
            </div>
          ))}
        </GlassCard>
      )}
      <GlassSheet
        open={open}
        onOpenChange={setOpen}
        title={t('master.blacklist.add')}
        footer={
          <GlassButton
            variant="primary"
            size="lg"
            block
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                {
                  username: draft.username || null,
                  phone: draft.phone || null,
                  phoneCountry: draft.phoneCountry,
                  reason: draft.reason || null,
                },
                {
                  onSuccess: () => {
                    toast.success(t('master.blacklist.added'));
                    setOpen(false);
                    setDraft({ username: '', phone: '', phoneCountry: 'RU', reason: '' });
                  },
                },
              )
            }
          >
            {t('master.blacklist.add')}
          </GlassButton>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t('master.blacklist.username')}>
            <GlassInput
              value={draft.username}
              placeholder="@username"
              autoCapitalize="none"
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            />
          </Field>
          <Field label={t('master.blacklist.phone')}>
            <PhoneInput
              value={draft.phone}
              country={draft.phoneCountry}
              onChange={(phone) => setDraft((d) => ({ ...d, phone }))}
              onCountryChange={(phoneCountry) => setDraft((d) => ({ ...d, phoneCountry }))}
            />
          </Field>
          <Field label={t('master.blacklist.reason')}>
            <GlassInput
              value={draft.reason}
              onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
            />
          </Field>
        </div>
      </GlassSheet>
    </Page>
  );
}
