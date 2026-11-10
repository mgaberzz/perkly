import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { t } from '@/lib/i18n';
import { useOnline } from '@/lib/net';
import { useSession } from '@/lib/session';

/** A slim bar at the top while offline; refreshes everything once the connection is back. */
export function OfflineBar() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { session, refreshProfile, refreshMerchants } = useSession();
  const wasOffline = useRef(false);
  const [back, setBack] = useState(false);

  useEffect(() => {
    if (online === false) wasOffline.current = true;
    if (online && wasOffline.current) {
      wasOffline.current = false;
      if (session) { refreshProfile(); refreshMerchants(); }
      setBack(true);
      const timer = setTimeout(() => setBack(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [online, session, refreshProfile, refreshMerchants]);

  if (online !== false && !back) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: insets.top + 4, paddingBottom: 6, paddingHorizontal: 16, backgroundColor: back ? '#12B76A' : '#1F1A2E' }}>
      <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 13 }}>
        {back ? t('Back Online ✓') : t('No Connection: Showing Saved Perks')}
      </Text>
    </View>
  );
}
