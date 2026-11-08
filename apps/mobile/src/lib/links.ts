import { lang } from './i18n';

/** The Perkly web portal, which hosts the public legal pages. Set EXPO_PUBLIC_WEB_URL once the custom domain is live. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://perkly-five.vercel.app').replace(/\/$/, '');

/** Terms of Use or Privacy Policy, opened in the app's current language. */
export const legalUrl = (kind: 'terms' | 'privacy') => `${WEB_URL}/${kind}?lang=${lang()}`;
