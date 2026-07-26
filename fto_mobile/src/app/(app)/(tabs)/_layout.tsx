/**
 * Authenticated App Layout — Role-based tab navigation.
 * Mirrors the web app's Sidebar + routing permissions exactly.
 *
 * Roles → Tabs:
 * - CFI/Superadmin:  Dashboard, Roster, Dispatch, Fleet, Syllabus, More
 * - Instructor:      Dashboard, Roster, Dispatch, Syllabus, More
 * - Dispatcher:      Dashboard, Roster, Dispatch, Fleet, More
 * - Student:         Dashboard, Schedule, Logbook, Documents, More
 * - CAMO:            Dashboard, Fleet, Maintenance, More
 */
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../stores/authStore';
import { useTheme } from '../../../theme';
import type { UserRole } from '../../../types';

type TabConfig = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles: UserRole[];
};

const ALL_TABS: TabConfig[] = [
  { name: 'dashboard',   title: 'Dashboard',   icon: 'grid-outline',          roles: ['superadmin', 'cfi', 'instructor', 'dispatcher', 'student', 'camo', 'safety_officer', 'finance'] },
  { name: 'roster',      title: 'Roster',       icon: 'calendar-outline',      roles: ['superadmin', 'cfi', 'instructor', 'dispatcher'] },
  { name: 'dispatch',    title: 'Dispatch',     icon: 'airplane-outline',      roles: ['superadmin', 'cfi', 'instructor', 'dispatcher'] },
  { name: 'fleet',       title: 'Fleet',        icon: 'navigate-outline',      roles: ['superadmin', 'cfi', 'dispatcher', 'camo', 'student'] },
  { name: 'syllabus',    title: 'Syllabus',     icon: 'book-outline',          roles: ['superadmin', 'cfi', 'instructor'] },
  { name: 'schedule',    title: 'Schedule',     icon: 'calendar-outline',      roles: ['student'] },
  { name: 'logbook',     title: 'Logbook',      icon: 'journal-outline',       roles: ['student'] },
  { name: 'maintenance', title: 'Maintenance',  icon: 'construct-outline',     roles: ['superadmin', 'camo'] },
  { name: 'more',        title: 'More',         icon: 'ellipsis-horizontal',   roles: ['superadmin', 'cfi', 'instructor', 'dispatcher', 'student', 'camo', 'safety_officer', 'finance'] },
];

export default function AppTabLayout() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const userRole = user.role;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {ALL_TABS.map((tab) => {
        const hasAccess = tab.roles.includes(userRole);
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              href: hasAccess ? undefined : null, // null = hidden from tabs
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={tab.icon} size={size} color={color} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
