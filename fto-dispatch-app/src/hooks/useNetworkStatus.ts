import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
  isConnected: boolean;
  connectionType: string | null;
  isInternetReachable: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    connectionType: null,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        connectionType: state.type ?? null,
        isInternetReachable: state.isInternetReachable ?? false,
      });
    });

    // Fetch current state immediately
    NetInfo.fetch().then((state) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        connectionType: state.type ?? null,
        isInternetReachable: state.isInternetReachable ?? false,
      });
    });

    return unsubscribe;
  }, []);

  return status;
}
