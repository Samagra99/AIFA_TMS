import { useWindowDimensions } from 'react-native';

/**
 * Hook to determine if the device has a tablet-sized screen.
 * Considers a screen width >= 768px as a tablet layout.
 */
export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= 768;
}
