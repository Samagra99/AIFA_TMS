import { Slot, Redirect } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
