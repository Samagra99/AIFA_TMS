import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../../theme';

export default function MaintenanceScreen() {
  const { colors, fonts, fontSizes } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.xl,
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.md,
      color: colors.subtext,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Maintenance Records</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </SafeAreaView>
  );
}
