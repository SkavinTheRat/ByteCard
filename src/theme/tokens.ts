export const colors = {
  bg: '#0A0D13',
  surface: '#11151E',
  surfaceAlt: '#161B26',
  surfaceHigh: '#1D2431',
  border: '#232A38',
  borderStrong: '#313B4F',

  text: '#E8EDF7',
  textDim: '#9AA5BC',
  textMute: '#5D687D',

  primary: '#22D3EE',
  primaryDim: '#0E7490',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
  info: '#A78BFA',

  deck: {
    ds: '#22D3EE',
    co: '#A78BFA',
    os: '#34D399',
    cn: '#FBBF24',
    ai: '#F472B6',
    agent: '#60A5FA',
  },

  primarySoft: '#22D3EE1A',
  dangerSoft: '#F871711A',
  successSoft: '#34D3991A',
  backdrop: '#0A0D13F2',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const type = {
  micro: {
    fontSize: 11,
    fontFamily: fonts.mono,
    lineHeight: 15,
    letterSpacing: 0.6,
  },
  caption: {
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 17,
  },
  small: {
    fontSize: 13,
    fontFamily: fonts.regular,
    lineHeight: 19,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 23,
  },
  card: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    lineHeight: 26,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.semibold,
    lineHeight: 28,
  },
  display: {
    fontSize: 28,
    fontFamily: fonts.monoBold,
    lineHeight: 34,
  },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const stroke = { hair: 1, thin: 1.5, thick: 2 } as const;
