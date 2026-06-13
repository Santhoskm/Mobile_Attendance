import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue } from '../services/offlineQueue';
import { apiService } from '../services/api';

export const useNetworkSync = (onSyncComplete?: () => void) => {
    const isSyncing = useRef(false);

    const syncQueue = async () => {
        if (isSyncing.current) return;
        isSyncing.current = true;

        try {
            const items = await offlineQueue.getAll();
            for (const item of items) {
                try {
                    const formData = new FormData();
                    formData.append('empid', item.empid);
                    formData.append('image', {
                        uri: item.photoUri,
                        type: 'image/jpeg',
                        name: 'face_image.jpg',
                    } as any);
                    formData.append('latitude', item.latitude.toString());
                    formData.append('longitude', item.longitude.toString());
                    formData.append('project_id', item.projectId);
                    formData.append('project_name', item.projectName);
                    formData.append('request_id', item.id);
                    formData.append('offline_timestamp', item.timestamp.toString());

                    const response = item.action === 'checkin'
                        ? await apiService.faceCheckIn(formData)
                        : await apiService.faceCheckOut(formData);

                    if (response.matched === true) {
                        await offlineQueue.remove(item.id);
                    }
                } catch (err) {
                    console.log('Sync failed for item', item.id, err);
                    // leave in queue, retry next time
                }
            }
            onSyncComplete?.();
        } finally {
            isSyncing.current = false;
        }
    };

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected && state.isInternetReachable) {
                syncQueue();
            }
        });

        // also try on mount
        syncQueue();

        return () => unsubscribe();
    }, []);

    return { syncQueue };
};