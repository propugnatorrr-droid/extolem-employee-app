import { Platform } from 'react-native';

export const colors = {
  // Extolem — refined deep navy with a single confident blue accent
  bg: '#0A0E17',
  bgElevated: '#0E1320',
  bgCard: '#141B2B',
  bgCardHover: '#1A2336',
  bgInput: '#10172680',
  border: '#1E2839',
  borderSoft: '#1A2230',

  accent: '#4C8DFF',
  accentDark: '#2E6BE6',
  accentLight: '#7CABFF',
  accentSoft: 'rgba(76, 141, 255, 0.12)',
  accentFaint: 'rgba(76, 141, 255, 0.06)',

  white: '#FFFFFF',
  textPrimary: '#F2F5FC',
  textSecondary: '#A6B2C9',
  textMuted: '#5E6B82',

  success: '#34D399',
  successBg: 'rgba(52, 211, 153, 0.12)',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.12)',
  danger: '#F87171',
  dangerBg: 'rgba(248, 113, 113, 0.12)',
};

export const fonts = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  extrabold: { fontWeight: '800' },
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 };

// Softer, more natural depth — no harsh blue glow everywhere
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#FB923C', '#34D399', '#4C8DFF', '#2DD4BF', '#F472B6'];

export function avatarColor(name) {
  const key = name || '?';
  const i = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

export function initials(name) {
  return (name || '?')
    .replace('@', '')
    .split(/[\s_.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}
