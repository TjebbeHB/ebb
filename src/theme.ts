import { useColorScheme } from 'react-native';
import type { Phase } from './logic/cycles';

export interface Palette {
  name: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  period: string;
  periodSoft: string;
  fertile: string;
  fertileSoft: string;
  ovulation: string;
  pms: string;
  pmsSoft: string;
  luteal: string;
  follicular: string;
  danger: string;
  success: string;
  shadow: string;
}

export const light: Palette = {
  name: 'light', bg: '#FFF8E9', surface: '#FCF0DF', surfaceAlt: '#F4E5D1',
  border: '#DDC8AE', text: '#35291F', textMuted: '#786550', textFaint: '#89745D',
  accent: '#C64C0C', accentSoft: '#F9E2C8', onAccent: '#FFFFFF',
  period: '#C64C0C', periodSoft: '#F4D0AE', fertile: '#776A42', fertileSoft: '#E3DBC2',
  ovulation: '#655630', pms: '#9B6229', pmsSoft: '#EFDDC0', luteal: '#957052',
  follicular: '#A28D70', danger: '#AF3725', success: '#526B46', shadow: 'rgba(53,41,31,0.06)',
};

export const dark: Palette = {
  name: 'dark', bg: '#211B16', surface: '#2D251E', surfaceAlt: '#3B3026',
  border: '#594533', text: '#FFF3DF', textMuted: '#CCB699', textFaint: '#BAA084',
  accent: '#F4A267', accentSoft: '#4B3020', onAccent: '#2C1C10',
  period: '#F4A267', periodSoft: '#5C3824', fertile: '#CCCE9C', fertileSoft: '#3E402B',
  ovulation: '#E0D69A', pms: '#E7BD80', pmsSoft: '#4B3A26', luteal: '#D3AF8F',
  follicular: '#C1AC8B', danger: '#F09A86', success: '#ADC593', shadow: 'rgba(0,0,0,0.25)',
};

export const typeface = {
  serif: 'DMSerifDisplay_400Regular',
  regular: 'DMSans_400Regular', medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold', bold: 'DMSans_700Bold',
};

export function usePalette(pref: 'system' | 'light' | 'dark'): Palette {
  const system = useColorScheme();
  if (pref === 'light') return light;
  if (pref === 'dark') return dark;
  return system === 'dark' ? dark : light;
}

export function phaseColor(p: Palette, phase: Phase | undefined): string {
  switch (phase) {
    case 'period': return p.period;
    case 'fertile': return p.fertile;
    case 'ovulation': return p.ovulation;
    case 'pms': return p.pms;
    case 'luteal': return p.luteal;
    case 'follicular': return p.follicular;
    default: return p.textFaint;
  }
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const font = {
  display: 34,
  title: 24,
  heading: 18,
  body: 16,
  small: 14,
  tiny: 12,
} as const;
