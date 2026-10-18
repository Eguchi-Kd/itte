import { describe, expect, it } from 'vitest';

describe('テスト環境', () => {
  it('TZ が Asia/Tokyo になっている', () => {
    expect(process.env.TZ).toBe('Asia/Tokyo');
    expect(new Date(2026, 9, 18, 12).getTimezoneOffset()).toBe(-540);
  });
});
