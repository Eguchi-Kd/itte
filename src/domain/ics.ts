// .ics の書き出し（§8.12.1）。時刻はフローティング（Z なし、TZID なし）、改行は CRLF、VALARM は付けない
import { addDays, parseLocalDate } from './dates';
import { formatIntention } from './habits/formatIntention';
import { isScheduled } from './habits/schedule';
import type { EpochMs, Goal, Habit, Settings } from './types';
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

function stampDate(d: string): string {
  return d.replace(/-/g, '');
}

/** 週次ふりかえりの曜日と時刻に、毎週の VEVENT（タイトルは呼び出し側が渡す） */
export function weeklyReviewEvent(settings: Pick<Settings, 'weeklyReviewIcs' | 'createdAt'>, today: string, title: string): string[] {
  const { weekday, time } = settings.weeklyReviewIcs;
  let first = today;
  for (let i = 0; i < 7 && parseLocalDate(first).getDay() !== weekday; i++) first = addDays(first, 1);
  return [
    'BEGIN:VEVENT',
    'UID:weekly-review@itte',
    `DTSTAMP:${utcStamp(settings.createdAt)}`,
    `DTSTART:${floating(first, time)}`,
    `DTEND:${floating(first, time, ICS_DEFAULT_DURATION_MIN)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[weekday]}`,
    `SUMMARY:${escapeText(title)}`,
    'END:VEVENT',
  ];
}

export function exportWeeklyReviewIcs(settings: Pick<Settings, 'weeklyReviewIcs' | 'createdAt'>, today: string, title: string): string {
  return wrapCalendar([weeklyReviewEvent(settings, today, title)]);
}

/** OPEN の段の期限を、終日の VEVENT（DTSTART;VALUE=DATE）で */
export function goalDeadlineEvents(goals: readonly Goal[]): string[][] {
  return goals
    .filter((g) => g.status === 'OPEN')
    .map((g) => [
      'BEGIN:VEVENT',
      `UID:${g.id}@itte`,
      `DTSTAMP:${utcStamp(g.createdAt)}`,
      `DTSTART;VALUE=DATE:${stampDate(g.deadline)}`,
      `DTEND;VALUE=DATE:${stampDate(addDays(g.deadline, 1))}`,
      `SUMMARY:${escapeText(g.title)}`,
      'END:VEVENT',
    ]);
}

export function exportGoalDeadlinesIcs(goals: readonly Goal[]): string {
  return wrapCalendar(goalDeadlineEvents(goals));
}

/** 習慣の時刻・週次ふりかえり・段の期限をまとめた .ics（設定画面のまとめ書き出し） */
export function exportAllIcs(
  habits: readonly Habit[],
  goals: readonly Goal[],
  settings: Pick<Settings, 'weeklyReviewIcs' | 'createdAt'>,
  today: string,
  weeklyTitle: string,
): string {
  const habitEvents = habits.filter((h) => h.status === 'active').map(habitEvent).filter((e): e is string[] => e !== null);
  return wrapCalendar([...habitEvents, weeklyReviewEvent(settings, today, weeklyTitle), ...goalDeadlineEvents(goals)]);
}

// ===== 読み込み（§8.12.2） =====

export interface IcsEvent {
  uid: string;
  summary: string;
  date: string;
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

/** 'YYYYMMDD' または 'YYYYMMDDTHHMMSS[Z]' → 暦の日付（Z つきは UTC をローカルに直す） */
function icsDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    const local = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  }
  return `${y}-${mo}-${d}`;
}

/**
 * 行の折り返しを戻し、VEVENT の UID・SUMMARY・DTSTART（DATE と DATE-TIME）を読む。
 * today〜today+60 に始まる予定だけを返す。RRULE は展開しない。UID が重なれば最初の1件だけ
 */
export function parseIcs(text: string, today: string): IcsEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: IcsEvent[] = [];
  const seen = new Set<string>();
  const last = addDays(today, 60);
  let cur: Partial<IcsEvent> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.uid && cur.date && !seen.has(cur.uid) && cur.date >= today && cur.date <= last) {
        seen.add(cur.uid);
        out.push({ uid: cur.uid, summary: cur.summary ?? '', date: cur.date });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const name = line.slice(0, idx).split(';')[0].toUpperCase();
      const value = line.slice(idx + 1);
      if (name === 'UID') cur.uid = value.trim();
      else if (name === 'SUMMARY') cur.summary = unescapeText(value);
      else if (name === 'DTSTART') cur.date = icsDate(value) ?? undefined;
    }
  }
  return out;
}
