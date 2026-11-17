import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Fonts, Palette } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Palette.water,
        tabBarInactiveTintColor: Palette.textFaint,
        tabBarStyle: {
          backgroundColor: Palette.bg,
          borderTopColor: Palette.border,
          borderTopWidth: 1,
          elevation: 0,
          ...(Platform.OS === 'web' ? { height: 64 } : null),
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.sans,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        sceneStyle: { backgroundColor: Palette.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Consumo',
          tabBarIcon: ({ color }) => <Feather name="droplet" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: 'Info',
          tabBarIcon: ({ color }) => <Feather name="info" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
