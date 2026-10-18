// 統合で決めた暫定値（§15-6）。元の設計書に数値がなかったため、実測で見直すまでここに1か所でまとめる

// TODO(spec): 15-6 量を上げる提案の式（§8.2.3）。min(amount * 2, max(amount + 1, ceil(amount * 1.2)))
export const LEVEL_UP_MAX_FACTOR = 2;
export const LEVEL_UP_GROWTH = 1.2;
export const LEVEL_UP_WINDOW_DAYS = 14;
export const LEVEL_UP_MIN_RATE = 0.9;
export const LEVEL_UP_MIN_SCHEDULED = 4;

// TODO(spec): 15-6 傾向は全体より低い条件だけを返す（§8.2.5）
export const PATTERN_ONLY_LOWER = true;
export const PATTERN_MIN_N = 8;
export const PATTERN_MIN_DIFF = 0.2;
export const PATTERN_MAX = 3;

// TODO(spec): 15-6 .ics の DTEND は、単位が「分」以外なら DTSTART + 15分（§8.12.1）
export const ICS_DEFAULT_DURATION_MIN = 15;
