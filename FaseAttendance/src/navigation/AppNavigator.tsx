// AppNavigator.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import LeaveScreen from '../screens/LeaveScreen';
import BroadcastsScreen from '../screens/BroadcastsScreen';
import SupportChatScreen from '../screens/SupportChatScreen';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="Main" component={MainTabScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="FaceEnrollment" component={FaceEnrollmentScreen} />
                <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
                <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
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