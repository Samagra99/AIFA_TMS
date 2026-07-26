import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useLogout } from '../../../api/hooks';
import { Button } from '../../../components/ui';

export default function MoreScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const logout = useAuthStore((state: any) => state.logout);
  const user = useAuthStore((state: any) => state.user);
  
  const { mutate: performLogout } = useLogout();

  const handleLogout = () => {
    performLogout(undefined, {
      onSuccess: () => {
        logout();
      }
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.md,
    },
    profileCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    name: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.lg,
      color: colors.text,
    },
    email: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.md,
      color: colors.subtext,
      marginTop: spacing.xs,
    },
    role: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.primary,
      marginTop: spacing.sm,
    },
    menuItem: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuText: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.md,
      color: colors.text,
    },
    logoutButton: {
      marginTop: spacing.xl,
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <Text style={styles.name}>{user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.role}>{user?.role?.toUpperCase() || 'USER'}</Text>
        </View>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Set/Change PIN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Theme</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>About</Text>
        </TouchableOpacity>

        <View style={styles.logoutButton}>
          <Button variant="danger" onPress={handleLogout}>Logout</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
