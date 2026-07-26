const fs = require('fs');
const path = require('path');

const write = (p, content) => {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, content);
};

const appDir = 'e:/AIFA/AIFA_TMS/fto_mobile/src/app';

const rootLayout = `import { useEffect } from 'react';
import { Slot, SplashScreen } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  const isAuthReady = true;

  useEffect(() => {
    if (isAuthReady) {
      SplashScreen.hideAsync();
    }
  }, [isAuthReady]);

  if (!isAuthReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}
`;

const authLayout = `import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
`;

const loginPage = `import { View, Text } from 'react-native';

export default function Login() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Login Screen</Text>
    </View>
  );
}
`;

const appLayout = `import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="roster" options={{ title: 'Roster', tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> }} />
      <Tabs.Screen name="dispatch" options={{ title: 'Dispatch', tabBarIcon: ({ color }) => <Ionicons name="airplane" size={24} color={color} /> }} />
      <Tabs.Screen name="fleet" options={{ title: 'Fleet', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} />
      <Tabs.Screen name="syllabus" options={{ title: 'Syllabus', tabBarIcon: ({ color }) => <Ionicons name="book" size={24} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color }) => <Ionicons name="time" size={24} color={color} /> }} />
      <Tabs.Screen name="logbook" options={{ title: 'Logbook', tabBarIcon: ({ color }) => <Ionicons name="journal" size={24} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Ionicons name="menu" size={24} color={color} /> }} />
    </Tabs>
  );
}
`;

write(path.join(appDir, '_layout.tsx'), rootLayout);
write(path.join(appDir, '(auth)', '_layout.tsx'), authLayout);
write(path.join(appDir, '(auth)', 'login.tsx'), loginPage);
write(path.join(appDir, '(app)', '_layout.tsx'), appLayout);

const uiDir = 'e:/AIFA/AIFA_TMS/fto_mobile/src/components/ui';

const btnCode = `import { Pressable, Text, StyleSheet } from 'react-native';
export const Button = (props) => <Pressable style={styles.btn}><Text>Button</Text></Pressable>;
const styles = StyleSheet.create({ btn: { padding: 8 }});
`;
const cardCode = `import { View, StyleSheet } from 'react-native';
export const Card = (props) => <View style={styles.card}>{props.children}</View>;
const styles = StyleSheet.create({ card: { padding: 16, borderRadius: 8, borderWidth: 1 }});
`;
const badgeCode = `import { View, Text, StyleSheet } from 'react-native';
export const Badge = (props) => <View style={styles.badge}><Text>{props.title}</Text></View>;
const styles = StyleSheet.create({ badge: { padding: 4, borderRadius: 12 }});
`;
const modalCode = `import { Modal as RNModal, View, Text } from 'react-native';
export const Modal = (props) => <RNModal><View><Text>Modal</Text></View></RNModal>;
`;
const spinnerCode = `import { ActivityIndicator } from 'react-native';
export const Spinner = (props) => <ActivityIndicator {...props} />;
`;
const inputCode = `import { TextInput, View, Text } from 'react-native';
export const Input = (props) => <View><Text>Label</Text><TextInput /></View>;
`;
const indexUiCode = `export * from './Button';
export * from './Card';
export * from './Badge';
export * from './Modal';
export * from './Spinner';
export * from './Input';
`;

write(path.join(uiDir, 'Button.tsx'), btnCode);
write(path.join(uiDir, 'Card.tsx'), cardCode);
write(path.join(uiDir, 'Badge.tsx'), badgeCode);
write(path.join(uiDir, 'Modal.tsx'), modalCode);
write(path.join(uiDir, 'Spinner.tsx'), spinnerCode);
write(path.join(uiDir, 'Input.tsx'), inputCode);
write(path.join(uiDir, 'index.ts'), indexUiCode);

console.log('App Layout and UI components created successfully.');
