/**
 * 共用 CSV 解析（零依赖 RFC4180 迷你解析器）
 *
 * 自 routers/storedValue.ts 抽出（员工端骨架整建批 片 2）：BOM / CRLF / 引号转义 /
 * 引号内逗号换行全兼容，行为与原实现一致；储值台账导入与排班导入共用同一解析器。
 */

/** RFC4180 迷你解析器：返回二维字符串数组（含表头行） */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, ''); // UTF-8 BOM
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
