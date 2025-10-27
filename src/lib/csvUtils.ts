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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by first comma only
    const commaIndex = line.indexOf(',');
    if (commaIndex === -1) continue;

    const front = line.substring(0, commaIndex).trim();
    const back = line.substring(commaIndex + 1).trim();

    if (front && back) {
      cards.push({ front, back, card_type: 'term' });
    }
  }

  return cards;
}