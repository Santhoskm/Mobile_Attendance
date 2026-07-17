import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useNetworkSync } from './src/hooks/useNetworkSync';

export default function App() {
  const { syncQueue } = useNetworkSync();
  (globalThis as any).triggerAttendanceSync = syncQueue;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}