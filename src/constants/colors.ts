export interface PaletteColor {
  hex: string;
  name: string;
}

export const BUDGET_PALETTE_32: PaletteColor[] = [
  { hex: '#ef4444', name: 'Rouge vif' },
  { hex: '#dc2626', name: 'Rouge carmin' },
  { hex: '#f97316', name: 'Orange intense' },
  { hex: '#ea580c', name: 'Orange brûlé' },
  { hex: '#f59e0b', name: 'Ambre solaire' },
  { hex: '#d97706', name: 'Ocre doré' },
  { hex: '#eab308', name: 'Jaune d’or' },
  { hex: '#ca8a04', name: 'Moutarde' },
  { hex: '#84cc16', name: 'Citron vert' },
  { hex: '#65a30d', name: 'Olive vive' },
  { hex: '#22c55e', name: 'Vert émeraude' },
  { hex: '#16a34a', name: 'Vert forêt' },
  { hex: '#10b981', name: 'Menthe vive' },
  { hex: '#059669', name: 'Vert pin' },
  { hex: '#14b8a6', name: 'Turquoise' },
  { hex: '#0d9488', name: 'Cyan profond' },
  { hex: '#06b6d4', name: 'Bleu lagon' },
  { hex: '#0891b2', name: 'Bleu canard' },
  { hex: '#0ea5e9', name: 'Bleu ciel' },
  { hex: '#0284c7', name: 'Bleu azur' },
  { hex: '#3b82f6', name: 'Bleu roi' },
  { hex: '#2563eb', name: 'Bleu cobalt' },
  { hex: '#6366f1', name: 'Indigo vif' },
  { hex: '#4f46e5', name: 'Indigo profond' },
  { hex: '#8b5cf6', name: 'Violet éclatant' },
  { hex: '#7c3aed', name: 'Pourpre foncé' },
  { hex: '#a855f7', name: 'Mauve lilas' },
  { hex: '#9333ea', name: 'Améthyste' },
  { hex: '#d946ef', name: 'Fuchsia' },
  { hex: '#c026d3', name: 'Magenta' },
  { hex: '#ec4899', name: 'Rose bonbon' },
  { hex: '#e11d48', name: 'Framboise' },
];

/**
 * Trouve la première couleur libre dans la palette non encore utilisée par d'autres lignes.
 */
export function getFirstAvailableColor(usedColors: string[]): string {
  const normalizedUsed = usedColors.map((c) => c.toLowerCase());
  const found = BUDGET_PALETTE_32.find((c) => !normalizedUsed.includes(c.hex.toLowerCase()));
  return found ? found.hex : BUDGET_PALETTE_32[0].hex;
}
