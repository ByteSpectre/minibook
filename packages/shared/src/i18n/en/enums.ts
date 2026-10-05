import type { DeepDict } from '../types';
import type * as ru from '../ru/enums';

export const enums: DeepDict<typeof ru.enums> = {
  subStatus: {
    TRIAL: 'Free trial',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
    BANNED: 'Suspended',
  },
  appointmentStatus: {
    PENDING: 'Awaiting confirmation',
    CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No-show',
  },
  gender: {
    MALE: 'Male',
    FEMALE: 'Female',
    UNSPECIFIED: 'Not specified',
    UNKNOWN: 'Not specified',
  },
  loyaltyType: {
    EVERY_N_VISIT: 'Every N-th visit',
    REFERRAL: 'Bring a friend',
    CUMULATIVE: 'Cumulative',
    FIRST_VISIT: 'First visit',
    BIRTHDAY: 'Birthday',
  },
  loyaltyDescription: {
    EVERY_N_VISIT: 'Every {{n}}th visit — {{pct}}% off',
    REFERRAL: 'Bring a friend — {{pct}}% off for both',
    CUMULATIVE: 'From {{n}} visits — permanent {{pct}}% off',
    FIRST_VISIT: 'Newcomers — {{pct}}% off the first visit',
    BIRTHDAY: 'Birthday ±{{n}} days — {{pct}}% off',
  },
  segment: {
    all: 'All clients',
    sleeping: 'Sleeping (60+ days)',
    birthday: 'Birthday soon',
    service: 'By service',
    demographic: 'Gender & age',
    manual: 'Pick manually',
  },
  period: {
    morning: 'Morning',
    day: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
  },
  preset: {
    classic: 'Classic',
    minimal: 'Minimal',
    liquid_glass: 'Liquid Glass',
    pink: 'Pink',
    dark: 'Dark',
  },
  role: {
    OWNER: 'Platform owner',
    MASTER: 'Master',
    SALON: 'Salon',
    CLIENT: 'Client',
  },
  inviteStatus: {
    pending: 'Invited',
    accepted: 'In salon',
    declined: 'Declined',
    expired: 'Expired',
    revoked: 'Revoked',
  },
  paymentStatus: {
    pending: 'Pending',
    waiting_for_capture: 'Waiting for capture',
    succeeded: 'Paid',
    canceled: 'Cancelled',
    refunded: 'Refunded',
  },
  promoType: {
    DISCOUNT_PERCENT: 'Discount, %',
    FREE_DAYS: 'Free days',
  },
  bgType: {
    color: 'Color',
    gradient: 'Gradient',
    image: 'Image',
  },
  funnel: {
    USERS: 'Users in the bot',
    BOT_START: 'Started the bot',
    APP_OPEN: 'Opened the app',
    ONBOARDING_STARTED: 'Started onboarding',
    ONBOARDING_COMPLETED: 'Completed onboarding',
    FIRST_APPOINTMENT: 'First appointment',
    SUBSCRIBED: 'Paid subscription',
    CHURNED: 'Churned',
  },
};
