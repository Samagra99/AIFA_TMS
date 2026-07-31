import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
