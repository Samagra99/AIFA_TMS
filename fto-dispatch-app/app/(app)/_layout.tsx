import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlertsStore } from '../../src/store/alerts.store';
import { C } from '../../src/theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function AppLayout() {
  const unreadCount = useAlertsStore((s) => s.unreadCount);
  const hasActiveAog = useAlertsStore((s) => s.hasActiveAog);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: isTablet ? 72 : 62,
          paddingBottom: isTablet ? 12 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: C.amber,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dispatch',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="paper-plane-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: 'Fleet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons
                name={hasActiveAog ? 'warning' : 'notifications-outline'}
                size={size}
                color={hasActiveAog ? C.aog : color}
              />
              {unreadCount > 0 && (
                <View style={[styles.badge, hasActiveAog && styles.badgeAog]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: C.info,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeAog: { backgroundColor: C.aog },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
