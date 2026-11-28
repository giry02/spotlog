const totalLabelLevels = [
  ['최종 결제 금액', '총 결제 금액', '실 결제 금액', '결제할 금액', '받을 금액', 'grand total', 'amount due'],
  ['결제 금액', '합계 금액', '판매 합계', '결제 합계', '구매 합계', '총 구매 금액', '총 합계', 'total amount'],
  ['합계', '총액', '총 금액', 'total'],
];

const totalPatterns = totalLabelLevels.map(labels => new RegExp(
  '^(?:' + labels.map(label => label.replace(/ /g, '').split('').join('[ \\t]*')).join('|') + ')\\s*(.*)$',
  'i',
));

function amountFromText(value: string): number | undefined {
  const match = /^[=:\s]*(?:[₩￦]\s*)?(\d{1,3}(?:[,.\s]\d{3})+|\d{1,13})\s*(?:원|KRW)?\s*$/i.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1].replace(/[,.\s]/g, ''));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000_000_000 ? amount : undefined;
}

/** Return a reviewable candidate only when a receipt's own total label identifies a single amount. */
export function receiptTotalFromText(raw: string): number | undefined {
  const lines = raw.normalize('NFKC').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const pattern of totalPatterns) {
    const candidates = new Set<number>();
    for (const [index, line] of lines.entries()) {
      const match = pattern.exec(line);
      if (!match) continue;
      const suffix = match[1].trim();
      const amount = amountFromText(!suffix || /^[:=]$/.test(suffix) ? (lines[index + 1] ?? '') : suffix);
      if (amount !== undefined) candidates.add(amount);
    }
    if (candidates.size > 1) return undefined;
    if (candidates.size === 1) return candidates.values().next().value;
  }
  return undefined;
}
