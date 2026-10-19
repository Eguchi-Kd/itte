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

// 数字の画面で値を出す最小の件数（分母）。これより少なければ「—（{n}件）」と出す（§6.10、AC-REV-04）
export const NUMBERS_MIN_N = 3;

// 仮説の判定の閾値（§9.4）
export const H1_MIN_DIFF = 0.2;
export const H1_MIN_PAIRS = 3;
export const H2_MIN_FILLED = 5;
export const H2_MIN_RECORD_RATE = 0.5;
// TODO(spec): 15-6 H3 の差 0.10 と U1 の差15分は、この統合で暫定的に決めた値
export const H3_MIN_DIFF = 0.1;
export const H3_MIN_N = 5;
export const U1_MIN_DIFF_MIN = 15;
export const U1_MIN_DAYS = 5;
export const B1_MIN_REVIEWS = 5;
export const B2_MIN_BAD = 3;
export const B4_MIN_RATE = 0.5;
export const K_MIN_JUDGMENTS = 3;
export const K3_MIN_USAGE = 0.5;
