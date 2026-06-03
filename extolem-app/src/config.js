import Constants from 'expo-constants';

// Values come from app.json -> expo.extra, or EAS env vars at build time.
// Never hardcode the real token in a public repo again.
const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

export const API_BASE_URL =
  extra.apiBaseUrl || 'https://extolem-employee-app-production.up.railway.app';

export const APP_TOKEN = extra.appToken || '';

if (!APP_TOKEN && __DEV__) {
  console.warn('[config] APP_TOKEN is empty. Set expo.extra.appToken in app.json or via EAS secrets.');
}
