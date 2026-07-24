// LeaveScreen.tsx - Leave calendar, apply and history
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, SafeAreaView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { apiService, LeaveRecord } from '../services/api';

type SubTab = 'summary' | 'calendar' | 'apply' | 'history';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const LEAVE_TYPES = ['Annual Leave', 'Medical Leave', 'Home Leave', 'Emergency Leave', 'Unpaid Leave'];

const STATUS_COLORS: Record<string, string> = {
    Approved: '#28a745',
    Pending: '#fd9500',
    Rejected: '#dc3545',
};

interface ProjectOption {
    id: number;
    projectname: string;
    role: 'Supervisor' | 'Employee';
}

const LeaveScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('summary');
    const [empid, setEmpid] = useState<string>('');
    const [projects, setProjects] = useState<ProjectOption[]>([]);

    const [myLeaves, setMyLeaves] = useState<LeaveRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Calendar tab state - self leave only, not scoped to any project
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [calendarLeaves, setCalendarLeaves] = useState<LeaveRecord[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    // Apply form state
    const [step, setStep] = useState<1 | 2>(1);
    const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [reason, setReason] = useState('');
    const [attachmentUri, setAttachmentUri] = useState<string | undefined>(undefined);
    const [attachmentName, setAttachmentName] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        if (empid) {
            loadMyLeaves();
        }
    }, [empid]);

    useEffect(() => {
        loadCalendar();
    }, [calendarMonth]);

    const init = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            const userData = userDataString ? JSON.parse(userDataString) : null;
            setEmpid(userData?.empid || '');

            const res = await apiService.getMyProjects(userData?.empid);
            const rawList: any[] = res?.projects || res?.data || [];
            const list: ProjectOption[] = rawList.map((p) => ({
                id: p.id ?? p.project_id,
                projectname: p.projectname ?? p.project_name,
                role: p.role,
            }));
            setProjects(list);
        } catch (error) {
            console.log('Leave init error:', error);
        }
    };

    const loadMyLeaves = useCallback(async () => {
        setLoading(true);
        try {
            // No project filter here - a person's leave history isn't scoped
            // per project, it's one list regardless of how many projects they're on.
            const res = await apiService.getMyLeaves();
            setMyLeaves(res.leaves || []);
        } finally {
            setLoading(false);
        }
    }, [empid]);

    const loadCalendar = useCallback(async () => {
        setCalendarLoading(true);
        try {
            const monthStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
            const res = await apiService.getLeaveCalendar(monthStr);
            setCalendarLeaves(res.leaves || []);
        } catch (error) {
            console.log('Load calendar error:', error);
        } finally {
            setCalendarLoading(false);
        }
    }, [calendarMonth]);

    const pickAttachment = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setAttachmentUri(result.assets[0].uri);
                setAttachmentName(result.assets[0].name);
            }
        } catch (error) {
            console.log('Attachment pick error:', error);
        }
    };

    const submitLeave = async () => {
        if (!fromDate || !toDate) {
            Alert.alert('Missing dates', 'Please enter both From Date and To Date (YYYY-MM-DD).');
            return;
        }
        if (!reason.trim()) {
            Alert.alert('Reason required', 'Please tell us the reason for leave.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await apiService.applyLeave({
                leave_type: leaveType,
                from_date: fromDate,
                to_date: toDate,
                reason,
                attachmentUri,
            });
            if (res.status) {
                Alert.alert('Submitted', 'Your leave application has been sent to admin for approval.');
                setStep(1);
                setFromDate('');
                setToDate('');
                setReason('');
                setAttachmentUri(undefined);
                setAttachmentName('');
                setActiveSubTab('history');
                loadMyLeaves();
            } else {
                Alert.alert('Error', res.message || 'Could not submit leave.');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not submit leave. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStatusBadge = (status: string) => (
        <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[status] || '#adb5bd'}22` }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[status] || '#adb5bd' }]}>{status.toUpperCase()}</Text>
        </View>
    );

    const renderSummary = () => {
        const pending = myLeaves.filter((l) => l.status === 'Pending').length;
        const approved = myLeaves.filter((l) => l.status === 'Approved').length;
        const rejected = myLeaves.filter((l) => l.status === 'Rejected').length;
        const upcoming = [...myLeaves]
            .filter((l) => l.status !== 'Rejected')
            .sort((a, b) => a.from_date.localeCompare(b.from_date));

        return (
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{pending}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: '#28a745' }]}>{approved}</Text>
                        <Text style={styles.statLabel}>Approved</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: '#dc3545' }]}>{rejected}</Text>
                        <Text style={styles.statLabel}>Rejected</Text>
                    </View>
                </View>

                <Text style={styles.sectionHeading}>Upcoming / Recent</Text>
                {loading ? (
                    <ActivityIndicator color="#212c6b" style={{ marginTop: 20 }} />
                ) : upcoming.length === 0 ? (
                    <Text style={styles.emptyText}>No leave records yet.</Text>
                ) : (
                    upcoming.map((l) => (
                        <View key={l.id} style={styles.leaveRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.leaveType}>{l.leave_type}</Text>
                                <Text style={styles.leaveDates}>{l.from_date} → {l.to_date} · {l.days} day(s)</Text>
                            </View>
                            {renderStatusBadge(l.status)}
                        </View>
                    ))
                )}
            </ScrollView>
        );
    };

    const renderCalendar = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toISOString().slice(0, 10);

        const cells: (number | null)[] = [];
        for (let i = 0; i < firstWeekday; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        const statusForDay = (day: number) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayLeaves = calendarLeaves.filter((l) => dateStr >= l.from_date && dateStr <= l.to_date);
            if (dayLeaves.some((l) => l.status === 'Approved')) return 'Approved';
            if (dayLeaves.some((l) => l.status === 'Pending')) return 'Pending';
            return null;
        };

        const selectedDayLeaves = selectedDay
            ? calendarLeaves.filter((l) => selectedDay >= l.from_date && selectedDay <= l.to_date)
            : [];

        return (
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.calendarCard}>
                    <View style={styles.calendarNavRow}>
                        <TouchableOpacity
                            style={styles.calendarNavBtn}
                            onPress={() => {
                                setSelectedDay(null);
                                setCalendarMonth(new Date(year, month - 1, 1));
                            }}
                        >
                            <Ionicons name="chevron-back" size={20} color="#1a2b4c" />
                        </TouchableOpacity>
                        <Text style={styles.calendarMonthLabel}>{MONTH_LABELS[month]} {year}</Text>
                        <TouchableOpacity
                            style={styles.calendarNavBtn}
                            onPress={() => {
                                setSelectedDay(null);
                                setCalendarMonth(new Date(year, month + 1, 1));
                            }}
                        >
                            <Ionicons name="chevron-forward" size={20} color="#1a2b4c" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.calendarWeekRow}>
                        {WEEKDAY_LABELS.map((w, i) => (
                            <Text key={i} style={styles.calendarWeekLabel}>{w}</Text>
                        ))}
                    </View>

                    {calendarLoading ? (
                        <ActivityIndicator color="#212c6b" style={{ marginVertical: 20 }} />
                    ) : (
                        <View style={styles.calendarGrid}>
                            {cells.map((day, idx) => {
                                if (day === null) return <View key={idx} style={styles.calendarCell} />;
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const status = statusForDay(day);
                                const isToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDay;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.calendarCell}
                                        onPress={() => setSelectedDay(dateStr)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.calendarDayCircle,
                                                status === 'Approved' && styles.calendarDayApproved,
                                                status === 'Pending' && styles.calendarDayPending,
                                                isSelected && styles.calendarDaySelected,
                                                isToday && !status && styles.calendarDayToday,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.calendarDayText,
                                                    !!status && styles.calendarDayTextOnColor,
                                                    isSelected && styles.calendarDayTextOnColor,
                                                ]}
                                            >
                                                {day}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.calendarLegendRow}>
                        <View style={styles.calendarLegendItem}>
                            <View style={[styles.calendarLegendDot, { backgroundColor: '#28a745' }]} />
                            <Text style={styles.calendarLegendText}>On Leave (Approved)</Text>
                        </View>
                        <View style={styles.calendarLegendItem}>
                            <View style={[styles.calendarLegendDot, { backgroundColor: '#fd9500' }]} />
                            <Text style={styles.calendarLegendText}>Pending</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionHeading}>
                    {selectedDay ? `Leaves on ${selectedDay}` : 'Tap a day to see details'}
                </Text>
                {selectedDay && selectedDayLeaves.length === 0 && (
                    <Text style={styles.emptyText}>No leave on this day — attendance is normal.</Text>
                )}
                {selectedDayLeaves.map((l) => (
                    <View key={l.id} style={styles.leaveRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.leaveType}>{l.employee_name} · {l.leave_type}</Text>
                            <Text style={styles.leaveDates}>{l.from_date} → {l.to_date} · {l.days} day(s)</Text>
                        </View>
                        {renderStatusBadge(l.status)}
                    </View>
                ))}
            </ScrollView>
        );
    };

    const renderApply = () => (
        <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.applyInfoBanner}>
                <Ionicons name="information-circle-outline" size={16} color="#212c6b" />
                <Text style={styles.applyInfoText}>
                    One application covers all your projects: {projects.map((p) => p.projectname).join(', ') || '—'}.
                    It will be reviewed by admin.
                </Text>
            </View>

            <View style={styles.stepHeader}>
                <View style={[styles.stepPill, step === 1 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, step === 1 && styles.stepPillTextActive]}>1 Leave Category</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#adb5bd" />
                <View style={[styles.stepPill, step === 2 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, step === 2 && styles.stepPillTextActive]}>2 Enter Details</Text>
                </View>
            </View>

            {step === 1 ? (
                <View style={styles.formCard}>
                    <Text style={styles.formLabel}>Leave Category</Text>
                    {LEAVE_TYPES.map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[styles.typeOption, leaveType === type && styles.typeOptionActive]}
                            onPress={() => setLeaveType(type)}
                        >
                            <Text style={[styles.typeOptionText, leaveType === type && styles.typeOptionTextActive]}>{type}</Text>
                            {leaveType === type && <Ionicons name="checkmark-circle" size={18} color="#212c6b" />}
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)}>
                        <Text style={styles.primaryBtnText}>Next</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.formCard}>
                    <Text style={styles.formLabel}>From Date</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={fromDate}
                        onChangeText={setFromDate}
                    />
                    <Text style={styles.formLabel}>To Date</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={toDate}
                        onChangeText={setToDate}
                    />
                    <Text style={styles.formLabel}>Reason</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="I'm having..."
                        value={reason}
                        onChangeText={setReason}
                        multiline
                    />
                    <Text style={styles.formLabel}>Attachment (Optional)</Text>
                    <TouchableOpacity style={styles.attachBtn} onPress={pickAttachment}>
                        <Ionicons name="add" size={20} color="#212c6b" />
                        <Text style={styles.attachBtnText}>{attachmentName || 'Add file'}</Text>
                    </TouchableOpacity>

                    <View style={styles.stepButtonsRow}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                            <Text style={styles.secondaryBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]}
                            onPress={submitLeave}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>APPLY</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>
    );

    const renderHistory = () => (
        <ScrollView showsVerticalScrollIndicator={false}>
            {myLeaves.length === 0 ? (
                <Text style={styles.emptyText}>No leave history yet.</Text>
            ) : (
                myLeaves.map((l) => (
                    <View key={l.id} style={styles.leaveRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.leaveType}>{l.leave_type}</Text>
                            <Text style={styles.leaveDates}>{l.from_date} → {l.to_date} · {l.days} day(s)</Text>
                            {!!l.review_notes && <Text style={styles.leaveReason}>Note: {l.review_notes}</Text>}
                        </View>
                        {renderStatusBadge(l.status)}
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'summary': return renderSummary();
            case 'calendar': return renderCalendar();
            case 'apply': return renderApply();
            case 'history': return renderHistory();
        }
    };

    const SUB_TABS: { key: SubTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { key: 'summary', label: 'Summary', icon: 'grid-outline' },
        { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
        { key: 'apply', label: 'Apply Leave', icon: 'create-outline' },
        { key: 'history', label: 'History', icon: 'time-outline' },
    ];

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={26} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Leave</Text>
                <View style={{ width: 26 }} />
            </View>

            <View style={styles.content}>
                {renderContent()}
            </View>

            <View style={styles.subTabBar}>
                {SUB_TABS.map((tab) => {
                    const isActive = activeSubTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.subTab}
                            onPress={() => setActiveSubTab(tab.key)}
                        >
                            <Ionicons name={tab.icon} size={20} color={isActive ? '#212c6b' : '#adb5bd'} />
                            <Text style={[styles.subTabLabel, isActive && styles.subTabLabelActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f0f4f8' },
    header: {
        backgroundColor: '#212c6b',
        paddingTop: 55,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    content: { flex: 1, padding: 16 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    statCard: {
        flex: 1, flexBasis: 0, minWidth: 0, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center',
        paddingVertical: 16, marginHorizontal: 4,
    },
    statNumber: { fontSize: 22, fontWeight: '700', color: '#fd9500' },
    statLabel: { fontSize: 11, color: '#000000', marginTop: 4 },
    sectionHeading: { fontSize: 14, fontWeight: '700', color: '#1a2b4c', marginBottom: 10 },
    emptyText: { textAlign: 'center', color: '#adb5bd', marginTop: 30, fontSize: 13 },
    leaveRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        borderRadius: 12, padding: 14, marginBottom: 10,
    },
    leaveType: { fontSize: 14, fontWeight: '700', color: '#1a2b4c' },
    leaveDates: { fontSize: 12, color: '#000000', marginTop: 3 },
    leaveReason: { fontSize: 12, color: '#8a94a6', marginTop: 4, fontStyle: 'italic' },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 8 },
    stepPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e9ecef' },
    stepPillActive: { backgroundColor: '#0b3d91' },
    stepPillText: { fontSize: 11, fontWeight: '700', color: '#000000' },
    stepPillTextActive: { color: '#fff' },
    formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
    formLabel: { fontSize: 12, fontWeight: '700', color: '#1a2b4c', marginBottom: 8, marginTop: 12 },
    typeOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
        backgroundColor: '#f8f9fb', marginBottom: 8,
    },
    typeOptionActive: { backgroundColor: '#e7f1ff' },
    typeOptionText: { fontSize: 13, color: '#495057' },
    typeOptionTextActive: { color: '#212c6b', fontWeight: '700' },
    input: {
        backgroundColor: '#f8f9fb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        fontSize: 13, color: '#1a2b4c',
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    attachBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: '#dee2e6', borderStyle: 'dashed',
        borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, justifyContent: 'center',
    },
    attachBtnText: { fontSize: 12, color: '#212c6b', fontWeight: '600' },
    stepButtonsRow: { flexDirection: 'row', marginTop: 20 },
    primaryBtn: {
        backgroundColor: '#28a745', borderRadius: 10, paddingVertical: 13,
        alignItems: 'center', marginTop: 20,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    secondaryBtn: {
        borderWidth: 1, borderColor: '#dee2e6', borderRadius: 10, paddingVertical: 13,
        paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
    },
    secondaryBtnText: { color: '#000000', fontWeight: '700', fontSize: 13 },
    calendarCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20,
    },
    calendarNavRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
    },
    calendarNavBtn: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0f4f8',
        alignItems: 'center', justifyContent: 'center',
    },
    calendarMonthLabel: { fontSize: 15, fontWeight: '700', color: '#1a2b4c' },
    calendarWeekRow: { flexDirection: 'row', marginBottom: 6 },
    calendarWeekLabel: {
        width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#adb5bd',
    },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: {
        width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    calendarDayCircle: {
        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    },
    calendarDayApproved: { backgroundColor: '#28a745' },
    calendarDayPending: { backgroundColor: '#fd9500' },
    calendarDaySelected: { backgroundColor: '#0b3d91' },
    calendarDayToday: { borderWidth: 1.5, borderColor: '#212c6b' },
    calendarDayText: { fontSize: 13, fontWeight: '600', color: '#1a2b4c' },
    calendarDayTextOnColor: { color: '#fff' },
    calendarLegendRow: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
    calendarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    calendarLegendDot: { width: 10, height: 10, borderRadius: 5 },
    calendarLegendText: { fontSize: 11, color: '#000000' },
    subTabBar: {
        flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef',
        paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    subTab: { flex: 1, alignItems: 'center', gap: 3 },
    subTabLabel: { fontSize: 10, color: '#adb5bd', fontWeight: '600' },
    subTabLabelActive: { color: '#212c6b' },
    applyInfoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#e7f3ff', borderRadius: 10, padding: 10, marginBottom: 12,
    },
    applyInfoText: { flex: 1, fontSize: 12.5, color: '#0d5aa7' },
});

export default LeaveScreen;