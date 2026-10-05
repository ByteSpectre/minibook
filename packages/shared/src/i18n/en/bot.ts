import type { DeepDict } from '../types';
import type * as ru from '../ru/bot';

export const bot: DeepDict<typeof ru.bot> = {
  buttons: {
    client: "💅 I'm a client",
    master: "✂️ I'm a master",
    salon: '🏛 I own a salon',
    openApp: '📱 Open the app',
    openMaster: '✂️ Master cabinet',
    openSalon: '🏛 Salon cabinet',
    openAdmin: '📊 Platform admin',
    openSchedule: '📅 Open schedule',
    openAppointment: 'Open appointment',
    pay: '💳 Pay for subscription',
    book: '✨ Book now',
    bookAgain: '🔁 Book again',
    leaveReview: '⭐️ Leave a review',
    accept: '✅ Accept',
    decline: '✖️ Decline',
    confirmVisit: "✅ I'll be there",
    reschedule: '🔄 Reschedule',
    cancel: '❌ Cancel',
    yesCancel: 'Yes, cancel',
    keep: 'No, keep it',
    confirmAppointment: '✅ Confirm',
    route: '🗺 Directions',
    search: '🔎 Find a master',
  },
  start: {
    greeting:
      '👋 Hi, {{name}}!\n\n<b>{{app}}</b> — book beauty masters right in Telegram.\n\nWho are you?',
    welcomeBack: 'Welcome back, {{name}}! ✨\nWhere would you like to go?',
  },
  help:
    '<b>{{app}}</b> — beauty bookings.\n\n/start — choose a role\n/search — find a master\n/master — master cabinet\n/salon — salon cabinet\n/subscription — subscription status\n/promo CODE — activate a promo code\n/help — help',
  master: {
    open: 'Master cabinet:',
    notRegistered: "You don't have a master cabinet yet. Tap /start and choose “I'm a master”.",
  },
  salon: {
    open: 'Salon cabinet:',
    notRegistered: "You don't have a salon yet. Tap /start and choose “I own a salon”.",
  },
  search: { open: 'Find a master by category, city or on the map:' },
  subscription: {
    status: '<b>{{kind}} subscription</b>\nStatus: {{status}}\nValid until: {{date}}\nLeft: {{days}}',
    kindMaster: 'Master',
    kindSalon: 'Salon',
    coveredBySalon: 'Your subscription is covered by the salon “{{salon}}”.',
    none: "You don't have a master or salon cabinet. Register via /start.",
  },
  promo: {
    usage: 'Usage: <code>/promo CODE</code>',
    appliedDays: '✅ Promo code applied: +{{days}} days. Access until {{date}}.',
    appliedDiscount: '✅ Promo code applied: {{pct}}% off your next payment.',
    noTenant: 'Promo codes are available to masters and salons. Register via /start.',
  },
  master_notify: {
    newAppointment:
      '🆕 <b>New appointment</b>\n\n👤 {{client}}\n💅 {{services}}\n🗓 {{date}}, {{time}}\n💰 {{price}}',
    newAppointmentPending: '\n\nThe appointment is waiting for your confirmation.',
    clientComment: '\n💬 {{comment}}',
    cancelledByClient: '❌ <b>Appointment cancelled</b>\n{{client}} cancelled the appointment on {{date}}, {{time}}.',
    rescheduledByClient: '🔄 <b>Appointment rescheduled</b>\n{{client}}: {{oldDate}} → <b>{{newDate}}</b>',
    clientConfirmed: '✅ {{client}} confirmed the visit on {{date}} at {{time}}.',
    reminder30: '⏰ In 30 minutes: {{client}} — {{services}} at {{time}}.',
    eveningSummary_one:
      '📅 Reminder: you have <b>{{count}} appointment</b> tomorrow.\nOpen the app to see the schedule.',
    eveningSummary_few:
      '📅 Reminder: you have <b>{{count}} appointments</b> tomorrow.\nOpen the app to see the schedule.',
    eveningSummary_many:
      '📅 Reminder: you have <b>{{count}} appointments</b> tomorrow.\nOpen the app to see the schedule.',
    eveningSummary_other:
      '📅 Reminder: you have <b>{{count}} appointments</b> tomorrow.\nOpen the app to see the schedule.',
    eveningSummaryEmpty: '✨ No appointments tomorrow. Get some rest!',
    morningSummary_one: '☀️ Good morning! You have <b>{{count}} appointment</b> today.',
    morningSummary_few: '☀️ Good morning! You have <b>{{count}} appointments</b> today.',
    morningSummary_many: '☀️ Good morning! You have <b>{{count}} appointments</b> today.',
    morningSummary_other: '☀️ Good morning! You have <b>{{count}} appointments</b> today.',
    birthdayTomorrow: '🎂 Birthdays tomorrow: {{names}}. Congratulate your clients!',
    newReview: '⭐️ New review from {{client}}: {{rating}}/5',
    onlineClosed: '⏹ The “Available now” window is closed.',
  },
  billing: {
    ends3days:
      '⏳ Your subscription ends in 3 days — {{date}}.\nRenew it so clients can keep booking without interruption.',
    endsToday: '⚠️ Your subscription ends today. Renew it to keep your clients.',
    expired:
      '🔒 Your subscription has expired.\nYour page is hidden from search and new bookings are disabled. Your data is safe — pay to continue.',
    paymentSucceeded: '✅ Payment of {{amount}} received!\nSubscription is active until <b>{{date}}</b>.',
    autopayFailed: '⚠️ Could not charge the subscription ({{amount}}). Please pay manually.',
    referralReward: '🎁 Referral bonus: +{{days}} days added to your subscription!',
    refunded: '↩️ Refund of {{amount}} completed.',
  },
  salon_notify: {
    invite: '💌 The salon <b>“{{salon}}”</b> invites you to join as a master.',
    inviteNewUser:
      '💌 The salon <b>“{{salon}}”</b> invites you to become its master. Open the app to create a profile and join.',
    inviteAccepted: '✅ {{master}} accepted the salon invite.',
    inviteDeclined: '✖️ {{master}} declined the salon invite.',
    removed:
      'You are no longer a member of “{{salon}}”. Your clients and appointments are kept. To keep accepting bookings, subscribe as a master.',
    joined: '🎉 You joined “{{salon}}”!',
    declined: 'Invite declined.',
    alreadyHandled: 'This invite has already been handled.',
  },
  client_notify: {
    bookingConfirmed: "✅ <b>You're booked!</b>\n\n✂️ {{master}}\n💅 {{services}}\n🗓 {{date}} at {{time}}",
    bookingPending:
      "🕐 <b>Request sent</b>\n\n✂️ {{master}}\n💅 {{services}}\n🗓 {{date}} at {{time}}\n\nWe'll let you know once the master confirms.",
    address: '\n📍 {{address}}',
    confirmedByMaster: '✅ {{master}} confirmed your appointment on {{date}} at {{time}}.',
    cancelledByMaster: '❌ {{master}} cancelled your appointment on {{date}} at {{time}}.',
    rescheduledByMaster: '🔄 {{master}} moved your appointment to <b>{{date}} at {{time}}</b>.',
    reminder24: '{{name}}, you are booked with {{master}} for {{services}} tomorrow at {{time}}.',
    reminder2h: '{{name}}, in 2 hours — {{services}} with {{master}} at {{time}}.',
    firstVisit: '\n\n💫 This is your first visit. Address: {{address}}. Directions — tap the button below.',
    beOnTime: '\n\n🙏 Please try to arrive on time — your master is waiting for you.',
    confirmThanks: 'Thank you! Your master is waiting for you 💖',
    cancelPrompt: 'Cancel your appointment with {{master}} on {{date}} at {{time}}?',
    cancelled: 'The appointment is cancelled. Hope to see you another time!',
    cannotCancel: 'This appointment can no longer be cancelled.',
    postcardDefault: '{{name}}, thank you for the visit! 💖 Hope to see you again soon.',
    reviewRequest: 'How was your visit to {{master}}? Leave a review — it really helps ⭐️',
    slotAlert: '🔥 {{master}} has a free slot: <b>{{date}} at {{time}}</b>. Book it before it’s gone!',
    onlineOpen: '🟢 {{master}} is available right now — until {{until}}. Book a visit!',
    birthday: '🎉 Happy birthday, {{name}}! {{master}} gives you {{pct}}% off a visit in the coming days.',
    sleepingDefault: "{{name}}, it's been a while! {{master}} would love to see you again 💅",
    unsubscribeHint: '\n\n<i>You can turn off broadcasts in the app profile.</i>',
    promotion: '🎁 <b>{{title}}</b> — {{pct}}% off\n{{description}}',
  },
  owner: {
    weeklyDigest:
      '📊 <b>Weekly digest</b>\n\n🆕 New masters: {{newMasters}}\n🏛 New salons: {{newSalons}}\n💰 MRR: {{mrr}}\n💳 Revenue this week: {{revenue}} ({{payments}} payments)\n📈 Trial → paid conversion: {{conversion}}%\n\n<b>Top masters by revenue:</b>\n{{top}}',
    noTop: '— no data yet',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    notFound: 'Not found.',
  },
};
