import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

interface Violation {
    id: string | number;
    type: 'geofence_mismatch' | 'face_mismatch' | 'late_checkin' | 'early_checkout';
    project_name: string;
    timestamp: string;
    description: string;
    status: 'open' | 'reviewed' | 'dismissed';
    distance_from_site?: number; // meters, for geofence type
    confidence?: number;         // for face mismatch type
}

const VIOLATION_CONFIG = {
    geofence_mismatch: {
        icon: 'location-outline',
        color: '#ff7a1a',
        bg: '#fff4e6',
        label: 'Location Mismatch',
    },
    face_mismatch: {
        icon: 'scan-outline',
        color: '#dc3545',
        bg: '#fef2f2',
        label: 'Face Mismatch',
    },
    late_checkin: {
        icon: 'time-outline',
        color: '#6f42c1',
        bg: '#f3f0ff',
        label: 'Late Check-In',
    },
    early_checkout: {
        icon: 'exit-outline',
        color: '#fd7e14',
        bg: '#fff8f0',
        label: 'Early Check-Out',
    },
};

const ViolationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [violations, setViolations] = useState<Violation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'open' | 'reviewed'>('all');

    useEffect(() => {
        loadViolations();
    }, []);

    const loadViolations = async () => {
        setLoading(true);
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            const userData = userDataString ? JSON.parse(userDataString) : null;
            if (!userData?.empid) { setLoading(false); return; }

            const response = await apiService.getMyViolations(userData.empid);
            setViolations(response?.violations || []);
        } catch (error) {
            console.log('Error loading violations:', error);
            setViolations([]);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadViolations();
        setRefreshing(false);
    };

    const filtered = violations.filter(v => {
        if (filter === 'all') return true;
        if (filter === 'open') return v.status === 'open';
        if (filter === 'reviewed') return v.status !== 'open';
        return true;
    });

    const openCount = violations.filter(v => v.status === 'open').length;

    const renderItem = ({ item }: { item: Violation }) => {
        const config = VIOLATION_CONFIG[item.type] || VIOLATION_CONFIG.geofence_mismatch;

        return (
            <View style={[styles.card, item.status !== 'open' && styles.cardDimmed]}>
                <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
                    <Ionicons name={config.icon as any} size={24} color={config.color} />
                </View>

                <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                        <Text style={[styles.violationType, { color: config.color }]}>
                            {config.label}
                        </Text>
                        <View style={[
                            styles.statusBadge,
                            item.status === 'open' ? styles.statusOpen :
                                item.status === 'reviewed' ? styles.statusReviewed :
                                    styles.statusDismissed,
                        ]}>
                            <Text style={styles.statusText}>
                                {item.status === 'open' ? 'Open' :
                                    item.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.projectName}>{item.project_name}</Text>
                    <Text style={styles.description}>{item.description}</Text>

                    {item.type === 'geofence_mismatch' && item.distance_from_site && (
                        <View style={styles.metaRow}>
                            <Ionicons name="navigate-outline" size={12} color="#6c757d" />
                            <Text style={styles.metaText}>
                                {item.distance_from_site}m from site boundary
                            </Text>
                        </View>
                    )}

                    {item.type === 'face_mismatch' && item.confidence !== undefined && (
                        <View style={styles.metaRow}>
                            <Ionicons name="analytics-outline" size={12} color="#6c757d" />
                            <Text style={styles.metaText}>
                                Confidence: {(item.confidence * 100).toFixed(1)}%
                            </Text>
                        </View>
                    )}

                    <Text style={styles.timestamp}>{item.timestamp}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Violations</Text>
                {openCount > 0 && (
                    <View style={styles.headerBadge}>
                        <Text style={styles.headerBadgeText}>{openCount} Open</Text>
                    </View>
                )}
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={18} color="#007bff" />
                <Text style={styles.infoText}>
                    Violations are logged when your location doesn't match the project site or face verification fails. Your supervisor can review these.
                </Text>
            </View>

            {/* Filter tabs */}
            <View style={styles.filterRow}>
                {(['all', 'open', 'reviewed'] as const).map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterTab, filter === f && styles.filterTabActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                            {f === 'all' ? `All (${violations.length})` :
                                f === 'open' ? `Open (${violations.filter(v => v.status === 'open').length})` :
                                    `Reviewed (${violations.filter(v => v.status !== 'open').length})`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#007bff" />
            ) : filtered.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="shield-checkmark-outline" size={64} color="#d4edda" />
                    <Text style={styles.emptyTitle}>
                        {filter === 'open' ? 'No open violations' : 'No violations found'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {filter === 'open'
                            ? 'All clear — no issues to resolve.'
                            : 'Your attendance records look clean.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8', paddingBottom: 80 },
    header: {
        backgroundColor: '#007bff',
        paddingTop: 55,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', flex: 1 },
    headerBadge: {
        backgroundColor: '#dc3545',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    infoBanner: {
        margin: 16,
        backgroundColor: '#e8f0fe',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    infoText: { flex: 1, fontSize: 12, color: '#1a56db', lineHeight: 18 },

    filterRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#e9ecef',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    filterTab: {
        flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    },
    filterTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
    filterTabText: { fontSize: 12, color: '#6c757d', fontWeight: '600' },
    filterTabTextActive: { color: '#007bff' },

    list: { padding: 16, paddingTop: 4 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        flexDirection: 'row',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardDimmed: { opacity: 0.7 },
    iconWrap: {
        width: 48, height: 48, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    cardContent: { flex: 1 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    violationType: { fontSize: 13, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusOpen: { backgroundColor: '#fef2f2' },
    statusReviewed: { backgroundColor: '#d4edda' },
    statusDismissed: { backgroundColor: '#e9ecef' },
    statusText: { fontSize: 11, fontWeight: '600', color: '#495057' },
    projectName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', marginBottom: 4 },
    description: { fontSize: 13, color: '#6c757d', lineHeight: 18, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    metaText: { fontSize: 11, color: '#6c757d' },
    timestamp: { fontSize: 11, color: '#adb5bd', marginTop: 2 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: '#6c757d', marginTop: 8, textAlign: 'center' },
});

export default ViolationsScreen;