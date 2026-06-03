import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

export const API_BASE_URL =
  extra.apiBaseUrl || 'https://extolem-employee-app-production.up.railway.app';

export const APP_TOKEN =
  extra.appToken || 'extolem_app_secret_change_this';
