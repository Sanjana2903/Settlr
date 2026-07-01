export const colors = {
  background: '#FFFFFF',
  surface: '#F6F7F9',
  border: '#E5E7EB',
  text: '#111318',
  textMuted: '#6B7280',
  primary: '#0F766E',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const },
  heading: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
