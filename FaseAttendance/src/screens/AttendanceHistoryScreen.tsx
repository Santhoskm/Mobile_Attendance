import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { offlineQueue } from '../services/offlineQueue';

interface AttendanceRecord {
    id: string | number;
    project_id?: number;
    project_name: string;
    date?: string | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    status?: string;
    checkin_place?: string;
    checkout_place?: string;
}

interface Project {
    id: number;
    projectname?: string;
}

const AttendanceHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<'overall' | 'project'>('overall');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            const user = userDataString ? JSON.parse(userDataString) : null;
            setUserData(user);

            const serverRecords = user?.empid
                ? await apiService.getMyProjectCheckIns(user.empid)
                : { checkins: [] };

            const pending = await offlineQueue.getAll();
            const pendingFormatted: AttendanceRecord[] = pending.map((p: any) => ({
                id: `pending-${p.id}`,
                project_name: p.projectName,
                check_in_time: p.action === 'checkin' ? new Date(p.timestamp).toLocaleString() : undefined,
                check_out_time: p.action === 'checkout' ? new Date(p.timestamp).toLocaleString() : undefined,
                status: 'Pending Sync',
            }));

            const allRecords = [...pendingFormatted, ...(serverRecords.checkins || [])];
            setRecords(allRecords);

            const uniqueProjects: Project[] = [];
            const seen = new Set<number>();
            for (const r of serverRecords.checkins || []) {
                if (r.project_id && !seen.has(r.project_id)) {
                    seen.add(r.project_id);
                    uniqueProjects.push({ id: r.project_id, projectname: r.project_name });
                }
            }
            setProjects(uniqueProjects);
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

    // ---------- Helpers ----------

    const formatTime = (value?: string | null) => {
        if (!value) return '--';
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    };

    const calcWorkingHours = (checkIn?: string | null, checkOut?: string | null): string => {
        if (!checkIn || !checkOut) return '--';
        const inD = new Date(checkIn);
        const outD = new Date(checkOut);
        if (isNaN(inD.getTime()) || isNaN(outD.getTime())) return '--';
        const diffMs = outD.getTime() - inD.getTime();
        if (diffMs <= 0) return '--';
        const totalMins = Math.floor(diffMs / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        return `${hrs}h ${mins}m`;
    };

    const visibleRecords = viewMode === 'overall'
        ? records
        : selectedProjectId
            ? records.filter(r => String(r.project_id) === selectedProjectId)
            : records;

    // ---------- Render ----------

    const renderItem = ({ item }: { item: AttendanceRecord }) => {
        const isPending = item.status === 'Pending Sync';
        const isComplete = !!item.check_in_time && !!item.check_out_time;
        const workingHours = calcWorkingHours(item.check_in_time, item.check_out_time);

        return (
            <View style={styles.recordCard}>
                <View style={styles.recordIconWrap}>
                    <Ionicons
                        name={isPending ? 'cloud-upload-outline' : isComplete ? 'checkmark-circle' : 'time-outline'}
                        size={28}
                        color={isPending ? '#ff7a1a' : isComplete ? '#28a745' : '#212c6b'}
                    />
                </View>
                <View style={styles.recordInfo}>
                    <Text style={styles.recordProject}>{item.project_name || 'Unknown Project'}</Text>

                    <View style={styles.recordRow}>
                        <Ionicons name="log-in-outline" size={14} color="#28a745" />
                        <Text style={styles.recordTime}>{formatTime(item.check_in_time)}</Text>
                    </View>

                    <View style={styles.recordRow}>
                        <Ionicons name="log-out-outline" size={14} color="#dc3545" />
                        <Text style={styles.recordTime}>{formatTime(item.check_out_time)}</Text>
                    </View>

                    {isComplete && (
                        <View style={styles.recordRow}>
                            <Ionicons name="time-outline" size={14} color="#000000" />
                            <Text style={[styles.recordTime, { fontWeight: '600', color: '#343a40' }]}>
                                {workingHours}
                            </Text>
                        </View>
                    )}

                    {item.checkin_place ? (
                        <View style={styles.recordRow}>
                            <Ionicons name="location-outline" size={13} color="#adb5bd" />
                            <Text style={[styles.recordTime, { fontSize: 12 }]} numberOfLines={1}>
                                {item.checkin_place}
                            </Text>
                        </View>
                    ) : null}

                    {isPending && (
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>Waiting to sync</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main')}>
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Attendance History</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Attendance View Tabs */}
            <View style={styles.viewTabs}>
                <TouchableOpacity
                    style={[styles.viewTab, viewMode === 'overall' && styles.viewTabActive]}
                    onPress={() => setViewMode('overall')}
                >
                    <Ionicons
                        name="list-outline"
                        size={16}
                        color={viewMode === 'overall' ? '#fff' : '#212c6b'}
                    />
                    <Text style={[styles.viewTabText, viewMode === 'overall' && styles.viewTabTextActive]}>
                        Overall Attendance
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.viewTab, viewMode === 'project' && styles.viewTabActive]}
                    onPress={() => setViewMode('project')}
                >
                    <Ionicons
                        name="folder-outline"
                        size={16}
                        color={viewMode === 'project' ? '#fff' : '#212c6b'}
                    />
                    <Text style={[styles.viewTabText, viewMode === 'project' && styles.viewTabTextActive]}>
                        Project Wise
                    </Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'project' && (
                <View style={styles.projectFilterRow}>
                    <TouchableOpacity
                        style={[styles.projectChip, selectedProjectId === '' && styles.projectChipActive]}
                        onPress={() => setSelectedProjectId('')}
                    >
                        <Text style={[styles.projectChipText, selectedProjectId === '' && styles.projectChipTextActive]}>
                            All Projects
                        </Text>
                    </TouchableOpacity>
                    {projects.map((p) => (
                        <TouchableOpacity
                            key={p.id}
                            style={[styles.projectChip, selectedProjectId === String(p.id) && styles.projectChipActive]}
                            onPress={() => setSelectedProjectId(String(p.id))}
                        >
                            <Text style={[styles.projectChipText, selectedProjectId === String(p.id) && styles.projectChipTextActive]}>
                                {p.projectname || 'Project'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Records List */}
            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#212c6b" />
            ) : visibleRecords.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={60} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No attendance records yet</Text>
                </View>
            ) : (
                <FlatList
                    data={visibleRecords}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: {
        backgroundColor: '#212c6b',
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

    viewTabs: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    viewTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#212c6b',
    },
    viewTabActive: { backgroundColor: '#212c6b' },
    viewTabText: { color: '#212c6b', fontWeight: '600', fontSize: 14 },
    viewTabTextActive: { color: '#fff' },
    projectFilterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    projectChip: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    projectChipActive: { backgroundColor: '#212c6b', borderColor: '#212c6b' },
    projectChipText: { color: '#343a40', fontSize: 13, fontWeight: '600' },
    projectChipTextActive: { color: '#fff' },

    list: { padding: 20, paddingTop: 4 },
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
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
        marginTop: 2,
    },
    recordInfo: { flex: 1 },
    recordProject: { fontSize: 16, fontWeight: 'bold', color: '#343a40', marginBottom: 6 },
    recordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    recordTime: { fontSize: 13, color: '#000000', flex: 1 },
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

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40' },
    projectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    projectOptionText: { flex: 1, fontSize: 15, color: '#343a40', fontWeight: '500' },
});

export default AttendanceHistoryScreen;