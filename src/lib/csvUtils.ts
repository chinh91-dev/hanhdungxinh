import { Card, CardType } from '@/types/flashcard';

export function exportToCSV(cards: Card[], setName: string) {
  const headers = ['Front', 'Back', 'Type'];
  const rows = cards.map(card => [
    card.front,
    card.back,
    card.card_type
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${setName}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseCSV(csvText: string): { front: string; back: string; card_type: CardType }[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const cards: { front: string; back: string; card_type: CardType }[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
    if (!match || match.length < 2) continue;

    const values = match.map(val => {
      let cleaned = val.replace(/^,/, '').trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
      }
      return cleaned;
    });

    const front = values[0] || '';
    const back = values[1] || '';
    const type = values[2]?.toLowerCase() === 'question' ? 'question' : 'term';

    if (front && back) {
      cards.push({ front, back, card_type: type });
    }
  }

  return cards;
}