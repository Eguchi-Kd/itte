import { describe, expect, it } from 'vitest';
import { escapeText, exportHabitIcs, foldLine } from '../ics';
import { habit } from './habitFixtures';

const created = new Date('2026-10-18T12:00:00+09:00').getTime();

describe('exportHabitIcs', () => {
  it('AC-HAB-16: time のある習慣で RRULE 付きの VEVENT を返す', () => {
    const ics = exportHabitIcs(
      habit({
        id: 'h1',
        name: '英単語',
        unit: '分',
        amount: 10,
        startedOn: '2026-10-18', // 日曜。最初の予定日は月曜
        schedule: { days: [5, 1, 3], time: '07:00', cue: null },
        createdAt: created,
      }),
    );
    expect(ics).not.toBeNull();
    const lines = (ics ?? '').split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('UID:h1@itte');
    expect(lines).toContain('DTSTAMP:20261018T030000Z');
    expect(lines).toContain('DTSTART:20261019T070000');
    expect(lines).toContain('DTEND:20261019T071000');
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(lines).toContain('SUMMARY:英単語');
    expect(lines).toContain('END:VEVENT');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(ics?.endsWith('\r\n')).toBe(true);
    // 催促しない（§2.3-5）、フローティング時刻（Z も TZID もない）
    expect(ics).not.toContain('VALARM');
    expect(ics).not.toContain('TZID');
    expect(lines.filter((l) => l.startsWith('DTSTART') || l.startsWith('DTEND')).some((l) => l.endsWith('Z'))).toBe(false);
    // LF だけの改行がない
    expect((ics ?? '').replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('AC-HAB-16: time がなければ null', () => {
    expect(exportHabitIcs(habit({ schedule: { days: [1], time: null, cue: '朝食のあと' } }))).toBeNull();
  });

  it('単位が「分」以外なら DTEND は DTSTART + 15分。終了日があれば UNTIL を付ける', () => {
    const ics =
      exportHabitIcs(
        habit({
          unit: '回',
          amount: 30,
          startedOn: '2026-10-19',
          endedOn: '2026-12-31',
          schedule: { days: [0, 1, 2, 3, 4, 5, 6], time: '23:50', cue: null },
        }),
      ) ?? '';
    expect(ics).toContain('DTSTART:20261019T235000');
    expect(ics).toContain('DTEND:20261020T000500');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=20261231T235959');
  });

  it('テキストのエスケープと75オクテットの折り返し', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const folded = foldLine(`DESCRIPTION:${'あ'.repeat(40)}`);
    const parts = folded.split('\r\n ');
    expect(parts.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    expect(enc.encode(parts[0]).length).toBeLessThanOrEqual(75);
    expect(parts.join('')).toBe(`DESCRIPTION:${'あ'.repeat(40)}`);
  });
});
