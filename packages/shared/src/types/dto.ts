import type {
  AppointmentStatus,
  BroadcastSegment,
  DayPeriodKey,
  FunnelEventType,
  Gender,
  InviteStatus,
  Language,
  LoyaltyType,
  PaymentStatus,
  PromoType,
  Role,
  SubStatus,
  TenantKind,
  ThemePreset,
} from '../enums';
import type { ThemeValues } from '../constants';
import type { LoyaltyProgress } from '../utils/loyalty';

/* ───────────── Common ───────────── */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  emoji: string | null;
  imageUrl: string | null;
}

export interface CountryDto {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  flag: string | null;
}

export interface CityDto {
  id: string;
  countryId: string;
  name: string;
  nameEn: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AccessDto {
  /** Effective status right now. */
  status: SubStatus;
  /** Stored status of the tenant itself (may differ for salon members). */
  ownStatus: SubStatus;
  source: TenantKind | 'salon-member';
  endsAt: string | null;
  daysLeft: number;
  isPublic: boolean;
  canRead: boolean;
  canWrite: boolean;
  canNotify: boolean;
  canExport: boolean;
  autoRenewEnabled: boolean;
}

export interface ThemeDto extends ThemeValues {
  preset: ThemePreset | null;
}

/* ───────────── Auth ───────────── */

export interface MeDto {
  user: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    language: Language;
    languageCode: string | null;
  };
  roles: Role[];
  isOwner: boolean;
  clientOnboarded: boolean;
  master: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    access: AccessDto;
  } | null;
  salon: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    access: AccessDto;
  } | null;
  pendingInvites: PendingInviteDto[];
}

export interface AuthResponse {
  token: string;
  me: MeDto;
}

export interface PendingInviteDto {
  id: string;
  salonId: string;
  salonName: string;
  salonSlug: string;
  salonAvatarUrl: string | null;
  code: string;
  expiresAt: string;
}

/* ───────────── Client ───────────── */

export interface ClientProfileDto {
  id: string;
  firstName: string | null;
  gender: Gender;
  birthday: string;
  username: string | null;
  phone: string;
  phoneCountry: string | null;
  avatarUrl: string | null;
  slotAlertsEnabled: boolean;
  broadcastEnabled: boolean;
  language: Language;
  onboardingCompleted: boolean;
}

export interface MyMasterDto {
  clientId: string;
  master: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    categories: CategoryDto[];
    ratingAvg: number;
    ratingCount: number;
    isOnlineNow: boolean;
    isAvailable: boolean;
    salonName: string | null;
  };
  notificationsEnabled: boolean;
  completedVisits: number;
  lastVisitAt: string | null;
  loyaltyProgress: LoyaltyProgress | null;
  referralLink: string;
}

export interface AppointmentServiceDto {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  duration: number;
}

export interface ReviewDto {
  id: string;
  clientName: string;
  rating: number;
  comment: string | null;
  photos: string[];
  isPublished: boolean;
  createdAt: string;
  appointmentId: string | null;
}

export interface ClientAppointmentDto {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  currency: string;
  master: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    username: string | null;
  };
  services: AppointmentServiceDto[];
  price: number | null;
  originalPrice: number | null;
  discountPct: number | null;
  comment: string | null;
  photos: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  clientConfirmedAt: string | null;
  canCancel: boolean;
  canReschedule: boolean;
  canReview: boolean;
  canRepeat: boolean;
  review: ReviewDto | null;
}

/* ───────────── Search & public ───────────── */

export interface SearchCardDto {
  type: TenantKind;
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  categories: CategoryDto[];
  cityName: string | null;
  countryFlag: string | null;
  address: string | null;
  ratingAvg: number;
  ratingCount: number;
  isOnlineNow: boolean;
  maxDiscountPct: number | null;
  latitude: number | null;
  longitude: number | null;
  mastersCount: number | null;
  distanceKm: number | null;
  priceFrom: number | null;
  currency: string;
}

export type SearchResponse = Paginated<SearchCardDto>;

export interface MapPointDto {
  type: TenantKind;
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  isOnlineNow: boolean;
  ratingAvg: number;
  ratingCount: number;
  maxDiscountPct: number | null;
  categories: CategoryDto[];
}

export interface ServiceDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  duration: number;
  categoryId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ServiceGroupDto {
  category: CategoryDto | null;
  services: ServiceDto[];
}

export interface PromotionDto {
  id: string;
  title: string;
  description: string | null;
  serviceId: string | null;
  serviceName: string | null;
  discountPct: number;
  validFrom: string;
  validTo: string;
  daysOfWeek: number[];
  timeFrom: string | null;
  timeTo: string | null;
  isActive: boolean;
}

export interface LoyaltyRuleDto {
  id: string;
  type: LoyaltyType;
  threshold: number | null;
  discountPct: number;
  isActive: boolean;
}

export interface BlockedScreenDto {
  title: string;
  text: string;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
}

export interface PublicMasterDto {
  id: string;
  slug: string;
  name: string;
  username: string | null;
  channelUsername: string | null;
  avatarUrl: string | null;
  rules: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cityName: string | null;
  countryName: string | null;
  timezone: string;
  currency: string;
  categories: CategoryDto[];
  ratingAvg: number;
  ratingCount: number;
  isOnlineNow: boolean;
  onlineOpenUntil: string | null;
  allowMultiService: boolean;
  theme: ThemeDto;
  promotions: PromotionDto[];
  serviceGroups: ServiceGroupDto[];
  loyaltyRules: LoyaltyRuleDto[];
  loyaltyProgress: LoyaltyProgress | null;
  reviews: ReviewDto[];
  salon: { slug: string; name: string } | null;
}

export interface PublicSalonMasterDto {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  categories: CategoryDto[];
  ratingAvg: number;
  ratingCount: number;
  isOnlineNow: boolean;
  servicesCount: number;
  priceFrom: number | null;
}

export interface PublicSalonDto {
  id: string;
  slug: string;
  name: string;
  username: string | null;
  channelUsername: string | null;
  avatarUrl: string | null;
  rules: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cityName: string | null;
  countryName: string | null;
  timezone: string;
  currency: string;
  categories: CategoryDto[];
  ratingAvg: number;
  ratingCount: number;
  isOnlineNow: boolean;
  theme: ThemeDto;
  masters: PublicSalonMasterDto[];
  services: (ServiceDto & { masterId: string; masterName: string })[];
  promotions: (PromotionDto & { masterId: string; masterSlug: string; masterName: string })[];
  reviews: ReviewDto[];
}

export type PublicPageResponse =
  | { kind: 'master'; master: PublicMasterDto }
  | { kind: 'salon'; salon: PublicSalonDto }
  | { kind: 'blocked'; screen: BlockedScreenDto }
  | { kind: 'expired'; name: string; avatarUrl: string | null };

export interface CheckAccessResponse {
  allowed: boolean;
  reason: 'blocked' | 'expired' | null;
  screen: BlockedScreenDto | null;
  contact: {
    firstName: string | null;
    phone: string | null;
    phoneCountry: string | null;
    username: string | null;
  };
  clientId: string | null;
}

export interface SlotDto {
  startAt: string;
  time: string;
  discountPct: number | null;
}

export interface SlotsResponse {
  date: string;
  timezone: string;
  durationMin: number;
  periods: { key: DayPeriodKey; emoji: string; slots: SlotDto[] }[];
  totalSlots: number;
}

export interface AvailabilityResponse {
  timezone: string;
  days: { date: string; available: boolean }[];
  firstAvailable: string | null;
}

export interface QuoteResponse {
  durationMin: number;
  totalPrice: number;
  discountPct: number | null;
  discountSource: {
    source: 'loyalty' | 'promotion';
    loyaltyType?: LoyaltyType;
    title?: string;
  } | null;
  finalPrice: number;
  currency: string;
}

export interface BookingResponse {
  appointment: ClientAppointmentDto;
  icsUrl: string;
}

export interface UploadResponse {
  url: string;
  width: number;
  height: number;
}

/* ───────────── Master ───────────── */

export interface MasterProfileDto {
  id: string;
  slug: string;
  name: string;
  username: string | null;
  channelUsername: string | null;
  avatarUrl: string | null;
  rules: string | null;
  countryId: string | null;
  cityId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  categoryIds: string[];
  categories: CategoryDto[];
  autoConfirm: boolean;
  allowMultiService: boolean;
  postVisitMessage: string | null;
  isOnlineOpen: boolean;
  onlineOpenUntil: string | null;
  ratingAvg: number;
  ratingCount: number;
  salon: { id: string; slug: string; name: string } | null;
  access: AccessDto;
  publicLink: string;
  createdAt: string;
}

export interface ScheduleDayDto {
  dayOfWeek: number;
  isWorking: boolean;
  intervals: { start: string; end: string }[];
}

export interface MasterSettingsDto {
  slotStep: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  bookingHorizonDays: number;
  morningEnabled: boolean;
  morningStart: string;
  morningEnd: string;
  dayEnabled: boolean;
  dayStart: string;
  dayEnd: string;
  eveningEnabled: boolean;
  eveningStart: string;
  eveningEnd: string;
  nightEnabled: boolean;
  nightStart: string;
  nightEnd: string;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  dailyReminderSendEmpty: boolean;
  morningSummaryEnabled: boolean;
  slotAlertsEnabled: boolean;
  onlineDurationHours: number;
}

export interface TimeBlockDto {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface MasterAppointmentDto {
  id: string;
  masterId: string;
  masterName: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  client: {
    id: string;
    firstName: string | null;
    phone: string | null;
    username: string | null;
    visitsCount: number;
    isNew: boolean;
  };
  services: AppointmentServiceDto[];
  price: number | null;
  originalPrice: number | null;
  discountPct: number | null;
  discountSource: string | null;
  clientComment: string | null;
  photos: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  clientConfirmedAt: string | null;
  clientLate: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ScheduleDayResponse {
  date: string;
  timezone: string;
  appointments: MasterAppointmentDto[];
  timeBlocks: TimeBlockDto[];
  working: { start: string; end: string }[];
}

export interface MasterClientDto {
  id: string;
  firstName: string | null;
  phone: string | null;
  username: string | null;
  gender: Gender | null;
  birthday: string | null;
  notes: string | null;
  visitsCount: number;
  totalSpent: number;
  lastVisitAt: string | null;
  nextAppointmentAt: string | null;
  isBlacklisted: boolean;
  hasTelegram: boolean;
  createdAt: string;
  masterId: string;
  masterName: string;
}

export interface MasterClientDetailDto extends MasterClientDto {
  appointments: MasterAppointmentDto[];
  loyaltyProgress: LoyaltyProgress | null;
  noShowCount: number;
  lateCount: number;
}

export interface DashboardDto {
  todayCount: number;
  weekClients: number;
  monthRevenue: number;
  avgCheck: number;
  currency: string;
  timezone: string;
  revenue30d: { date: string; amount: number }[];
  loadByWeekday: { dayOfWeek: number; count: number; minutes: number }[];
  topClients: { id: string; name: string; visits: number; spent: number }[];
  topServices: { id: string; name: string; count: number; revenue: number }[];
  sleepingClients: {
    id: string;
    name: string;
    lastVisitAt: string;
    daysSince: number;
    hasTelegram: boolean;
  }[];
  monthLoadPct: number;
  gender: { gender: Gender | 'UNKNOWN'; count: number }[];
  ages: { bucket: string; count: number }[];
  upcoming: MasterAppointmentDto[];
  pendingCount: number;
  isOnlineOpen: boolean;
  onlineOpenUntil: string | null;
}

export interface AnalyticsDto {
  periodDays: number;
  currency: string;
  timezone: string;
  totals: {
    revenue: number;
    completed: number;
    cancelled: number;
    noShow: number;
    avgCheck: number;
    newClients: number;
    returningClients: number;
    cancellationRatePct: number;
  };
  revenueByDay: { date: string; amount: number; count: number }[];
  byService: { id: string; name: string; count: number; revenue: number }[];
  byWeekday: { dayOfWeek: number; count: number }[];
  byHour: { hour: number; count: number }[];
  byMaster: { id: string; name: string; count: number; revenue: number }[];
  gender: { gender: Gender | 'UNKNOWN'; count: number }[];
  ages: { bucket: string; count: number }[];
}

export interface BlacklistEntryDto {
  id: string;
  username: string | null;
  phone: string | null;
  reason: string | null;
  createdAt: string;
}

export interface BroadcastDto {
  id: string;
  segment: BroadcastSegment;
  text: string;
  imageUrl: string | null;
  sentAt: string;
  recipients: number;
  masterId: string;
}

export interface BroadcastPreviewResponse {
  total: number;
  reachable: number;
  sample: { id: string; name: string }[];
  canSendToday: boolean;
  nextAvailableAt: string | null;
}

export interface SubscriptionDto {
  kind: TenantKind;
  access: AccessDto;
  priceRub: number;
  basePriceRub: number;
  periodDays: number;
  pendingDiscountPct: number | null;
  autoRenewEnabled: boolean;
  hasSavedPaymentMethod: boolean;
  paywall: { title: string | null; text: string | null };
  provider: 'yookassa' | 'mock';
  referralLink: string | null;
  referralsCount: number;
  coveredBySalon: { id: string; name: string } | null;
}

export interface PaymentDto {
  id: string;
  amountRub: number;
  periodDays: number;
  status: PaymentStatus;
  isAutoPayment: boolean;
  paidAt: string | null;
  createdAt: string;
  description: string | null;
}

export interface CreatePaymentResponse {
  paymentId: string;
  confirmationUrl: string;
  provider: 'yookassa' | 'mock';
  amountRub: number;
}

export interface ShareDto {
  link: string;
  startParam: string;
  botUsername: string;
  name: string;
  avatarUrl: string | null;
}

/* ───────────── Salon ───────────── */

export interface SalonProfileDto {
  id: string;
  slug: string;
  name: string;
  username: string | null;
  channelUsername: string | null;
  avatarUrl: string | null;
  rules: string | null;
  countryId: string | null;
  cityId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  categoryIds: string[];
  categories: CategoryDto[];
  access: AccessDto;
  publicLink: string;
  mastersCount: number;
  createdAt: string;
}

export interface SalonMasterDto {
  id: string;
  slug: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  appointmentsCount: number;
  monthRevenue: number;
  upcomingCount: number;
  isOnlineOpen: boolean;
}

export interface SalonInviteDto {
  id: string;
  code: string;
  invitedUsername: string | null;
  status: InviteStatus;
  link: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  master: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface InviteByUsernameResponse {
  invite: SalonInviteDto;
  delivered: boolean;
  userFound: boolean;
}

export interface JoinSalonPreviewDto {
  salon: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    cityName: string | null;
    mastersCount: number;
  };
  invite: { id: string; status: InviteStatus; expiresAt: string; valid: boolean };
  alreadyMember: boolean;
  isMaster: boolean;
}

/* ───────────── Platform admin ───────────── */

export interface AdminStatsDto {
  users: number;
  clients: number;
  masters: number;
  salons: number;
  byStatus: Record<SubStatus, number>;
  salonsByStatus: Record<SubStatus, number>;
  mrrRub: number;
  revenue30dRub: number;
  payments30d: number;
  appointments30d: number;
  newMasters7d: number;
  newSalons7d: number;
  revenueByDay: { date: string; amount: number }[];
  topMasters: { id: string; name: string; slug: string; revenue: number; appointments: number }[];
}

export interface AdminTenantRowDto {
  id: string;
  kind: TenantKind;
  slug: string;
  name: string;
  username: string | null;
  ownerTelegramId: string | null;
  cityName: string | null;
  status: SubStatus;
  effectiveStatus: SubStatus;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  autoRenewEnabled: boolean;
  bannedReason: string | null;
  createdAt: string;
  appointmentsCount: number;
  paidTotalRub: number;
  mastersCount: number | null;
  salonName: string | null;
  experimentVariant: string | null;
}

export interface AdminPaymentRowDto extends PaymentDto {
  provider: string;
  externalId: string;
  tenant: { kind: TenantKind; id: string; name: string; slug: string } | null;
}

export interface FunnelDto {
  steps: { key: FunnelEventType | 'USERS'; label: string; count: number; conversionPct: number }[];
  byRole: {
    role: 'MASTER' | 'SALON';
    started: number;
    completed: number;
    firstAppointment: number;
    subscribed: number;
    churned: number;
  }[];
  weekly: { week: string; newUsers: number; newMasters: number; subscribed: number }[];
}

export interface AdminCategoryDto extends CategoryDto {
  sortOrder: number;
  isActive: boolean;
  mastersCount: number;
}

export interface AdminCountryDto extends CountryDto {
  sortOrder: number;
  isActive: boolean;
  citiesCount: number;
}

export interface AdminCityDto extends CityDto {
  sortOrder: number;
  isActive: boolean;
  mastersCount: number;
}

export interface PromoCodeDto {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  maxUsages: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ExperimentDto {
  id: string;
  name: string;
  hypothesis: string | null;
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  splitPercent: number;
  isActive: boolean;
  createdAt: string;
  results: { variant: 'A' | 'B'; assigned: number; paid: number; conversionPct: number }[];
}

export interface PlatformSettingsDto {
  masterPriceRub: number;
  salonPriceRub: number;
  trialDays: number;
  referralBonusDays: number;
  weeklyDigestEnabled: boolean;
  periodDays: number;
  paymentProvider: 'yookassa' | 'mock';
  botConnected: boolean;
  yandexMapsConfigured: boolean;
}

export interface DevOutboxMessage {
  id: string;
  chatId: string;
  text: string;
  photo: string | null;
  buttons: { text: string; url?: string; callbackData?: string; webAppUrl?: string }[][];
  sentAt: string;
  kind: string;
}

export interface OnboardingDraftDto {
  step: number;
  data: Record<string, unknown>;
}
