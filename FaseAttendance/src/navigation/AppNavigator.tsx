// AppNavigator.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { getExpoPushToken } from '../hooks/usePushNotifications';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FaceEnrollmentScreen from '../screens/FaceEnrollmentScreen';
import TaskScreen from '../screens/TaskScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ViolationsScreen from '../screens/ViolationsScreen';
import MainTabScreen from '../screens/MainTabScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import InactiveProjectsScreen from '../screens/InactiveProjectsScreen';
import LeaveScreen from '../screens/LeaveScreen';
import BroadcastsScreen from '../screens/BroadcastsScreen';
import SupportChatScreen from '../screens/SupportChatScreen';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = useState<'Login' | 'Main' | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const remembered = await AsyncStorage.getItem('rememberMe');
                const { token } = await apiService.getAuthData();

                if (remembered === 'true' && token) {
                    const stillValid = await apiService.refreshAuthToken();
                    if (stillValid) {
                        // Stamp "app opened today" even on a silent, already-logged-in
                        // session resume — not just on a fresh username/password login.
                        getExpoPushToken()
                            .then((t) => {
                                if (t) apiService.registerPushToken(t);
                            })
                            .catch(() => { });

                        setInitialRoute('Main');
                        return;
                    }
                    await apiService.clearAuthData();

                } else if (token) {
                    // A token exists in storage but "remember me" wasn't set —
                    // don't leave it (and the default Authorization header
                    // getAuthData() just attached) lying around for the login screen.
                    await apiService.clearAuthData();
                }

                setInitialRoute('Login');
            } catch {
                setInitialRoute('Login');
            }
        })();
    }, []);

    if (!initialRoute) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#212c6b" />
            </View>
        );
    }

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="Main" component={MainTabScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="FaceEnrollment" component={FaceEnrollmentScreen} />
                <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
                <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
                <Stack.Screen name="InactiveProjects" component={InactiveProjectsScreen} />
                <Stack.Screen name="Leave" component={LeaveScreen} />
                <Stack.Screen name="Projects" component={TaskScreen} />
                <Stack.Screen name="Violations" component={ViolationsScreen} />
                <Stack.Screen name="Documents" component={DocumentsScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Broadcasts" component={BroadcastsScreen} />
                <Stack.Screen name="SupportChat" component={SupportChatScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;