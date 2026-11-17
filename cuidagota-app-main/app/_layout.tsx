import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Palette } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const CuidaGotaTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Palette.water,
    background: Palette.bg,
    card: Palette.bg,
    text: Palette.text,
    border: Palette.border,
    notification: Palette.amber,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={CuidaGotaTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
