import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { offlineQueue } from '../services/offlineQueue';

interface Record {
    id: string | number;
    project_name: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    status?: string;
}

const AttendanceHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [records, setRecords] = useState<Record[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            const userData = userDataString ? JSON.parse(userDataString) : null;

            const serverRecords = userData?.empid
                ? await apiService.getMyProjectCheckIns(userData.empid)
                : { checkins: [] };

            const pending = await offlineQueue.getAll();
            const pendingFormatted: Record[] = pending.map(p => ({
                id: `pending-${p.id}`,
                project_name: p.projectName,
                check_in_time: p.action === 'checkin' ? new Date(p.timestamp).toLocaleString() : undefined,
                check_out_time: p.action === 'checkout' ? new Date(p.timestamp).toLocaleString() : undefined,
                status: 'Pending Sync',
            }));

            setRecords([...pendingFormatted, ...(serverRecords.checkins || [])]);
        } catch (error) {
            console.log('Error loading attendance history:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    };

    const renderItem = ({ item }: { item: Record }) => {
        const isPending = item.status === 'Pending Sync';
        const isComplete = !!item.check_in_time && !!item.check_out_time;

        return (
            <View style={styles.recordCard}>
                <View style={styles.recordIconWrap}>
                    <Ionicons
                        name={isPending ? 'cloud-upload-outline' : isComplete ? 'checkmark-circle' : 'time-outline'}
                        size={28}
                        color={isPending ? '#ff7a1a' : isComplete ? '#28a745' : '#007bff'}
                    />
                </View>
                <View style={styles.recordInfo}>
                    <Text style={styles.recordProject}>{item.project_name || 'Unknown Project'}</Text>

                    <View style={styles.recordRow}>
                        <Ionicons name="log-in-outline" size={14} color="#28a745" />
                        <Text style={styles.recordTime}>
                            {item.check_in_time ? formatTime(item.check_in_time) : '--'}
                        </Text>
                    </View>

                    <View style={styles.recordRow}>
                        <Ionicons name="log-out-outline" size={14} color="#dc3545" />
                        <Text style={styles.recordTime}>
                            {item.check_out_time ? formatTime(item.check_out_time) : '--'}
                        </Text>
                    </View>

                    {isPending && (
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>Waiting to sync</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const formatTime = (value: string) => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value; // fallback if not a parseable date
        return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main')}>
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Attendance History</Text>
                <View style={{ width: 28 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#007bff" />
            ) : records.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={60} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No attendance records yet</Text>
                </View>
            ) : (
                <FlatList
                    data={records}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: {
        backgroundColor: '#007bff',
        padding: 20,
        paddingTop: 55,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    backButton: { padding: 5 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    list: { padding: 20 },
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    recordIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    recordInfo: { flex: 1 },
    recordProject: { fontSize: 16, fontWeight: 'bold', color: '#343a40', marginBottom: 6 },
    recordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    recordTime: { fontSize: 13, color: '#6c757d' },
    pendingBadge: {
        marginTop: 8,
        backgroundColor: '#fff4e6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    pendingBadgeText: { color: '#ff7a1a', fontSize: 11, fontWeight: '600' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 12 },
});

export default AttendanceHistoryScreen;