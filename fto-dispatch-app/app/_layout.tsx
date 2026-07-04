import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/auth.store';
import { C } from '../src/theme/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isBooting, setIsBooting] = useState(true);
  const { isAuthenticated, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession().finally(() => {
      setIsBooting(false);
      SplashScreen.hideAsync();
    });
  }, [restoreSession]);

  if (isBooting) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={C.amber} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="dispatch/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
      </Stack>

      {/* Redirect to correct group based on auth state */}
      {!isAuthenticated && <Redirect href="/(auth)/login" />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
