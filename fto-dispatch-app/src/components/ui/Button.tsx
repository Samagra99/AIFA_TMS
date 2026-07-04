import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { C } from '../../theme/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  onPress,
  disabled,
  style,
  labelStyle,
  ...rest
}: ButtonProps) {
  const handlePress = async (e: Parameters<NonNullable<TouchableOpacityProps['onPress']>>[0]) => {
    if (disabled || loading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}` as keyof typeof styles],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? C.textInverse : C.amber}
        />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.label,
              styles[`label_${variant}` as keyof typeof styles],
              styles[`label_size_${size}` as keyof typeof styles],
              leftIcon ? styles.labelWithIcon : undefined,
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.4 },

  // Variants
  primary: {
    backgroundColor: C.amber,
    borderColor: C.amber,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: C.amber,
  },
  danger: {
    backgroundColor: C.aog,
    borderColor: C.aog,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },

  // Sizes
  size_sm: { paddingHorizontal: 14, paddingVertical: 8, minHeight: 36 },
  size_md: { paddingHorizontal: 20, paddingVertical: 13, minHeight: 48 },
  size_lg: { paddingHorizontal: 28, paddingVertical: 17, minHeight: 58 },

  // Labels
  label: { fontWeight: '700', letterSpacing: 0.4 },
  label_primary: { color: C.textInverse },
  label_secondary: { color: C.amber },
  label_danger: { color: '#fff' },
  label_ghost: { color: C.textSecondary },
  label_size_sm: { fontSize: 13 },
  label_size_md: { fontSize: 15 },
  label_size_lg: { fontSize: 17 },
  labelWithIcon: { marginLeft: 8 },
});
