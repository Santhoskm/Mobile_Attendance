import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const QUEUE_KEY = 'attendanceQueue';

export interface QueuedAttendance {
    id: string;
    empid: string;
    photoUri: string;
    latitude: number;
    longitude: number;
    projectId: string;
    projectName: string;
    action: 'checkin' | 'checkout';
    timestamp: number;
}

export const offlineQueue = {
    async enqueue(item: Omit<QueuedAttendance, 'id' | 'timestamp'>) {
        const id = Crypto.randomUUID();
        const entry: QueuedAttendance = { ...item, id, timestamp: Date.now() };
        const existing = await this.getAll();
        existing.push(entry);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
        return entry;
    },

    async getAll(): Promise<QueuedAttendance[]> {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    },

    async remove(id: string) {
        const existing = await this.getAll();
        const filtered = existing.filter(item => item.id !== id);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    },

    async count(): Promise<number> {
        const existing = await this.getAll();
        return existing.length;
    },
};