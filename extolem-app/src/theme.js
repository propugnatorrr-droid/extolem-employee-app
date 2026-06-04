// Extolem design system — values pulled directly from extolem.com (design system v2)
export const colors = {
  // Backgrounds
  bg: '#03060B',
  bgElevated: '#060D14',
  bgCard: '#07111A',
  bgCardHover: '#0A1520',
  bgInput: '#0A1520',

  // Surfaces / panels
  panel: 'rgba(255,255,255,0.038)',
  panelStrong: 'rgba(255,255,255,0.072)',
  panelHover: 'rgba(255,255,255,0.108)',

  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.13)',
  borderMd: 'rgba(255,255,255,0.13)',
  borderStrong: 'rgba(255,255,255,0.20)',
  borderMint: 'rgba(25,245,195,0.24)',

  // Brand — mint is the primary accent
  accent: '#19F5C3',
  accentDark: '#12D4A8',
  accentDeep: '#00BFA6',
  accentLight: '#5CFAD8',
  accentSoft: 'rgba(25,245,195,0.09)',
  accentGlow: 'rgba(25,245,195,0.12)',
  accentGlowSoft: 'rgba(25,245,195,0.06)',

  // Secondary brand
  blue: '#4A7DFF',
  blueDim: 'rgba(74,125,255,0.09)',
  purple: '#7657FF',
  purpleDim: 'rgba(118,87,255,0.09)',

  // Text
  white: '#FFFFFF',
  textPrimary: '#EEF9F4',
  textSecondary: '#8FA89E',
  textMuted: 'rgba(143,168,158,0.5)',
  textDim: 'rgba(143,168,158,0.32)',

  // Status
  success: '#19F5C3',
  successBg: 'rgba(25,245,195,0.09)',
  warning: '#FFD166',
  warningBg: 'rgba(255,209,102,0.09)',
  danger: '#FF4D5E',
  dangerBg: 'rgba(255,77,94,0.09)',
};

export const fonts = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  extrabold: { fontWeight: '800' },
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 32, full: 9999 };

export const shadow = {
  card: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 6,
  },
  glow: {
    shadowColor: '#19F5C3', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 20, elevation: 8,
  },
};

export const AVATAR_COLORS = ['#19F5C3', '#4A7DFF', '#7657FF', '#00BFA6', '#22D3EE', '#FFD166', '#12D4A8', '#FF4D5E'];

export function avatarColor(name) {
  const i = (name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

export function initials(name) {
  return (name || '?').replace('@', '').split(/[\s_.]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
