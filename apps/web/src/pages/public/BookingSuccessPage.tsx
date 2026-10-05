import { motion } from 'framer-motion';
import { CalendarPlus, Check, Clock4 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { BookingResponse, ClientAppointmentDto } from '@nail-crm/shared';
import { useMyAppointments } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { ClientAppointmentCard } from '@/components/domain/appointments';
import { GlassButton } from '@/components/ui/glass';
import { download } from '@/lib/telegram';

export default function BookingSuccessPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const state = location.state as BookingResponse | null;
  const list = useMyAppointments(!state);
  const appointment: ClientAppointmentDto | undefined =
    state?.appointment ??
    [...(list.data?.upcoming ?? []), ...(list.data?.past ?? [])].find((a) => a.id === id);
  if (!appointment) return <PageLoader />;
  const pending = appointment.status === 'PENDING';
  return (
    <Page bottomInset="none">
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="flex size-24 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background"
        >
          {pending ? <Clock4 className="size-11" /> : <Check className="size-12" strokeWidth={3} />}
        </motion.div>
        <div>
          <h1 className="font-heading text-[28px] font-bold tracking-tight">
            {pending ? t('public.success.pendingTitle') : t('public.success.title')}
          </h1>
          <p className="mx-auto mt-1 max-w-xs text-[15px] text-muted-foreground">
            {pending ? t('public.success.pendingText') : t('public.success.confirmedText')}
          </p>
        </div>
      </div>
      <ClientAppointmentCard appointment={appointment} />
      <div className="flex flex-col gap-2">
        <GlassButton
          variant="primary"
          size="lg"
          block
          onClick={() =>
            void download(state?.icsUrl ?? appointment.icsUrl, `glow-${appointment.id}.ics`)
          }
        >
          <CalendarPlus /> {t('public.success.addToCalendar')}
        </GlassButton>
        <GlassButton asChild size="lg" block>
          <Link to="/client/calendar" replace>
            {t('public.success.myAppointments')}
          </Link>
        </GlassButton>
        <GlassButton asChild variant="ghost" block>
          <Link to="/client" replace>
            {t('public.success.home')}
          </Link>
        </GlassButton>
      </div>
    </Page>
  );
}
