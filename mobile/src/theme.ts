import { useColorScheme } from 'react-native';

/** Paleta: caramida calda pe fundal crem - alimentar fara sa fie strident. */
const light = {
  bg: '#FFF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F5EEE8',
  border: '#EADFD5',
  text: '#221A15',
  textMuted: '#7C6C60',
  textFaint: '#A8988C',
  primary: '#C0392B',
  primaryText: '#FFFFFF',
  danger: '#B3261E',
  skeleton: '#EFE6DE',
};

const dark: typeof light = {
  bg: '#17120F',
  surface: '#221B17',
  surfaceAlt: '#2B221D',
  border: '#3A2E27',
  text: '#F6EFE9',
  textMuted: '#B4A296',
  textFaint: '#7E6E63',
  primary: '#E05C4A',
  primaryText: '#1A1310',
  danger: '#F2776A',
  skeleton: '#2B221D',
};

export type Colors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
