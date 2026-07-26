import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  title?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  isLoading = false,
  disabled = false,
  onPress,
  children,
  title,
  style,
  fullWidth = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const isBtnLoading = loading || isLoading;
  const isDisabled = disabled || isBtnLoading;
  const content = children ?? title;

  const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: colors.primary, borderWidth: 0 },
      text: { color: '#ffffff' },
    },
    secondary: {
      container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
      text: { color: colors.text },
    },
    danger: {
      container: { backgroundColor: colors.danger, borderWidth: 0 },
      text: { color: '#ffffff' },
    },
    ghost: {
      container: { backgroundColor: 'transparent', borderWidth: 0 },
      text: { color: colors.textSecondary },
    },
    link: {
      container: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 },
      text: { color: colors.primary, textDecorationLine: 'underline' },
    },
  };

  const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
    xs: { container: { paddingHorizontal: 10, paddingVertical: 6 }, text: { fontSize: 12 } },
    sm: { container: { paddingHorizontal: 12, paddingVertical: 6 }, text: { fontSize: 14 } },
    md: { container: { paddingHorizontal: 16, paddingVertical: 8 }, text: { fontSize: 14 } },
    lg: { container: { paddingHorizontal: 24, paddingVertical: 10 }, text: { fontSize: 16 } },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        vs.container,
        ss.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {isBtnLoading && <ActivityIndicator size="small" color={vs.text.color as string} style={styles.loader} />}
      <Text style={[styles.text, vs.text, ss.text]}>
        {typeof content === 'string' ? content : content}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 8,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  loader: { marginRight: 4 },
  text: { fontWeight: '600' },
});
