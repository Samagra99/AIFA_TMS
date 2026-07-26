import { useColorScheme } from 'react-native';
import { colors } from './colors';
import { fonts, fontSizes } from './typography';
import { spacing } from './spacing';

export * from './colors';
export * from './typography';
export * from './spacing';

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: isDark ? colors.dark : colors.light,
    fonts,
    fontSizes,
    spacing,
    isDark,
  };
};
