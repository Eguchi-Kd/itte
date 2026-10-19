// CSV（§8.12.3）。1テーブル1ファイル、BOM 付き UTF-8、CRLF。瞬間の列は ISO 8601、配列とオブジェクトは JSON 文字列
import { DATA_TABLES, TABLE_SCHEMAS, type DataTableName } from './exportSchema';

const BOM = '﻿';
const CRLF = '\r\n';

/** 瞬間（EpochMs）の列。at と、名前が At で終わる列 */
export function isEpochColumn(key: string): boolean {
  return key === 'at' || /At$/.test(key);
}

function cell(key: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return isEpochColumn(key) ? new Date(value).toISOString() : String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function quote(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** レコードの配列を CSV にする。列はスキーマの順 */
export function toCsv(columns: readonly string[], rows: readonly object[]): string {
  const lines = [columns.map(quote).join(',')];
  for (const r of rows) lines.push(columns.map((c) => quote(cell(c, (r as Record<string, unknown>)[c]))).join(','));
  return BOM + lines.join(CRLF) + CRLF;
}

export function columnsOf(table: DataTableName): string[] {
  return Object.keys(TABLE_SCHEMAS[table].shape);
}

/** 全テーブルを { 'habits.csv': '…' } の形にする */
export function tablesToCsvFiles(tables: Partial<Record<DataTableName, readonly object[]>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of DATA_TABLES) out[`${t}.csv`] = toCsv(columnsOf(t), tables[t] ?? []);
  return out;
}

/** RFC 4180 の CSV を行と列に分ける（BOM と CRLF に対応） */
export function parseCsv(text: string): string[][] {
  const s = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Kind = 'number' | 'boolean' | 'json' | 'string' | 'numberOrString';

interface ZodLike {
  _zod: { def: { type: string; innerType?: ZodLike; options?: ZodLike[]; values?: unknown[] } };
}

/** スキーマの型から、CSV の文字列を戻す方法を決める */
function kindOf(t: ZodLike): Kind {
  const def = t._zod.def;
  switch (def.type) {
    case 'nullable':
    case 'optional':
      return def.innerType ? kindOf(def.innerType) : 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
    case 'object':
    case 'record':
    case 'tuple':
      return 'json';
    case 'literal':
      return typeof def.values?.[0] === 'number' ? 'number' : 'string';
    case 'union': {
      const kinds = new Set((def.options ?? []).map(kindOf));
      if (kinds.size === 1) return [...kinds][0];
      if (kinds.has('json')) return 'json';
      return 'numberOrString';
    }
    default:
      return 'string';
  }
}

function revive(key: string, kind: Kind, raw: string): unknown {
  if (raw === '') return kind === 'string' ? null : null;
  switch (kind) {
    case 'number':
      return isEpochColumn(key) && /T/.test(raw) ? Date.parse(raw) : Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'json':
      return JSON.parse(raw);
    case 'numberOrString':
      return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    default:
      return raw;
  }
}

/** 書き出した CSV を、そのテーブルのレコードに読み戻す（スキーマで検証する） */
export function csvToRecords<T extends DataTableName>(table: T, text: string): unknown[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const schema = TABLE_SCHEMAS[table];
  const shape = schema.shape as Record<string, ZodLike>;
  return rows
    .filter((r) => r.length > 1 || r[0] !== '')
    .map((r) => {
      const obj: Record<string, unknown> = {};
      header.forEach((key, i) => {
        const field = shape[key];
        if (!field) return;
        const value = revive(key, kindOf(field), r[i] ?? '');
        // 空文字の必須文字列は空のまま戻す（null にしない）
        obj[key] = value === null && kindOf(field) === 'string' && field._zod.def.type !== 'nullable' ? '' : value;
      });
      return schema.parse(obj);
    });
}
