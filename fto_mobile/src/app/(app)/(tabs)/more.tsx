import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useUiStore } from '../../../stores/uiStore';
import { useLogout } from '../../../api/hooks';
import { Button } from '../../../components/ui';

export default function MoreScreen() {
  const { colors, fonts, fontSizes, spacing, themePref } = useTheme();
  const setTheme = useUiStore((state: any) => state.setTheme);
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
    themeSelector: {
      flexDirection: 'row',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    themeBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeBtnText: {
      fontSize: fontSizes.sm,
      color: colors.text,
      textTransform: 'capitalize',
    },
    themeBtnTextActive: {
      color: '#fff',
      fontWeight: 'bold',
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
        
        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Theme</Text>
          <View style={styles.themeSelector}>
            {['system', 'light', 'dark'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.themeBtn, themePref === t && styles.themeBtnActive]}
                onPress={() => setTheme(t)}
              >
                <Text style={[styles.themeBtnText, themePref === t && styles.themeBtnTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
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
