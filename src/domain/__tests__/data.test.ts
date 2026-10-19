import { describe, expect, it } from 'vitest';
import { backupDue } from '../backup';
import { csvToRecords, parseCsv, toCsv } from '../csv';
import { exportAllIcs, exportGoalDeadlinesIcs, exportWeeklyReviewIcs, parseIcs } from '../ics';
import { goal } from './goalFixtures';
import { habit } from './habitFixtures';

const NOW = new Date(2026, 9, 18, 12, 0).getTime();
const DAY = 86_400_000;

describe('.ics の読み込み', () => {
  it('AC-DATA-05: 折り返し行、DATE と DATE-TIME、60日の範囲、UID による重複除外を扱う', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:a@x',
      'SUMMARY:ゼミの発表の準備をする、とても長いタイトルが折り返され',
      ' ている予定',
      'DTSTART;VALUE=DATE:20261020',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:b@x',
      'SUMMARY:面談',
      'DTSTART;TZID=Asia/Tokyo:20261105T140000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:c@x',
      'SUMMARY:深夜の締切',
      'DTSTART:20261024T160000Z', // UTC 16:00 → JST 10/25 01:00
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:a@x',
      'SUMMARY:重複',
      'DTSTART;VALUE=DATE:20261021',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:past@x',
      'SUMMARY:過去',
      'DTSTART;VALUE=DATE:20261017',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:edge@x',
      'SUMMARY:60日後',
      'DTSTART;VALUE=DATE:20261217',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:far@x',
      'SUMMARY:61日後',
      'DTSTART;VALUE=DATE:20261218',
      'RRULE:FREQ=WEEKLY',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(parseIcs(ics, '2026-10-18')).toEqual([
      { uid: 'a@x', summary: 'ゼミの発表の準備をする、とても長いタイトルが折り返されている予定', date: '2026-10-20' },
      { uid: 'b@x', summary: '面談', date: '2026-11-05' },
      { uid: 'c@x', summary: '深夜の締切', date: '2026-10-25' },
      { uid: 'edge@x', summary: '60日後', date: '2026-12-17' },
    ]);
  });

  it('AC-DATA-05: LF だけの改行とエスケープされた文字も読む', () => {
    const ics = 'BEGIN:VEVENT\nUID:x\nSUMMARY:A\\, B\\; C\nDTSTART:20261019T090000\nEND:VEVENT\n';
    expect(parseIcs(ics, '2026-10-18')).toEqual([{ uid: 'x', summary: 'A, B; C', date: '2026-10-19' }]);
  });
});

describe('.ics のまとめ書き出し', () => {
  it('習慣の時刻・週次ふりかえり・OPEN の段の期限をまとめる。VALARM は付けない', () => {
    const settings = { weeklyReviewIcs: { weekday: 0, time: '20:00' }, createdAt: NOW };
    const ics = exportAllIcs(
      [habit({ id: 'h', schedule: { days: [1], time: '07:00', cue: null } }), habit({ id: 'cue', schedule: { days: [1], time: null, cue: 'x' } })],
      [goal({ id: 'g', deadline: '2026-10-25', status: 'OPEN' }), goal({ id: 'met', status: 'MET' })],
      settings,
      '2026-10-19',
      '一手 週次ふりかえり',
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('UID:h@itte');
    expect(ics).toContain('UID:weekly-review@itte');
    expect(ics).toContain('DTSTART:20261025T200000');
    expect(ics).toContain('SUMMARY:一手 週次ふりかえり');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261025');
    expect(ics).toContain('DTEND;VALUE=DATE:20261026');
    expect(ics).not.toContain('UID:met@itte');
    expect(ics).not.toContain('VALARM');
    expect(exportGoalDeadlinesIcs([])).toContain('BEGIN:VCALENDAR');
    expect(exportWeeklyReviewIcs(settings, '2026-10-18', 't')).toContain('DTSTART:20261018T200000');
  });
});

describe('バックアップの促し', () => {
  it('AC-DATA-07: lastExportAt が7日以上前、または未設定で記録が1件以上のとき', () => {
    expect(backupDue(null, true, NOW)).toBe(true);
    expect(backupDue(null, false, NOW)).toBe(false);
    expect(backupDue(NOW - 7 * DAY, true, NOW)).toBe(true);
    expect(backupDue(NOW - 7 * DAY + 1, true, NOW)).toBe(false);
    expect(backupDue(NOW - DAY, false, NOW)).toBe(false);
  });
});

describe('CSV', () => {
  it('BOM・CRLF・ダブルクォートの規則で書き、読み戻せる', () => {
    const text = toCsv(['a', 'b'], [{ a: 'x,y', b: 'say "hi"' }, { a: 'line\nbreak', b: null }]);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",\r\n');
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x,y', 'say "hi"'],
      ['line\nbreak', ''],
    ]);
  });

  it('レコードの型（数値・真偽・配列・瞬間・null）を読み戻す', () => {
    const task = {
      id: 't',
      title: '3',
      roughVersion: null,
      firstAction: 'f',
      nextStep: null,
      plannedFor: '2026-10-18',
      planHistory: ['2026-10-16'],
      boardItemId: null,
      goalId: null,
      createdAt: NOW,
      archivedAt: null,
      closedReason: null,
    };
    const text = toCsv(Object.keys(task), [task]);
    expect(text).toContain('2026-10-18T03:00:00.000Z');
    expect(csvToRecords('tasks', text)).toEqual([task]);
  });

});
