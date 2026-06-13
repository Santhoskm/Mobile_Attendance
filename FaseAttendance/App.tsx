import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useNetworkSync } from './src/hooks/useNetworkSync';

export default function App() {
  useNetworkSync();

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}