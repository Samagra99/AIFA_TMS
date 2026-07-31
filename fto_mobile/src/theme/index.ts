import { useColorScheme } from 'react-native';
import { useUiStore } from '../stores/uiStore';
import { colors } from './colors';
import { fonts, fontSizes } from './typography';
import { spacing } from './spacing';

export * from './colors';
export * from './typography';
export * from './spacing';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const themePref = useUiStore((state) => state.theme);
  
  const isDark = themePref === 'system' ? systemScheme === 'dark' : themePref === 'dark';

  return {
    colors: isDark ? colors.dark : colors.light,
    fonts,
    fontSizes,
    spacing,
    isDark,
    themePref,
  };
};
