// export default ProfileScreen;

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { Linking } from 'react-native';

interface ProfileData {
    full_name?: string;
    designation?: string;
    worker_type?: string;
    status?: string;
    joined_date?: string;
    ic_passport_no?: string;
    contact_number?: string;
    email?: string;
    nationality?: string;
    work_permit_no?: string;
    work_permit_expiry?: string;
    project_name?: string;
    project_role?: string;
    supervisor_name?: string;
    shift_hours?: string;
    site_address?: string;
    attendance_summary?: {
        days_present?: number;
        days_absent?: number;
        days_late?: number;
        attendance_rate?: number;
        last_check_in?: string;
        last_check_out?: string;
    };
    certifications?: {
        name: string;
        status: 'valid' | 'expired' | 'expiring_soon';
        expiry_date?: string;
    }[];
}

const daysUntil = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const diff = target.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ── Collapsible Section ──────────────────────────────────────────────────────
const CollapsibleSection: React.FC<{
    title: string;
    icon: string;
    defaultOpen?: boolean;
    rightElement?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, rightElement, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

    const toggle = () => {
        const toValue = open ? 0 : 1;
        Animated.spring(rotation, {
            toValue,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
        }).start();
        setOpen(!open);
    };

    const rotate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View style={styles.sectionCard}>
            <TouchableOpacity
                style={styles.sectionHeader}
                onPress={toggle}
                activeOpacity={0.7}
            >
                <View style={styles.sectionHeaderLeft}>
                    <View style={styles.sectionIconWrap}>
                        <Ionicons name={icon as any} size={18} color="#212c6b" />
                    </View>
                    <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                <View style={styles.sectionHeaderRight}>
                    {rightElement}
                    <Animated.View style={{ transform: [{ rotate }] }}>
                        <Ionicons name="chevron-down" size={20} color="#000000" />
                    </Animated.View>
                </View>
            </TouchableOpacity>

            {open && (
                <View style={styles.sectionBody}>
                    <View style={styles.sectionDivider} />
                    {children}
                </View>
            )}
        </View>
    );
};

// ── Detail Row ───────────────────────────────────────────────────────────────
const DetailRow: React.FC<{
    label: string;
    value?: string | null;
    valueStyle?: any;
    icon?: string;
}> = ({ label, value, valueStyle, icon }) => (
    <View style={styles.detailRow}>
        <View style={styles.detailLabelWrap}>
            {icon && <Ionicons name={icon as any} size={13} color="#adb5bd" style={{ marginRight: 5 }} />}
            <Text style={styles.detailLabel}>{label}</Text>
        </View>
        <Text style={[styles.detailValue, valueStyle]}>{value || '--'}</Text>
    </View>
);

// ── Stat Box ─────────────────────────────────────────────────────────────────
const StatBox: React.FC<{
    value: string | number;
    label: string;
    color: string;
}> = ({ value, label, color }) => (
    <View style={styles.statBox}>
        <Text style={[styles.statNumber, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

// ── Main Screen ──────────────────────────────────────────────────────────────
const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [userData, setUserData] = useState<any>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [faceEnrolled, setFaceEnrolled] = useState(false);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        await loadUserData();
        await checkFaceEnrollment();
    };

    const loadUserData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                const data = JSON.parse(userDataString);
                setUserData(data);
                if (data?.empid) {
                    await loadProfile(data.empid);
                } else {
                    setLoadingProfile(false);
                }
            } else {
                setLoadingProfile(false);
            }
        } catch (error) {
            console.log('Error loading user data:', error);
            setLoadingProfile(false);
        }
    };

    const loadProfile = async (empid: string) => {
        setLoadingProfile(true);
        const data = await apiService.getMyProfile(empid);
        setProfile(data);
        setLoadingProfile(false);
    };

    const checkFaceEnrollment = async () => {
        try {
            const faceStatus = await AsyncStorage.getItem('faceEnrolled');
            setFaceEnrolled(faceStatus === 'true');
        } catch (error) {
            console.log('Error checking face enrollment:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    const wpDays = daysUntil(profile?.work_permit_expiry);
    const wpExpiringSoon = wpDays !== null && wpDays <= 30 && wpDays >= 0;
    const wpExpired = wpDays !== null && wpDays < 0;

    const attendanceRate = profile?.attendance_summary?.attendance_rate;

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={26} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 26 }} />
            </View>

            {/* ── Avatar & Name ── */}
            <View style={styles.profileHero}>
                <View style={styles.avatarRing}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarLargeText}>
                            {userData?.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                        </Text>
                    </View>
                </View>

                {loadingProfile ? (
                    <ActivityIndicator style={{ marginTop: 16 }} size="small" color="#212c6b" />
                ) : (
                    <>
                        <Text style={styles.userName}>
                            {profile?.full_name || userData?.username || 'User Name'}
                        </Text>
                        <Text style={styles.userEmpId}>EMP ID: {userData?.empid || 'N/A'}</Text>
                        {profile?.designation && (
                            <Text style={styles.userRole}>{profile.designation}</Text>
                        )}
                        <View style={styles.badgeRow}>
                            {profile?.worker_type && profile.worker_type.trim().length > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{profile.worker_type}</Text>
                                </View>
                            )}
                            <View style={[styles.badge, profile?.status === 'Active' ? styles.badgeActive : styles.badgeInactive]}>
                                <View style={[styles.statusDot, { backgroundColor: profile?.status === 'Active' ? '#28a745' : '#dc3545' }]} />
                                <Text style={[styles.badgeText, profile?.status === 'Active' ? styles.badgeActiveText : styles.badgeInactiveText]}>
                                    {profile?.status || 'Unknown'}
                                </Text>
                            </View>
                        </View>
                        {profile?.joined_date && (
                            <Text style={styles.joinedText}>
                                <Ionicons name="calendar-outline" size={11} color="#adb5bd" /> Joined: {profile.joined_date}
                            </Text>
                        )}
                    </>
                )}
            </View>

            {/* ── Work Permit Warning Banner ── */}
            {(wpExpiringSoon || wpExpired) && (
                <View style={[styles.warningBanner, wpExpired && styles.errorBanner]}>
                    <Ionicons
                        name="alert-circle"
                        size={22}
                        color={wpExpired ? '#dc3545' : '#ff7a1a'}
                    />
                    <Text style={[styles.warningText, wpExpired && styles.errorText]}>
                        {wpExpired
                            ? `Work Permit expired ${Math.abs(wpDays!)} day(s) ago. Contact HR immediately.`
                            : `Work Permit expires in ${wpDays} day(s). Please renew soon.`}
                    </Text>
                </View>
            )}

            {/* ── Personal & Employment Details ── */}
            <CollapsibleSection
                title="Personal & Employment"
                icon="person-outline"
                defaultOpen={true}
                rightElement={
                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert(
                                'Request Profile Update',
                                'To update your personal details, please contact your supervisor or HR.'
                            )
                        }
                        style={{ marginRight: 8 }}
                    >
                        <Text style={styles.requestEditText}>Request Edit</Text>
                    </TouchableOpacity>
                }
            >
                <DetailRow icon="card-outline" label="IC / Passport No." value={profile?.ic_passport_no} />
                <DetailRow icon="call-outline" label="Contact Number" value={profile?.contact_number} />
                <DetailRow icon="mail-outline" label="Email" value={profile?.email} />
                <DetailRow icon="globe-outline" label="Nationality" value={profile?.nationality} />
                <DetailRow icon="document-outline" label="Work Permit No." value={profile?.work_permit_no} />
                <DetailRow
                    icon="time-outline"
                    label="WP Expiry"
                    value={profile?.work_permit_expiry}
                    valueStyle={
                        wpExpired
                            ? styles.errorValue
                            : wpExpiringSoon
                                ? styles.warningValue
                                : undefined
                    }
                />
            </CollapsibleSection>

            {/* ── Current Project Assignment ── */}
            <CollapsibleSection
                title="Current Project Assignment"
                icon="briefcase-outline"
                defaultOpen={true}
            >
                {profile?.project_name ? (
                    <>
                        <DetailRow icon="folder-outline" label="Project" value={profile?.project_name} />
                        <DetailRow icon="construct-outline" label="Role" value={profile?.project_role} />
                        <DetailRow icon="person-circle-outline" label="Supervisor" value={profile?.supervisor_name} />
                        <DetailRow icon="alarm-outline" label="Shift Hours" value={profile?.shift_hours} />
                        <DetailRow icon="location-outline" label="Site Address" value={profile?.site_address} />
                    </>
                ) : (
                    <View style={styles.emptySection}>
                        <Ionicons name="briefcase-outline" size={32} color="#dee2e6" />
                        <Text style={styles.emptySectionText}>No active project assignment</Text>
                    </View>
                )}
            </CollapsibleSection>

            {/* ── My Attendance Summary ── */}
            <CollapsibleSection
                title="My Attendance Summary"
                icon="stats-chart-outline"
                defaultOpen={true}
            >
                {/* Attendance rate progress bar */}
                {attendanceRate != null && (
                    <View style={styles.rateBarWrap}>
                        <View style={styles.rateBarBg}>
                            <View
                                style={[
                                    styles.rateBarFill,
                                    {
                                        width: `${attendanceRate}%` as any,
                                        backgroundColor:
                                            attendanceRate >= 80
                                                ? '#28a745'
                                                : attendanceRate >= 60
                                                    ? '#ff7a1a'
                                                    : '#dc3545',
                                    },
                                ]}
                            />
                        </View>
                        <Text style={styles.rateBarLabel}>{attendanceRate}% this month</Text>
                    </View>
                )}

                <View style={styles.statsGrid}>
                    <StatBox
                        value={profile?.attendance_summary?.days_present ?? '--'}
                        label="Present"
                        color="#28a745"
                    />
                    <StatBox
                        value={profile?.attendance_summary?.days_absent ?? '--'}
                        label="Absent"
                        color="#dc3545"
                    />
                    <StatBox
                        value={profile?.attendance_summary?.days_late ?? '--'}
                        label="Late"
                        color="#ff7a1a"
                    />
                    <StatBox
                        value={attendanceRate != null ? `${attendanceRate}%` : '--'}
                        label="Rate"
                        color="#212c6b"
                    />
                </View>

                <DetailRow
                    icon="log-in-outline"
                    label="Last Check-In"
                    value={profile?.attendance_summary?.last_check_in}
                />
                <DetailRow
                    icon="log-out-outline"
                    label="Last Check-Out"
                    value={profile?.attendance_summary?.last_check_out}
                />

                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => navigation.navigate('AttendanceHistory')}
                >
                    <Ionicons name="list-outline" size={16} color="#212c6b" />
                    <Text style={styles.linkText}>View Full Attendance History</Text>
                    <Ionicons name="chevron-forward" size={16} color="#212c6b" />
                </TouchableOpacity>
            </CollapsibleSection>

            {/* ── Certifications ── */}
            <CollapsibleSection
                title="Certifications & Training"
                icon="ribbon-outline"
                defaultOpen={false}
            >
                {profile?.certifications && profile.certifications.length > 0 ? (
                    profile.certifications.map((cert, idx) => (
                        <View key={idx} style={styles.certRow}>
                            <View style={styles.certIconWrap}>
                                <Ionicons
                                    name={
                                        cert.status === 'valid'
                                            ? 'checkmark-circle'
                                            : cert.status === 'expiring_soon'
                                                ? 'warning'
                                                : 'close-circle'
                                    }
                                    size={20}
                                    color={
                                        cert.status === 'valid'
                                            ? '#28a745'
                                            : cert.status === 'expiring_soon'
                                                ? '#ff7a1a'
                                                : '#dc3545'
                                    }
                                />
                            </View>
                            <View style={styles.certInfo}>
                                <Text style={styles.certName}>{cert.name}</Text>
                                {cert.expiry_date && (
                                    <Text style={styles.certExpiry}>Expires: {cert.expiry_date}</Text>
                                )}
                            </View>
                            <View
                                style={[
                                    styles.certBadge,
                                    cert.status === 'valid' && styles.certValid,
                                    cert.status === 'expiring_soon' && styles.certExpiringSoon,
                                    cert.status === 'expired' && styles.certExpired,
                                ]}
                            >
                                <Text style={styles.certBadgeText}>
                                    {cert.status === 'valid'
                                        ? 'Valid'
                                        : cert.status === 'expiring_soon'
                                            ? 'Expiring'
                                            : 'Expired'}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptySection}>
                        <Ionicons name="ribbon-outline" size={32} color="#dee2e6" />
                        <Text style={styles.emptySectionText}>
                            {loadingProfile ? 'Loading...' : 'No certification records available'}
                        </Text>
                    </View>
                )}
            </CollapsibleSection>

            {/* ── Mobile App Access ── */}
            <CollapsibleSection
                title="Mobile App Access"
                icon="phone-portrait-outline"
                defaultOpen={false}
            >
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => navigation.navigate('FaceEnrollment')}
                >
                    <View style={[styles.menuIcon, { backgroundColor: faceEnrolled ? '#d4edda' : '#e8f0fe' }]}>
                        <Ionicons
                            name="scan-outline"
                            size={22}
                            color={faceEnrolled ? '#28a745' : '#212c6b'}
                        />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Face Enrollment</Text>
                        <Text style={styles.menuSubtext}>
                            {faceEnrolled ? 'Face registered — tap to re-enroll' : 'Tap to enroll your face'}
                        </Text>
                    </View>
                    <View style={[styles.enrollBadge, faceEnrolled ? styles.enrolledBadge : styles.notEnrolledBadge]}>
                        <Text style={styles.enrollBadgeText}>
                            {faceEnrolled ? 'Enrolled' : 'Required'}
                        </Text>
                    </View>
                </TouchableOpacity>
            </CollapsibleSection>

            {/* ── Settings & Support ── */}
            <CollapsibleSection
                title="Settings & Support"
                icon="settings-outline"
                defaultOpen={false}
            >
                {/* <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => Alert.alert('Contact Support', 'support@iet.com\n+65 1234 5678')}
                >
                    <View style={[styles.menuIcon, { backgroundColor: '#e8f0fe' }]}>
                        <Ionicons name="help-circle-outline" size={22} color="#212c6b" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Help & Support</Text>
                        <Text style={styles.menuSubtext}>Contact support team</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
                </TouchableOpacity> */}

                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => Linking.openURL('https://iet.com.sg/terms')}
                >
                    <View style={[styles.menuIcon, { backgroundColor: '#f3f0ff' }]}>
                        <Ionicons name="document-text-outline" size={22} color="#6f42c1" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Terms & Conditions</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => Linking.openURL('https://iet.com.sg/privacy-policy')}
                >
                    <View style={[styles.menuIcon, { backgroundColor: '#e8f8ee' }]}>
                        <Ionicons name="shield-checkmark-outline" size={22} color="#28a745" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Privacy Policy</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
                </TouchableOpacity>
            </CollapsibleSection>

            {/* ── App Info ── */}
            <View style={styles.appInfo}>
                <Text style={styles.appVersion}>Version 1.0.0</Text>
                <Text style={styles.copyright}>© 2026 IET Workforce Management System</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },

    // Header
    header: {
        backgroundColor: '#212c6b',
        padding: 20,
        paddingTop: 55,
        paddingBottom: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },

    // Profile hero
    profileHero: {
        alignItems: 'center',
        marginTop: -40,
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    avatarRing: {
        padding: 4,
        borderRadius: 58,
        backgroundColor: '#fff',
        shadowColor: '#212c6b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarLarge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#212c6b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLargeText: { fontSize: 44, fontWeight: 'bold', color: '#fff' },
    userName: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', marginTop: 14 },
    userEmpId: { fontSize: 14, color: '#000000', marginTop: 4 },
    userRole: { fontSize: 13, color: '#212c6b', marginTop: 4, fontWeight: '600' },
    badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e9ecef',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4,
    },
    badgeText: { fontSize: 12, color: '#495057', fontWeight: '600' },
    badgeActive: { backgroundColor: '#d4edda' },
    badgeActiveText: { color: '#28a745' },
    badgeInactive: { backgroundColor: '#fdecea' },
    badgeInactiveText: { color: '#dc3545' },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    joinedText: { fontSize: 12, color: '#adb5bd', marginTop: 8 },

    // Warning banners
    warningBanner: {
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: '#fff8f0',
        padding: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#ff7a1a',
    },
    errorBanner: { backgroundColor: '#fef2f2', borderLeftColor: '#dc3545' },
    warningText: { flex: 1, color: '#b35900', fontSize: 13, lineHeight: 18 },
    errorText: { color: '#dc3545' },

    // Collapsible section
    sectionCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    sectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    sectionIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#e8f0fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
    sectionDivider: { height: 1, backgroundColor: '#f1f3f5', marginHorizontal: 16 },
    sectionBody: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },

    requestEditText: { color: '#212c6b', fontSize: 12, fontWeight: '600' },

    // Detail rows
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f9fa',
    },
    detailLabelWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    detailLabel: { fontSize: 13, color: '#000000' },
    detailValue: { fontSize: 13, color: '#1a1a2e', fontWeight: '500', flex: 1, textAlign: 'right' },
    warningValue: { color: '#ff7a1a', fontWeight: '700' },
    errorValue: { color: '#dc3545', fontWeight: '700' },

    // Attendance stats
    rateBarWrap: { marginBottom: 14 },
    rateBarBg: {
        height: 8,
        backgroundColor: '#e9ecef',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    rateBarFill: { height: '100%', borderRadius: 4 },
    rateBarLabel: { fontSize: 12, color: '#000000', textAlign: 'right' },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    statBox: { alignItems: 'center', flex: 1 },
    statNumber: { fontSize: 22, fontWeight: 'bold' },
    statLabel: { fontSize: 11, color: '#000000', marginTop: 3 },

    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f3f5',
    },
    linkText: { flex: 1, color: '#212c6b', fontSize: 13, fontWeight: '600' },

    // Certifications
    certRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f9fa',
        gap: 10,
    },
    certIconWrap: { width: 28, alignItems: 'center' },
    certInfo: { flex: 1 },
    certName: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
    certExpiry: { fontSize: 11, color: '#000000', marginTop: 2 },
    certBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: '#e9ecef',
    },
    certValid: { backgroundColor: '#d4edda' },
    certExpiringSoon: { backgroundColor: '#fff4e6' },
    certExpired: { backgroundColor: '#fdecea' },
    certBadgeText: { fontSize: 11, fontWeight: '700', color: '#495057' },

    // Menu items
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f9fa',
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuContent: { flex: 1 },
    menuText: { fontSize: 14, fontWeight: '500', color: '#1a1a2e' },
    menuSubtext: { fontSize: 12, color: '#000000', marginTop: 2 },

    // Face enrollment badge
    enrollBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    enrolledBadge: { backgroundColor: '#d4edda' },
    notEnrolledBadge: { backgroundColor: '#fdecea' },
    enrollBadgeText: { fontSize: 11, fontWeight: '700', color: '#495057' },

    // Empty states inside sections
    emptySection: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    emptySectionText: { fontSize: 13, color: '#adb5bd' },

    // App info footer
    appInfo: { alignItems: 'center', paddingVertical: 24, marginBottom: 20, gap: 4 },
    appVersion: { fontSize: 12, color: '#adb5bd' },
    copyright: { fontSize: 11, color: '#ced4da' },
});

export default ProfileScreen;