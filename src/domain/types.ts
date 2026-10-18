// 型定義（§7.2）。仕様の型をそのまま写している

// ===== 基本 =====
export type ID = string;          // crypto.randomUUID()
export type LocalDate = string;   // 'YYYY-MM-DD'。午前4時を境界にした論理日（§8.1）
export type EpochMs = number;     // 瞬間。Date.now()
export type Phase = 'A' | 'B';    // 実験の条件

// ===== 共通 =====
export type Persona = 'regret' | 'optimist' | 'meaning' | 'selfblame' | 'notfun';

export interface Settings {
  id: 'singleton';
  onboarded: boolean;
  persona: Persona | null;
  personaScores: Record<Persona, number> | null;
  soundOn: boolean;                       // 既定 true
  hapticsOn: boolean;                     // 既定 true
  stallExtensionThreshold: number;        // 既定 3
  stallFollowUpDays: number;              // 既定 30
  stallRepeatedUnmet: number;             // 既定 3
  weeklyReviewIcs: { weekday: number; time: string }; // 既定 { weekday: 0, time: '20:00' }
  lastExportAt: EpochMs | null;
  introSeen: string[];                    // 「はじめての○○」カードを見た ID
  dismissed: Record<string, LocalDate>;   // 割り込みカード ID → 非表示にした論理日
  installPromptShown: boolean;
  createdAt: EpochMs;
}

export interface AppOpen { date: LocalDate; firstAt: EpochMs }   // 主キー date

export type ExperimentPreset = 'start' | 'board' | 'kizami';
export interface Experiment {
  id: ID;
  preset: ExperimentPreset;
  startDate: LocalDate;       // 開始後は変更不可。変えたいときは中止して新しく作る
  stoppedAt: EpochMs | null;  // 手動で中止した時刻
  createdAt: EpochMs;
}

export interface WeeklyReviewRun {
  id: ID;
  weekStart: LocalDate;       // その ISO 週の月曜（論理日）。一意
  startedAt: EpochMs;
  completedAt: EpochMs | null;
  cursor: number;             // 再開位置（カードの番号）
}

// ===== 習慣【仕】 =====
export type HabitKind = 'build' | 'replace';
export type HabitStatus = 'active' | 'graduated' | 'ended';

export interface Habit {
  id: ID;
  kind: HabitKind;
  name: string;                 // 1〜40
  replacesText: string | null;  // kind='replace' のとき必須、1〜40
  purpose: string;              // 0〜200（persona='meaning' で 1 以上）
  unit: string;                 // 1〜10
  amount: number;               // 正の整数
  minAmount: number;            // 1 以上 amount 以下
  amountChangedOn: LocalDate;
  schedule: { days: number[]; time: string | null; cue: string | null }; // days は 0=日〜6=土、1つ以上。time か cue の少なくとも一方
  place: string;                // 1〜40
  how: string;                  // 0〜80
  commitmentNote: string | null; // persona='regret' で必須
  funNote: string | null;
  status: HabitStatus;
  startedOn: LocalDate;
  endedOn: LocalDate | null;
  endNote: string | null;
  createdAt: EpochMs;
}

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: LocalDate;
  done: boolean;
  amount: number;               // done=false のとき 0
  reasonTagIds: ID[];           // done=false のときだけ意味を持つ
  memo: string | null;
  recordedAt: EpochMs;
}

export interface ReasonTag { id: ID; label: string; builtIn: boolean; archived: boolean; order: number } // label 1〜12

export interface WeeklyCheck {
  id: ID;
  habitId: ID;
  weekStart: LocalDate;
  automaticity: [number, number, number, number]; // 各 1〜5
  habitReview: {
    stillUseful: number;        // 1〜5
    wouldChooseAgain: boolean;
    decision: 'continue' | 'reduce' | 'end';
  } | null;                     // reviewDue が true のときだけ入る
  answeredAt: EpochMs;
}

export interface Countermeasure {
  id: ID;
  habitId: ID;
  conditionKey: string;         // 'weekday:6' | 'prevMissed'
  conditionLabel: string;       // 表示用（例: 土曜日）
  action: string;               // 1〜80
  createdOn: LocalDate;
}

// ===== 着手【着】 =====
export interface Task {
  id: ID;
  title: string;                // 1〜80
  roughVersion: string | null;  // A 条件で作ったものは null
  firstAction: string | null;
  nextStep: string | null;
  plannedFor: LocalDate;
  planHistory: LocalDate[];     // 持ち越す前の予定日（D29）
  boardItemId: ID | null;       // D18
  goalId: ID | null;            // D36
  createdAt: EpochMs;
  archivedAt: EpochMs | null;
  closedReason: 'done' | 'dropped' | null; // D30
}

export type SessionOutcome = 'continued' | 'stopped' | 'abandoned';
export interface Session {
  id: ID;
  taskId: ID;
  startedAt: EpochMs;
  endedAt: EpochMs | null;      // null = running または ending
  plannedMin: 10;
  outcome: SessionOutcome | null;
  roughMode: boolean;           // 開始時の条件。B=true, A=false
  affectPredictionId: ID | null;
}

export type StuckChoice = 'fill' | 'research5' | 'stop';
export interface StuckLog { id: ID; sessionId: ID; taskId: ID; at: EpochMs; blocker: string; choice: StuckChoice }

export type PriorState = 'anxiety' | 'fatigue' | 'ambiguity' | 'boredom';
export type EscapeTarget = 'video' | 'game' | 'sleep' | 'other';
export type Enjoyed = 'yes' | 'no' | 'partly';
export interface EscapeLog {
  id: ID;
  at: EpochMs;
  taskId: ID | null;
  sessionId: ID | null;         // 放置セッションから促された場合のみ
  priorState: PriorState | null;
  target: EscapeTarget | null;
  enjoyed: Enjoyed | null;
}

export interface DailyCheck {
  date: LocalDate;              // 主キー
  pendingWorry: boolean;
  consumptionMin: number;       // 0〜1440 の整数
  plannedTaskExists: boolean;
  answeredAt: EpochMs;
}

// ===== 盤面【盤】 =====
export interface EvaluationFunction {
  id: ID;
  metric: string;               // 1〜100
  avoid: string[];              // 0〜3 件、各 1〜100
  startDate: LocalDate;
  endDate: LocalDate;           // startDate より後
  createdAt: EpochMs;
}

export type BoardItemType = 'deadline' | 'event' | 'project' | 'resource';
export interface BoardItem {
  id: ID;
  type: BoardItemType;
  title: string;                // 1〜200
  dueDate: LocalDate | null;
  status: 'open' | 'done';
  source: 'manual' | 'ics';
  externalUid: string | null;   // .ics の UID（重複取り込みの防止）
  createdAt: EpochMs;
}

export interface TurnTrigger { id: ID; conditionText: string; active: boolean; createdAt: EpochMs } // 1〜200

export interface Move {
  id: ID;
  triggerId: ID | null;         // トリガー外の手は null
  situation: string;            // 1〜200
  mode: 'full' | 'quick';       // full=読みシート、quick=簡易記録（D31）
  retro: boolean;               // あとから記録（読むべきだった）（D32）
  irreversible: boolean;
  unreadable: boolean;
  chosenCandidateId: ID | null; // mode='full' で決定済みのとき
  chosenText: string | null;    // mode='quick' のとき必須、1〜200
  decidedAt: EpochMs | null;
  phase: Phase | null;          // 盤面プリセットの実験中に作られた場合の条件
  createdAt: EpochMs;
}

export interface Candidate {
  id: ID;
  moveId: ID;
  position: 1 | 2 | 3;
  description: string;          // 1〜200
  plus1: string | null;
  plus2: string | null;
  score: -2 | -1 | 0 | 1 | 2 | null;
}

export type Rating = 'good' | 'neutral' | 'bad';
export type BlindSpot = 'board' | 'eval' | 'trigger' | 'reading';
export interface MoveReview {
  id: ID;
  moveId: ID;                   // 一意。2回目は上書き
  outcome: string | null;
  judgmentOk: boolean;          // 当時の情報で判断は妥当だったか
  rating: Rating;
  blindSpot: BlindSpot | null;  // rating='bad' のとき必須
  note: string | null;
  reviewedAt: EpochMs;
}

export interface Joseki {
  id: ID;
  principle: string;            // 1〜100
  origin: 'initial' | 'review';
  moveReviewId: ID | null;      // 感想戦から昇格した場合のみ
  archived: boolean;
  order: number;
  createdAt: EpochMs;
}

// ===== 段【刻】 =====
export type Direction = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
export type Comparator = 'GTE' | 'LTE';
export type GoalStatus = 'OPEN' | 'MET' | 'UNMET';   // WITHDRAWN は使わない（D35）

export interface Metric {
  id: ID;
  name: string;                 // 1〜40
  unit: string;                 // 1〜10
  direction: Direction;
  collectionMethod: string;     // 1〜200。空なら登録拒否
  verifiable: boolean;          // 外から確かめられる指標か
  createdAt: EpochMs;
}

export interface Measurement {  // 追記専用
  id: ID;
  metricId: ID;
  value: number;
  measuredAt: EpochMs;
  source: 'manual' | 'judgment';
  note: string | null;
  createdAt: EpochMs;
}

export interface Goal {
  id: ID;
  parentId: ID | null;          // 刻んだ子なら親
  recutOfId: ID | null;         // 切り直しなら元の段
  metricId: ID;
  title: string;                // 1〜80
  targetValue: number;
  comparator: Comparator;
  deadline: LocalDate;          // 必須（不変条件 I1）
  status: GoalStatus;
  createdAt: EpochMs;
  hiddenAt: EpochMs | null;     // 最上位の段は非表示にできない
}

export type PredictionKind = 'OUTCOME' | 'AFFECT';
export interface OutcomePredictionValue { probability: number; value: number } // probability 0〜100
export interface AffectPredictionValue { intensity: number; durationMin: number } // intensity 0〜10
export interface Prediction {   // 追記専用
  id: ID;
  goalId: ID;
  kind: PredictionKind;
  value: OutcomePredictionValue | AffectPredictionValue;
  predictedAt: EpochMs;
  sessionId: ID | null;         // AFFECT のとき、対応するセッション
}

export interface AffectActual { id: ID; predictionId: ID; intensity: number; durationMin: number; at: EpochMs } // 追記専用

export type CommitmentCondition = 'ON_MET' | 'ON_UNMET';
export interface Commitment { id: ID; goalId: ID; condition: CommitmentCondition; nextAction: string; createdAt: EpochMs } // 追記専用、1〜80

export interface JudgmentRequest { goalId: ID; requestedAt: EpochMs; detectedAt: EpochMs } // 追記専用、主キー goalId

export type JudgmentOutcome = 'MET' | 'UNMET';
export interface Judgment {     // 追記専用
  id: ID;
  goalId: ID;                   // 一意
  outcome: JudgmentOutcome;     // サーバー側ではなく domain で計算する。UI から受け取らない
  actualValue: number;
  investedHours: number | null; // UNMET のとき必須
  costNote: string | null;      // UNMET のとき必須、1〜200
  requestedAt: EpochMs;         // JudgmentRequest からコピー
  detectedAt: EpochMs;
  judgedAt: EpochMs;
  enforced: boolean;            // 判定の強制が有効な条件で行われたか（§9）
}

export interface JudgmentCorrection { // 追記専用
  id: ID;
  judgmentId: ID;
  field: 'actualValue' | 'investedHours' | 'costNote';
  newValue: number | string;
  reason: string;               // 1〜200
  createdAt: EpochMs;
}

export interface DeadlineExtension { id: ID; goalId: ID; previousDeadline: LocalDate; newDeadline: LocalDate; reason: string; createdAt: EpochMs } // 追記専用

export type StallRule = 'EXTENSION_3X' | 'NO_FOLLOW_UP_30D' | 'REPEATED_UNMET_3X';
export interface StallFlag { id: ID; goalId: ID; rule: StallRule; detectedAt: EpochMs; dismissedAt: EpochMs | null } // (goalId, rule) 一意

export type FollowUpChoice = 'KIZAMI' | 'RECUT' | 'WITHDRAW';
export interface GoalFollowUp { id: ID; goalId: ID; choice: FollowUpChoice; createdAt: EpochMs } // 追記専用、goalId 一意

// ===== 台帳【統】 =====
export type ImmutableTable =
  | 'measurements' | 'predictions' | 'affectActuals' | 'commitments' | 'judgmentRequests'
  | 'judgments' | 'judgmentCorrections' | 'deadlineExtensions' | 'goalFollowUps';
export interface LedgerEntry { seq?: number; table: ImmutableTable; recordId: string; hash: string; prevHash: string; at: EpochMs }

export const IMMUTABLE_TABLES: readonly ImmutableTable[] = [
  'measurements',
  'predictions',
  'affectActuals',
  'commitments',
  'judgmentRequests',
  'judgments',
  'judgmentCorrections',
  'deadlineExtensions',
  'goalFollowUps',
];
