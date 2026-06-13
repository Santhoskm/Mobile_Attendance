import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { offlineQueue } from '../services/offlineQueue';

const AttendanceHistoryScreen: React.FC = () => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        const userDataString = await AsyncStorage.getItem('userData');
        const userData = userDataString ? JSON.parse(userDataString) : null;

        const serverRecords = userData?.empid
            ? await apiService.getMyProjectCheckIns(userData.empid)
            : { checkins: [] };

        const pending = await offlineQueue.getAll();
        const pendingFormatted = pending.map(p => ({
            id: p.id,
            project_name: p.projectName,
            check_in_time: p.action === 'checkin' ? new Date(p.timestamp).toLocaleString() : undefined,
            check_out_time: p.action === 'checkout' ? new Date(p.timestamp).toLocaleString() : undefined,
            status: 'Pending Sync',
        }));

        setRecords([...pendingFormatted, ...(serverRecords.checkins || [])]);
        setLoading(false);
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;

    return (
        <FlatList
            style={styles.container}
            data={records}
            keyExtractor={(item, idx) => String(item.id || idx)}
            renderItem={({ item }) => (
                <View style={styles.row}>
                    <Text style={styles.project}>{item.project_name}</Text>
                    <Text>In: {item.check_in_time || '--'}</Text>
                    <Text>Out: {item.check_out_time || '--'}</Text>
                    {item.status && <Text style={styles.pending}>{item.status}</Text>}
                </View>
            )}
        />
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    project: { fontWeight: 'bold', fontSize: 16 },
    pending: { color: '#ff7a1a', fontSize: 12, marginTop: 4 },
});

export default AttendanceHistoryScreen;