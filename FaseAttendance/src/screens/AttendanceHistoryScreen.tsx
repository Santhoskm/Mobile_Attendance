import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { offlineQueue } from '../services/offlineQueue';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
    const [downloading, setDownloading] = useState(false);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
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

    const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n'))
            return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const buildCSV = (rows: AttendanceRecord[]) => {
        const header = [
            'Date',
            'Project',
            'Check-In Time',
            'Check-Out Time',
            'Working Hours',
            'Check-In Place',
            'Check-Out Place',
            'Attendance',
        ];
        const lines = [header.join(',')];
        for (const r of rows) {
            const dateVal = r.date
                ? new Date(r.date + 'T00:00:00').toLocaleDateString([], { dateStyle: 'medium' })
                : r.check_in_time
                    ? new Date(r.check_in_time).toLocaleDateString([], { dateStyle: 'medium' })
                    : '';
            const attendance = r.status === 'Absent' ? 'Absent' : r.check_in_time ? 'Present' : 'Absent';
            lines.push([
                escapeCSV(dateVal),
                escapeCSV(r.project_name),
                escapeCSV(formatTime(r.check_in_time)),
                escapeCSV(formatTime(r.check_out_time)),
                escapeCSV(calcWorkingHours(r.check_in_time, r.check_out_time)),
                escapeCSV(r.checkin_place || ''),
                escapeCSV(r.checkout_place || ''),
                escapeCSV(attendance),
            ].join(','));
        }
        return lines.join('\n');
    };

    // Save directly to device Downloads folder (Android) or Files (iOS)
    const saveCSV = async (csv: string, filename: string) => {
        if (Platform.OS === 'android') {
            const cacheFile = new File(Paths.cache, filename);
            if (cacheFile.exists) cacheFile.delete();
            cacheFile.write(csv);

            // copy to Downloads folder so it appears in Files app directly
            const downloadFile = new File(Paths.document, filename);
            if (downloadFile.exists) downloadFile.delete();
            downloadFile.write(csv);

            // also open share sheet so user can share or save elsewhere
            await Sharing.shareAsync(cacheFile.uri, {
                mimeType: 'text/csv',
                dialogTitle: 'Download or Share CSV Report',
                UTI: 'public.comma-separated-values-text',
            });

            Alert.alert(
                'Downloaded!',
                `"${filename}" has been saved. You can also share it using the share sheet.`,
                [{ text: 'OK' }]
            );

        } else {
            // On iOS: save to Documents (appears in Files app under the app)
            const docFile = new File(Paths.document, filename);
            if (docFile.exists) docFile.delete();
            docFile.write(csv);
            Alert.alert(
                'Saved!',
                `"${filename}" has been saved to Files → On My iPhone → FaseAttendance.`,
                [{ text: 'OK' }]
            );
        }
    };

    // ---------- Download handlers ----------

    const downloadFull = async () => {
        const serverOnly = records.filter(r => !String(r.id).startsWith('pending-'));
        if (serverOnly.length === 0) {
            Alert.alert('No Data', 'No attendance records to download.');
            return;
        }
        setDownloading(true);
        try {
            const empid = userData?.empid || 'employee';
            const csv = buildCSV(serverOnly);
            await saveCSV(csv, `attendance_full_${empid}.csv`);
        } catch (e) {
            Alert.alert('Error', 'Failed to generate report.');
        } finally {
            setDownloading(false);
        }
    };

    const downloadByProject = async (project: Project) => {
        setShowProjectPicker(false);
        setDownloading(true);
        try {
            const filtered = records.filter(
                r => r.project_id === project.id && !String(r.id).startsWith('pending-')
            );
            if (filtered.length === 0) {
                Alert.alert('No Data', `No records found for ${project.projectname}.`);
                setDownloading(false);
                return;
            }
            const safeName = (project.projectname || 'project').replace(/[^a-zA-Z0-9]/g, '_');
            const csv = buildCSV(filtered);
            await saveCSV(csv, `attendance_${safeName}.csv`);
        } catch (e) {
            Alert.alert('Error', 'Failed to generate report.');
        } finally {
            setDownloading(false);
        }
    };

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
                        color={isPending ? '#ff7a1a' : isComplete ? '#28a745' : '#007bff'}
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
                            <Ionicons name="time-outline" size={14} color="#6c757d" />
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

            {/* Download Buttons */}
            <View style={styles.downloadBar}>
                <TouchableOpacity
                    style={[styles.downloadBtn, styles.downloadBtnFull, downloading && styles.btnDisabled]}
                    onPress={downloadFull}
                    disabled={downloading}
                >
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.downloadBtnText}>
                        {downloading ? 'Saving...' : 'Full Download'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.downloadBtn, styles.downloadBtnProject, downloading && styles.btnDisabled]}
                    onPress={() => {
                        if (projects.length === 0) {
                            Alert.alert('No Projects', 'No project records available.');
                            return;
                        }
                        setShowProjectPicker(true);
                    }}
                    disabled={downloading}
                >
                    <Ionicons name="folder-outline" size={16} color="#007bff" />
                    <Text style={[styles.downloadBtnText, { color: '#007bff' }]}>Project Wise</Text>
                </TouchableOpacity>
            </View>

            {downloading && (
                <View style={styles.downloadingBar}>
                    <ActivityIndicator size="small" color="#007bff" />
                    <Text style={styles.downloadingText}>Saving report to your device...</Text>
                </View>
            )}

            {/* Records List */}
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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}

            {/* Project Picker Modal */}
            <Modal visible={showProjectPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Project</Text>
                            <TouchableOpacity onPress={() => setShowProjectPicker(false)}>
                                <Ionicons name="close" size={24} color="#343a40" />
                            </TouchableOpacity>
                        </View>
                        {projects.map(p => (
                            <TouchableOpacity
                                key={p.id}
                                style={styles.projectOption}
                                onPress={() => downloadByProject(p)}
                            >
                                <Ionicons name="folder-outline" size={20} color="#007bff" />
                                <Text style={styles.projectOptionText}>{p.projectname}</Text>
                                <Ionicons name="download-outline" size={18} color="#6c757d" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
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

    downloadBar: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    downloadBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    downloadBtnFull: { backgroundColor: '#007bff' },
    downloadBtnProject: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#007bff' },
    downloadBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    btnDisabled: { opacity: 0.5 },

    downloadingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    downloadingText: { color: '#6c757d', fontSize: 13 },

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
    recordTime: { fontSize: 13, color: '#6c757d', flex: 1 },
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