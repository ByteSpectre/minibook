export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description?: string;
  location?: string;
  url?: string;
}

const fmt = (d: Date): string =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const escape = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 calendar file with a single event and a 2-hour reminder. */
export function buildIcs(event: IcsEvent, productName = 'Glow'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${productName}//Booking//RU`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(event.start)}`,
    `DTEND:${fmt(event.end)}`,
    `SUMMARY:${escape(event.title)}`,
    event.description ? `DESCRIPTION:${escape(event.description)}` : '',
    event.location ? `LOCATION:${escape(event.location)}` : '',
    event.url ? `URL:${event.url}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.join('\r\n')}\r\n`;
}
