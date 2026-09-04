export const AVATAR_PRESETS = [
  { id: 'initials', label: 'Inicjały',   emoji: null, gradient: 'from-zinc-700 to-zinc-900' },
  { id: 'bull',     label: 'Byk',        emoji: '🐂', gradient: 'from-emerald-600 to-lime-500' },
  { id: 'bear',     label: 'Niedźwiedź', emoji: '🐻', gradient: 'from-red-500 to-orange-500' },
  { id: 'rocket',   label: 'Rakieta',    emoji: '🚀', gradient: 'from-zinc-600 to-zinc-800' },
  { id: 'diamond',  label: 'Diament',    emoji: '💎', gradient: 'from-zinc-400 to-zinc-600' },
  { id: 'chart',    label: 'Wykres',     emoji: '📈', gradient: 'from-profit to-teal-500' },
  { id: 'target',   label: 'Cel',        emoji: '🎯', gradient: 'from-amber-500 to-orange-500' },
  { id: 'wizard',   label: 'Mag',        emoji: '🧙', gradient: 'from-zinc-600 to-emerald-800' },
  { id: 'fox',      label: 'Lis',        emoji: '🦊', gradient: 'from-orange-400 to-red-500' },
  { id: 'shield',   label: 'Tarcza',     emoji: '🛡️', gradient: 'from-slate-500 to-slate-700' },
  { id: 'trophy',   label: 'Puchar',     emoji: '🏆', gradient: 'from-yellow-400 to-amber-500' },
  { id: 'fire',     label: 'Ogień',      emoji: '🔥', gradient: 'from-orange-500 to-red-600' },
];

export function getAvatarPreset(id) {
  return AVATAR_PRESETS.find((p) => p.id === id) || AVATAR_PRESETS[0];
}

export function getUserInitials(user) {
  const name = (user?.displayName || user?.fullName || user?.email || '').trim();
  if (!name) return 'U';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'U';
}

export function getUserDisplayName(user, fallback = '') {
  return (user?.displayName?.trim() || user?.fullName?.trim() || user?.email || fallback);
}
