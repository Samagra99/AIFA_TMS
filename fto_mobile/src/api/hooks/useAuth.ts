import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { useAuthStore } from '../../stores/authStore';

export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiClient.post<{ access: string; refresh?: string }>('/auth/token/', data),
    onSuccess(response) {
      const data = response.data;
      let refresh = data.refresh;
      
      // Fallback to extract from Set-Cookie header for mobile client
      if (!refresh && response.headers['set-cookie']) {
        const cookies = Array.isArray(response.headers['set-cookie']) 
          ? response.headers['set-cookie'] 
          : [response.headers['set-cookie']];
        for (const cookieStr of cookies) {
          const match = cookieStr.match(/refresh=([^;]+)/) || cookieStr.match(/refresh_token=([^;]+)/);
          if (match) {
            refresh = match[1];
            break;
          }
        }
      }
      
      useAuthStore.getState().setTokens(data.access, refresh || '');
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const refresh = useAuthStore.getState().refreshToken;
      return apiClient.post('/auth/logout/', { refresh }).then(r => r.data);
    },
    onSuccess() {
      useAuthStore.getState().logout();
      qc.clear();
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/auth/me/').then(r => r.data),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { old_password: string; new_password: string }) =>
      apiClient.post('/auth/me/password/', data).then(r => r.data),
  });
}

export function useSetPin() {
  return useMutation({
    mutationFn: (data: { pin: string }) =>
      apiClient.post('/auth/me/pin/', data).then(r => r.data),
  });
}
