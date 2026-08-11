import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { navigate } from '../navigation/navigationRef';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chat', {
            name: 'Support chat',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });
        await Notifications.setNotificationChannelAsync('broadcast', {
            name: 'Announcements',
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
    );
    return tokenResponse.data;
}

export function usePushNotificationListeners() {
    const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

    useEffect(() => {
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data as { type?: string };
            if (data?.type === 'broadcast') navigate('Broadcasts');
            else if (data?.type === 'chat_reply') navigate('SupportChat');
            else if (data?.type === 'leave_status') navigate('Leave');
        });
        return () => responseListener.current?.remove();
    }, []);
}