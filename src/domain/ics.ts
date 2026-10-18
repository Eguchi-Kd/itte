// .ics の書き出し（§8.12.1）。時刻はフローティング（Z なし、TZID なし）、改行は CRLF、VALARM は付けない
import { addDays, parseLocalDate } from './dates';
import { formatIntention } from './habits/formatIntention';
import { isScheduled } from './habits/schedule';
import type { EpochMs, Habit } from './types';
import { ICS_DEFAULT_DURATION_MIN } from './verify/thresholds';

const CRLF = '\r\n';
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** テキスト値のエスケープ（RFC 5545 3.3.11） */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 75オクテットで折り返す（RFC 5545 3.1）。マルチバイト文字の途中では切らない */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 続きの行は先頭の空白1つぶん短い
    if (bytes + n > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' と 'HH:mm' → 20261019T070000（フローティング） */
function floating(date: string, time: string, plusMin = 0): string {
  const [h, m] = time.split(':').map(Number);
  const d = parseLocalDate(date);
  d.setHours(h, m + plusMin, 0, 0);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function utcStamp(ms: EpochMs): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function wrapCalendar(events: string[][]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//itte//JA', 'CALSCALE:GREGORIAN'];
  for (const e of events) lines.push(...e);
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** time のある習慣の VEVENT（RRULE:FREQ=WEEKLY;BYDAY=…）。time がなければ null */
export function habitEvent(habit: Habit): string[] | null {
  const time = habit.schedule.time;
  if (!time || habit.schedule.days.length === 0) return null;
  let first = habit.startedOn;
  for (let i = 0; i < 7 && !isScheduled({ ...habit, endedOn: null }, first); i++) first = addDays(first, 1);
  // TODO(spec): 15-6 単位が「分」以外なら DTSTART + 15分
  const minutes = habit.unit === '分' ? habit.amount : ICS_DEFAULT_DURATION_MIN;
  const byday = [...habit.schedule.days].sort((a, b) => a - b).map((d) => BYDAY[d]).join(',');
  const until = habit.endedOn ? `;UNTIL=${habit.endedOn.replace(/-/g, '')}T235959` : '';
  return [
    'BEGIN:VEVENT',
    `UID:${habit.id}@itte`,
    `DTSTAMP:${utcStamp(habit.createdAt)}`,
    `DTSTART:${floating(first, time)}`,
    `DTEND:${floating(first, time, minutes)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}${until}`,
    `SUMMARY:${escapeText(habit.name)}`,
    `DESCRIPTION:${escapeText(formatIntention(habit))}`,
    'END:VEVENT',
  ];
}

export function exportHabitIcs(habit: Habit): string | null {
  const e = habitEvent(habit);
  return e ? wrapCalendar([e]) : null;
}
