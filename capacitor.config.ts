import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dk.kroner.budget',
  appName: 'Kroner',
  webDir: 'dist',
  android: {
    // Kvitteringsscanningen kører på enheden og kræver ingen netværkadgang.
    allowMixedContent: false,
    backgroundColor: '#f3f6fb',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
