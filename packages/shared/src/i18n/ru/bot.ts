export const bot = {
  buttons: {
    client: '💅 Я клиент',
    master: '✂️ Я мастер',
    salon: '🏛 Я владелец салона',
    openApp: '📱 Открыть приложение',
    openMaster: '✂️ Кабинет мастера',
    openSalon: '🏛 Кабинет салона',
    openAdmin: '📊 Админка платформы',
    openSchedule: '📅 Открыть расписание',
    openAppointment: 'Открыть запись',
    pay: '💳 Оплатить подписку',
    book: '✨ Записаться',
    bookAgain: '🔁 Записаться снова',
    leaveReview: '⭐️ Оставить отзыв',
    accept: '✅ Принять',
    decline: '✖️ Отклонить',
    confirmVisit: '✅ Приду',
    reschedule: '🔄 Перенести',
    cancel: '❌ Отменить',
    yesCancel: 'Да, отменить',
    keep: 'Нет, оставить',
    confirmAppointment: '✅ Подтвердить',
    route: '🗺 Как добраться',
    search: '🔎 Найти мастера',
  },
  start: {
    greeting:
      '👋 Привет, {{name}}!\n\n<b>{{app}}</b> — запись к мастерам красоты прямо в Telegram.\n\nНажмите кнопку ниже, чтобы открыть приложение:',
    welcomeBack: 'С возвращением, {{name}}! ✨\nНажмите кнопку ниже, чтобы открыть приложение:',
  },
  help: '<b>{{app}}</b> — запись к мастерам красоты.\n\n/start — выбрать роль\n/search — найти мастера\n/master — кабинет мастера\n/salon — кабинет салона\n/subscription — статус подписки\n/promo КОД — активировать промокод\n/help — помощь',
  master: {
    open: 'Кабинет мастера:',
    notRegistered: 'У вас ещё нет кабинета мастера. Нажмите /start и выберите «Я мастер».',
  },
  salon: {
    open: 'Кабинет салона:',
    notRegistered: 'У вас ещё нет салона. Нажмите /start и выберите «Я владелец салона».',
  },
  search: { open: 'Найдите мастера по категории, городу или на карте:' },
  subscription: {
    status:
      '<b>Подписка {{kind}}</b>\nСтатус: {{status}}\nДействует до: {{date}}\nОсталось: {{days}}',
    kindMaster: 'мастера',
    kindSalon: 'салона',
    coveredBySalon: 'Ваша подписка покрывается салоном «{{salon}}».',
    none: 'У вас нет кабинета мастера или салона. Зарегистрируйтесь через /start.',
  },
  promo: {
    usage: 'Использование: <code>/promo КОД</code>',
    appliedDays: '✅ Промокод применён: +{{days}} дн. Доступ до {{date}}.',
    appliedDiscount: '✅ Промокод применён: скидка {{pct}}% на следующую оплату.',
    noTenant: 'Промокоды доступны мастерам и салонам. Зарегистрируйтесь через /start.',
  },
  master_notify: {
    newAppointment:
      '🆕 <b>Новая запись</b>\n\n👤 {{client}}\n💅 {{services}}\n🗓 {{date}}, {{time}}\n💰 {{price}}',
    newAppointmentPending: '\n\nЗапись ждёт вашего подтверждения.',
    clientComment: '\n💬 {{comment}}',
    cancelledByClient:
      '❌ <b>Отмена записи</b>\n{{client}} отменил(а) запись на {{date}}, {{time}}.',
    rescheduledByClient: '🔄 <b>Перенос записи</b>\n{{client}}: {{oldDate}} → <b>{{newDate}}</b>',
    clientConfirmed: '✅ {{client}} подтвердил(а), что придёт {{date}} в {{time}}.',
    reminder30: '⏰ Через 30 минут: {{client}} — {{services}} в {{time}}.',
    eveningSummary_one:
      '📅 Напоминание: завтра у вас <b>{{count}} запись</b>.\nОткройте приложение, чтобы посмотреть расписание.',
    eveningSummary_few:
      '📅 Напоминание: завтра у вас <b>{{count}} записи</b>.\nОткройте приложение, чтобы посмотреть расписание.',
    eveningSummary_many:
      '📅 Напоминание: завтра у вас <b>{{count}} записей</b>.\nОткройте приложение, чтобы посмотреть расписание.',
    eveningSummary_other:
      '📅 Напоминание: завтра у вас <b>{{count}} записи</b>.\nОткройте приложение, чтобы посмотреть расписание.',
    eveningSummaryEmpty: '✨ Завтра записей нет. Отдыхайте!',
    morningSummary_one: '☀️ Доброе утро! Сегодня у вас <b>{{count}} запись</b>.',
    morningSummary_few: '☀️ Доброе утро! Сегодня у вас <b>{{count}} записи</b>.',
    morningSummary_many: '☀️ Доброе утро! Сегодня у вас <b>{{count}} записей</b>.',
    morningSummary_other: '☀️ Доброе утро! Сегодня у вас <b>{{count}} записи</b>.',
    birthdayTomorrow: '🎂 Завтра день рождения у: {{names}}. Поздравьте клиентов!',
    newReview: '⭐️ Новый отзыв от {{client}}: {{rating}}/5',
    onlineClosed: '⏹ Окно «Свободен сейчас» закрыто.',
  },
  billing: {
    ends3days:
      '⏳ Подписка заканчивается через 3 дня — {{date}}.\nПродлите её, чтобы клиенты могли записываться без перерыва.',
    endsToday: '⚠️ Подписка заканчивается сегодня. Продлите, чтобы не потерять клиентов.',
    expired:
      '🔒 Подписка истекла.\nСтраница скрыта из поиска, новые записи недоступны. Данные сохранены — оплатите подписку, чтобы продолжить.',
    paymentSucceeded: '✅ Оплата {{amount}} прошла!\nПодписка активна до <b>{{date}}</b>.',
    autopayFailed: '⚠️ Не удалось списать оплату за подписку ({{amount}}). Оплатите вручную.',
    referralReward: '🎁 Бонус за приглашение мастера: +{{days}} дн. к подписке!',
    refunded: '↩️ Возврат платежа {{amount}} выполнен.',
  },
  salon_notify: {
    invite: '💌 Салон <b>«{{salon}}»</b> приглашает вас присоединиться как мастера.',
    inviteNewUser:
      '💌 Салон <b>«{{salon}}»</b> приглашает вас стать мастером салона. Откройте приложение, чтобы создать профиль и присоединиться.',
    inviteAccepted: '✅ {{master}} принял(а) приглашение в салон.',
    inviteDeclined: '✖️ {{master}} отклонил(а) приглашение в салон.',
    removed:
      'Вы больше не состоите в салоне «{{salon}}». Ваши клиенты и записи сохранены. Чтобы продолжить принимать записи, оформите подписку мастера.',
    joined: '🎉 Вы присоединились к салону «{{salon}}»!',
    declined: 'Приглашение отклонено.',
    alreadyHandled: 'Это приглашение уже обработано.',
  },
  client_notify: {
    bookingConfirmed:
      '✅ <b>Вы записаны!</b>\n\n✂️ {{master}}\n💅 {{services}}\n🗓 {{date}} в {{time}}',
    bookingPending:
      '🕐 <b>Заявка отправлена</b>\n\n✂️ {{master}}\n💅 {{services}}\n🗓 {{date}} в {{time}}\n\nМы сообщим, когда мастер подтвердит запись.',
    address: '\n📍 {{address}}',
    confirmedByMaster: '✅ {{master}} подтвердил(а) запись на {{date}} в {{time}}.',
    cancelledByMaster: '❌ {{master}} отменил(а) запись на {{date}} в {{time}}.',
    rescheduledByMaster: '🔄 {{master}} перенёс(ла) запись на <b>{{date}} в {{time}}</b>.',
    reminder24: '{{name}}, вы записаны к {{master}} на {{services}} завтра в {{time}}.',
    reminder2h: '{{name}}, через 2 часа — запись к {{master}}: {{services}} в {{time}}.',
    firstVisit: '\n\n💫 Это ваш первый визит. Адрес: {{address}}. Маршрут — по кнопке ниже.',
    beOnTime: '\n\n🙏 Пожалуйста, постарайтесь прийти вовремя — мастер ждёт вас.',
    confirmThanks: 'Спасибо! Мастер ждёт вас 💖',
    cancelPrompt: 'Отменить запись к {{master}} на {{date}} в {{time}}?',
    cancelled: 'Запись отменена. Будем рады видеть вас в другой раз!',
    cannotCancel: 'Эту запись уже нельзя отменить.',
    postcardDefault: '{{name}}, спасибо за визит! 💖 Буду рада видеть вас снова.',
    reviewRequest: 'Как вам визит к {{master}}? Оставьте отзыв — это очень помогает мастеру ⭐️',
    slotAlert: '🔥 У {{master}} освободилось окно: <b>{{date}} в {{time}}</b>. Успейте записаться!',
    onlineOpen: '🟢 {{master}} свободен(на) прямо сейчас — до {{until}}. Можно записаться!',
    birthday:
      '🎉 {{name}}, с днём рождения! {{master}} дарит вам скидку {{pct}}% на визит в ближайшие дни.',
    sleepingDefault: '{{name}}, давно не виделись! {{master}} будет рад(а) видеть вас снова 💅',
    unsubscribeHint: '\n\n<i>Отключить рассылки можно в профиле приложения.</i>',
    promotion: '🎁 <b>{{title}}</b> — скидка {{pct}}%\n{{description}}',
  },
  owner: {
    weeklyDigest:
      '📊 <b>Еженедельный дайджест</b>\n\n🆕 Новые мастера: {{newMasters}}\n🏛 Новые салоны: {{newSalons}}\n💰 MRR: {{mrr}}\n💳 Выручка за неделю: {{revenue}} ({{payments}} платежей)\n📈 Конверсия триал → оплата: {{conversion}}%\n\n<b>Топ мастеров по доходу:</b>\n{{top}}',
    noTop: '— пока нет данных',
  },
  errors: {
    generic: 'Что-то пошло не так. Попробуйте ещё раз.',
    notFound: 'Не найдено.',
  },
};
