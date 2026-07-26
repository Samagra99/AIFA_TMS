/**
 * Root Layout — entry point for the entire app.
 * Wraps with QueryClientProvider, handles auth state hydration,
 * and manages splash screen visibility.
 * Also initializes the Offline Sync Engine.
 */
import { useEffect, useState, useRef } from 'react';
import { Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';
import { useColorScheme } from 'react-native';
import { initSyncEngine, stopSyncEngine } from '../db/syncEngine';
import { SyncStatusBar, AogBanner } from '../components/ui';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../lib/notifications';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Setup push notifications when authenticated
    if (isAuthenticated) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          // Normally we would send this token to the backend here:
          // apiClient.post('/auth/me/device-token/', { token });
          console.log('Got Push Token:', token);
        }
      });

      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Received notification in foreground:', notification);
        // Could update UI store with AOG alerts based on notification payload here
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('User tapped notification:', response);
        // Handle navigation based on notification payload
      });
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
      stopSyncEngine(); // Stop syncing if logged out
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to app if authenticated but on auth screen
      router.replace('/(app)/(tabs)/dashboard');
      initSyncEngine(); // Start syncing when logged in
    } else if (isAuthenticated) {
      initSyncEngine(); // Ensure it's running
    }
  }, [isAuthenticated, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hydrate auth state from SecureStore
    async function prepare() {
      try {
        // Zustand persist will auto-hydrate from SecureStore
        // Give it a moment to load
        await new Promise((resolve) => setTimeout(resolve, 500));
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();

    return () => {
      stopSyncEngine();
    };
  }, []);

  if (!appReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AuthGate>
        <SyncStatusBar />
        <AogBanner />
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
