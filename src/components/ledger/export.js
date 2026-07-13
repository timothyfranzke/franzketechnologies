import { signedAmount } from './derive.js';
import { decimalString } from './money.js';

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Spreadsheet-friendly CSV of one account's transactions, oldest first. */
export function buildCsv(account, txs, categories, flags) {
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const flagName = new Map((flags ?? []).map((f) => [f.id, f.name]));
  const header = 'date,payee,category,flag,type,checkNum,memo,amount,cleared,reconciled';
  const rows = [...txs]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((tx) =>
      [
        tx.date,
        csvField(tx.payee),
        csvField(categoryName.get(tx.categoryId) ?? ''),
        csvField(flagName.get(tx.flagId) ?? ''),
        tx.type,
        csvField(tx.checkNum ?? ''),
        csvField(tx.memo ?? ''),
        decimalString(signedAmount(tx, account.id)),
        tx.cleared,
        tx.reconciled,
      ].join(',')
    );
  return [header, ...rows].join('\n');
}

/** iOS share sheet when files are shareable, otherwise a download link. */
export async function shareOrDownload(filename, mime, text) {
  const file = new File([text], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
