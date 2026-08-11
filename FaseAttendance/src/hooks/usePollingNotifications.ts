import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { apiService } from '../services/api';

const POLL_INTERVAL_MS = 45000; // 45s
const LAST_BROADCAST_KEY = '@fase_last_broadcast_id';
const LAST_CHAT_KEY = '@fase_last_chat_admin_id';
const LAST_LEAVE_KEY = '@fase_last_leave_status_id';


async function isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
}

async function checkBroadcasts() {
    const response = await apiService.getBroadcasts();
    const broadcasts: any[] = response?.broadcasts || [];
    if (!broadcasts.length) return;

    const lastSeenRaw = await AsyncStorage.getItem(LAST_BROADCAST_KEY);
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : null;
    const maxId = Math.max(...broadcasts.map((b) => b.id));

    if (lastSeen === null) {
        await AsyncStorage.setItem(LAST_BROADCAST_KEY, String(maxId));
        return;
    }

    const newOnes = broadcasts.filter((b) => b.id > lastSeen).sort((a, b) => a.id - b.id);
    for (const b of newOnes) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: b.title || 'New announcement',
                body: b.description || '',
                data: { type: 'broadcast' },
            },
            trigger: null,
        });
    }
    if (newOnes.length) {
        await AsyncStorage.setItem(LAST_BROADCAST_KEY, String(maxId));
    }
}

async function checkChat() {
    const response = await apiService.getChatMessages();
    const adminMessages: any[] = (response?.messages || []).filter((m: any) => m.is_from_admin);
    if (!adminMessages.length) return;

    const lastSeenRaw = await AsyncStorage.getItem(LAST_CHAT_KEY);
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : null;
    const maxId = Math.max(...adminMessages.map((m) => m.id));

    if (lastSeen === null) {
        await AsyncStorage.setItem(LAST_CHAT_KEY, String(maxId));
        return;
    }

    const newOnes = adminMessages.filter((m) => m.id > lastSeen).sort((a, b) => a.id - b.id);
    for (const m of newOnes) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: m.sent_by_name || 'Support',
                body: m.text || 'New message',
                data: { type: 'chat_reply' },
            },
            trigger: null,
        });
    }
    if (newOnes.length) {
        await AsyncStorage.setItem(LAST_CHAT_KEY, String(maxId));
    }
}

async function checkLeaveApprovals() {
    const response = await apiService.getMyLeaves();
    const leaves: any[] = response?.leaves || [];
    const decided = leaves.filter((l) => l.status === 'Approved' || l.status === 'Rejected');
    if (!decided.length) return;

    const lastSeenRaw = await AsyncStorage.getItem(LAST_LEAVE_KEY);
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : null;
    const maxId = Math.max(...decided.map((l) => l.id));

    if (lastSeen === null) {
        await AsyncStorage.setItem(LAST_LEAVE_KEY, String(maxId));
        return;
    }

    const newOnes = decided.filter((l) => l.id > lastSeen).sort((a, b) => a.id - b.id);
    for (const l of newOnes) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: l.status === 'Approved' ? 'Leave Approved' : 'Leave Rejected',
                body: `${l.leave_type}: ${l.from_date} → ${l.to_date}`,
                data: { type: 'leave_status' },
            },
            trigger: null,
        });
    }
    if (newOnes.length) {
        await AsyncStorage.setItem(LAST_LEAVE_KEY, String(maxId));
    }
}

async function pollOnce() {
    try {
        if (!(await isLoggedIn())) return;
        await Promise.all([checkBroadcasts(), checkChat(), checkLeaveApprovals()]);
    } catch {
        // best-effort
    }
}

export function clearPollingNotificationState() {
    AsyncStorage.multiRemove([LAST_BROADCAST_KEY, LAST_CHAT_KEY, LAST_LEAVE_KEY]).catch(() => { });
}

export function usePollingNotifications() {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        pollOnce();
        intervalRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);

        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') pollOnce();
        });

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            sub.remove();
        };
    }, []);
}