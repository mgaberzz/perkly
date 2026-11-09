import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** true / false once known; null while checking. Treats "connected but no internet" as offline. */
export function useOnline() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(Boolean(s.isConnected) && s.isInternetReachable !== false)), []);
  return online;
}
