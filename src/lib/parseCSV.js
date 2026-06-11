import Papa from 'papaparse';

const POSITIONS_START_ROW = 7; // 0-indexed row 8 = index 7

const COLUMNS = [
  'open_time', 'ticket', 'symbol', 'direction', 'volume',
  'open_price', 'sl', 'tp', 'close_time', 'close_price',
  'commission', 'swap', 'profit',
];

function parseDateTime(str) {
  if (!str) return null;
  // MT5 format: "2024.01.15 09:30:00" → "2024-01-15T09:30:00"
  const normalized = str.trim().replace(/\./g, '-').replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function calcDurationMins(openStr, closeStr) {
  const open = parseDateTime(openStr);
  const close = parseDateTime(closeStr);
  if (!open || !close) return null;
  return Math.round((close - open) / 60000);
}

function safeFloat(val) {
  const str = String(val ?? '')
    // All Unicode minus-like characters → ASCII hyphen-minus
    .replace(/[−–—‑‐﹘﹣－]/g, '-')
    // Remove whitespace variants (non-breaking space, zero-width, BOM)
    .replace(/[ ​‌‍﻿\s]/g, '')
    .trim();
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

export function parseMT5CSV(csvText) {
  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: false });

  // Log the first buy row's raw profit value + char codes to pinpoint encoding issues
  const firstBuyRow = rows.find(r => r[3]?.trim().toLowerCase() === 'buy');
  if (firstBuyRow) {
    const raw = firstBuyRow[12] ?? '';
    console.log('[parseCSV] first buy profit — raw:', JSON.stringify(raw),
      '| char codes:', [...raw].map(c => c.charCodeAt(0)));
  }

  const tradeRows = rows.slice(POSITIONS_START_ROW);

  const seen = new Set();
  const trades = [];

  for (const row of tradeRows) {
    if (!row || row.length < COLUMNS.length) continue;

    const MT5_DATE = /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/;
    const openTime = row[0]?.trim();
    const closeTime = row[8]?.trim();
    if (!MT5_DATE.test(openTime) || !MT5_DATE.test(closeTime)) continue;

    const direction = row[3]?.trim().toLowerCase();
    if (direction !== 'buy' && direction !== 'sell') continue;

    const ticket = row[1]?.trim();
    if (!ticket || seen.has(ticket)) continue;
    seen.add(ticket);

    const trade = {};
    COLUMNS.forEach((col, i) => {
      const val = row[i]?.trim() ?? '';
      trade[col] = val;
    });

    const numericFields = ['volume', 'open_price', 'sl', 'tp', 'close_price', 'commission', 'swap', 'profit'];
    for (const field of numericFields) {
      trade[field] = safeFloat(trade[field]);
    }

    trade.duration_mins = calcDurationMins(trade.open_time, trade.close_time);
    trade.open_date = parseDateTime(trade.open_time);
    trade.close_date = parseDateTime(trade.close_time);

    trades.push(trade);
  }

  const nullCount = trades.filter(t => t.profit === null).length;
  const negCount  = trades.filter(t => t.profit !== null && t.profit < 0).length;
  console.log(`[parseCSV] ${trades.length} trades — ${negCount} losses, ${nullCount} null profit`);

  return trades;
}
