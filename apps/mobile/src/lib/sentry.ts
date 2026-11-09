// Crash and error reports from students' phones. Does nothing until EXPO_PUBLIC_SENTRY_DSN is set (eas.json).
// Reports carry the error, the screen and the student's internal ID only: no name, phone, email, IP,
// screenshots or request contents.
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : (process.env.EXPO_PUBLIC_APP_ENV ?? 'production'),
    release: `perkly@${Constants.expoConfig?.version ?? '0'}`,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    reportAccessibilityIdentifier: false,
    tracesSampleRate: 0.1,
    // Keep URLs but drop their query strings: Supabase filters can contain IDs or search text
    beforeBreadcrumb(b) {
      if ((b.category === 'fetch' || b.category === 'xhr') && typeof b.data?.url === 'string') {
        b.data.url = b.data.url.split('?')[0];
      }
      return b;
    },
  });
}

export const sentryEnabled = !!dsn;

/** Tag reports with the signed-in account (internal ID only), or clear it on sign-out. */
export function setSentryUser(id: string | null) {
  if (dsn) Sentry.setUser(id ? { id } : null);
}

export { Sentry };
