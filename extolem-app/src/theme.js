export const colors = {
  // Extolem brand — deep navy + electric blue
  bg: '#070B14',
  bgElevated: '#0C1322',
  bgCard: '#0F1828',
  bgInput: '#0A1120',
  border: '#1C2A42',
  borderLight: '#26374f',

  accent: '#3B82F6',
  accentDark: '#2563EB',
  accentLight: '#60A5FA',
  accentGlow: 'rgba(59, 130, 246, 0.14)',
  accentGlowSoft: 'rgba(59, 130, 246, 0.07)',

  white: '#FFFFFF',
  textPrimary: '#EAF1FF',
  textSecondary: '#93A4C0',
  textMuted: '#566480',

  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
};

// Plain text styles (no fontFamily so the system font renders crisply)
export const fonts = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  extrabold: { fontWeight: '800' },
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 };

export const shadow = {
  card: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  glow: {
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
};

// Avatar helpers (deterministic per name)
export const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#14B8A6', '#F43F5E'];
export function avatarColor(name) {
  const i = (name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}
export function initials(name) {
  return (name || '?').replace('@', '').split(/[\s_.]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
