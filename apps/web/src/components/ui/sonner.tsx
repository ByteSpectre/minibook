import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    className="toaster group"
    position="top-center"
    offset={{ top: 'calc(var(--tg-safe-top) + 12px)' }}
    mobileOffset={{ top: 'calc(var(--tg-safe-top) + 12px)' }}
    icons={{
      success: <CircleCheckIcon className="size-4 text-success" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4 text-warning" />,
      error: <OctagonXIcon className="size-4 text-destructive" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    style={
      {
        '--normal-bg': 'var(--glass-strong)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--glass-border)',
        '--border-radius': '18px',
      } as React.CSSProperties
    }
    toastOptions={{ classNames: { toast: 'cn-toast backdrop-blur-xl shadow-lg' } }}
    {...props}
  />
);

export { Toaster };
