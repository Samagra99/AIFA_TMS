import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

export function Spinner({ size = 'large', color, fullScreen = false }: SpinnerProps) {
  const { colors } = useTheme();
  
  const content = (
    <ActivityIndicator size={size} color={color || colors.primary} />
  );
  
  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }
  
  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
