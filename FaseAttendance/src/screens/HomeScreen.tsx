// // HomeScreen.tsx - Grid dashboard landing screen
// import React, { useState, useEffect } from 'react';
// import {
//     View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Location from 'expo-location';
// import { apiService } from '../services/api';

// interface UserData {
//     username?: string;
//     empid?: string;
//     position?: string;
// }

// interface TileConfig {
//     key: string;
//     label: string;
//     icon: keyof typeof Ionicons.glyphMap;
//     color: string;
//     onPress: (navigation: any) => void;
// }

// const TILES: TileConfig[] = [
//     {
//         key: 'attendance',
//         label: 'Attendance',
//         icon: 'time-outline',
//         color: '#007bff',
//         onPress: (navigation) => navigation.navigate('AttendanceHistory'),
//     },
//     {
//         key: 'leave',
//         label: 'Leave',
//         icon: 'calendar-outline',
//         color: '#20c997',
//         onPress: (navigation) => navigation.navigate('Leave'),
//     },
//     {
//         key: 'projects',
//         label: 'Projects',
//         icon: 'briefcase-outline',
//         color: '#fd7e14',
//         onPress: (navigation) => navigation.navigate('Projects'),
//     },
//     {
//         key: 'violations',
//         label: 'Violations',
//         icon: 'warning-outline',
//         color: '#dc3545',
//         onPress: (navigation) => navigation.navigate('Violations'),
//     },
//     {
//         key: 'documents',
//         label: 'Documents',
//         icon: 'document-text-outline',
//         color: '#6f42c1',
//         onPress: (navigation) => navigation.navigate('Documents'),
//     },
//     {
//         key: 'faceEnrollment',
//         label: 'Face Register',
//         icon: 'scan-outline',
//         color: '#0dcaf0',
//         onPress: (navigation) => navigation.navigate('FaceEnrollment'),
//     },
// ];

// const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
//     const [userData, setUserData] = useState<UserData | null>(null);
//     const [now, setNow] = useState(new Date());
//     const [placeName, setPlaceName] = useState<string>('');
//     const [faceEnrolled, setFaceEnrolled] = useState(false);

//     useEffect(() => {
//         loadUserData();
//         resolveLocationLabel();
//         const timer = setInterval(() => setNow(new Date()), 1000);
//         return () => clearInterval(timer);
//     }, []);

//     const loadUserData = async () => {
//         try {
//             const userDataString = await AsyncStorage.getItem('userData');
//             if (userDataString) {
//                 const data = JSON.parse(userDataString);
//                 setUserData(data);
//                 checkFaceEnrollment(data?.empid);
//             }
//         } catch (error) {
//             console.log('Error loading user data:', error);
//         }
//     };

//     const checkFaceEnrollment = async (empid?: string) => {
//         try {
//             if (empid) {
//                 const result = await apiService.checkFaceEnrollment(empid);
//                 setFaceEnrolled(result.enrolled);
//                 if (result.enrolled) {
//                     await AsyncStorage.setItem('faceEnrolled', 'true');
//                 } else {
//                     await AsyncStorage.removeItem('faceEnrolled');
//                 }
//             } else {
//                 const faceStatus = await AsyncStorage.getItem('faceEnrolled');
//                 setFaceEnrolled(faceStatus === 'true');
//             }
//         } catch (error) {
//             console.log('Error checking face enrollment:', error);
//             const faceStatus = await AsyncStorage.getItem('faceEnrolled');
//             setFaceEnrolled(faceStatus === 'true');
//         }
//     };

//     const resolveLocationLabel = async () => {
//         try {
//             const { status } = await Location.requestForegroundPermissionsAsync();
//             if (status !== 'granted') return;
//             const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
//             const places = await Location.reverseGeocodeAsync({
//                 latitude: location.coords.latitude,
//                 longitude: location.coords.longitude,
//             });
//             if (places && places.length > 0) {
//                 const p = places[0];
//                 setPlaceName([p.city, p.region].filter(Boolean).join(', '));
//             }
//         } catch (error) {
//             console.log('Location label error:', error);
//         }
//     };

//     const getGreeting = () => {
//         const hour = now.getHours();
//         if (hour < 12) return 'Good Morning';
//         if (hour < 17) return 'Good Afternoon';
//         return 'Good Evening';
//     };

//     const handleLogout = () => {
//         Alert.alert(
//             'Logout',
//             'Are you sure you want to logout?',
//             [
//                 { text: 'Cancel', style: 'cancel' },
//                 {
//                     text: 'Logout',
//                     onPress: async () => {
//                         await apiService.logout();
//                         await AsyncStorage.removeItem('rememberMe');
//                         navigation.replace('Login');
//                     },
//                     style: 'destructive'
//                 }
//             ]
//         );
//     };

//     const dateStr = now.toLocaleDateString(undefined, {
//         weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
//     });
//     const timeStr = now.toLocaleTimeString(undefined, {
//         hour: '2-digit', minute: '2-digit', second: '2-digit',
//     });

//     return (
//         <SafeAreaView style={styles.container}>
//             {/* Header - same blue rounded header used on Project Detail */}
//             <View style={styles.header}>
//                 <View style={{ flex: 1 }}>
//                     <Text style={styles.headerGreeting} numberOfLines={1}>
//                         {getGreeting()},
//                     </Text>
//                     <Text style={styles.headerTitle} numberOfLines={1}>
//                         {userData?.username || 'User'}
//                     </Text>
//                     <View style={styles.employeeInfo}>
//                         <View style={styles.infoBadge}>
//                             <Ionicons name="briefcase-outline" size={14} color="#fff" />
//                             <Text style={styles.infoText}>EMP: {userData?.empid || 'N/A'}</Text>
//                         </View>
//                         <View style={styles.infoBadge}>
//                             <Ionicons name="business-outline" size={14} color="#fff" />
//                             <Text style={styles.infoText}>
//                                 {userData?.position || 'Employee'}
//                             </Text>
//                         </View>
//                     </View>
//                 </View>
//                 <TouchableOpacity
//                     style={styles.logoutButton}
//                     onPress={handleLogout}
//                 >
//                     <Ionicons name="log-out-outline" size={22} color="#fff" />
//                     <Text style={styles.logoutButtonText}>Logout</Text>
//                 </TouchableOpacity>
//             </View>

//             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
//                 {/* Floating white card - same pattern as Project Detail's tab bar card */}
//                 <View style={styles.clockCard}>
//                     <View style={{ flex: 1 }}>
//                         <Text style={styles.clockDate}>{dateStr}</Text>
//                         <Text style={styles.clockTime}>{timeStr}</Text>
//                         {!!placeName && (
//                             <View style={styles.placeRow}>
//                                 <Ionicons name="location-outline" size={13} color="#6c757d" />
//                                 <Text style={styles.placeText}>{placeName}</Text>
//                             </View>
//                         )}
//                     </View>
//                     <View style={styles.clockIconWrap}>
//                         <Ionicons name="time-outline" size={26} color="#007bff" />
//                     </View>
//                 </View>

//                 <View style={styles.section}>
//                     <View style={styles.sectionHeader}>
//                         <Text style={styles.sectionTitle}>What do you want to do today?</Text>
//                     </View>

//                     {/* Grid */}
//                     <View style={styles.grid}>
//                         {TILES.map((tile) => {
//                             const isFaceTile = tile.key === 'faceEnrollment';
//                             const isDisabled = isFaceTile && faceEnrolled;
//                             return (
//                                 <TouchableOpacity
//                                     key={tile.key}
//                                     style={[styles.tile, isDisabled && styles.tileDisabled]}
//                                     activeOpacity={0.8}
//                                     disabled={isDisabled}
//                                     onPress={() => tile.onPress(navigation)}
//                                 >
//                                     <View
//                                         style={[
//                                             styles.tileIconWrap,
//                                             { backgroundColor: isDisabled ? '#e9ecef' : `${tile.color}1A` },
//                                         ]}
//                                     >
//                                         <Ionicons
//                                             name={isDisabled ? 'checkmark-circle' : tile.icon}
//                                             size={26}
//                                             color={isDisabled ? '#adb5bd' : tile.color}
//                                         />
//                                     </View>
//                                     <Text style={[styles.tileLabel, isDisabled && styles.tileLabelDisabled]}>
//                                         {isFaceTile && faceEnrolled ? 'Enrolled' : tile.label}
//                                     </Text>
//                                 </TouchableOpacity>
//                             );
//                         })}
//                     </View>
//                 </View>
//             </ScrollView>
//         </SafeAreaView>
//     );
// };

// const styles = StyleSheet.create({
//     // Matches ProjectDetailScreen's container/header/section tokens exactly
//     container: { flex: 1, backgroundColor: '#f0f4f8' },
//     header: {
//         backgroundColor: '#007bff',
//         paddingTop: 55,
//         paddingBottom: 20,
//         paddingHorizontal: 20,
//         flexDirection: 'row',
//         alignItems: 'flex-start',
//         justifyContent: 'space-between',
//         borderBottomLeftRadius: 30,
//         borderBottomRightRadius: 30,
//     },
//     headerGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
//     headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 2, marginBottom: 10 },
//     employeeInfo: {
//         flexDirection: 'row',
//         gap: 10,
//         flexWrap: 'wrap',
//     },
//     infoBadge: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         backgroundColor: 'rgba(255,255,255,0.2)',
//         paddingHorizontal: 10,
//         paddingVertical: 5,
//         borderRadius: 20,
//         gap: 4,
//     },
//     infoText: { color: '#fff', fontSize: 11 },
//     logoutButton: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         backgroundColor: 'rgba(255,255,255,0.2)',
//         paddingHorizontal: 14,
//         paddingVertical: 9,
//         borderRadius: 22,
//         gap: 6,
//         marginLeft: 10,
//         marginTop: 4,
//     },
//     logoutButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
//     avatar: {
//         width: 44, height: 44, borderRadius: 22,
//         backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
//     },
//     avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },

//     scrollContent: { paddingBottom: 40 },

//     clockCard: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         backgroundColor: '#fff',
//         marginHorizontal: 16,
//         marginTop: -18,
//         marginBottom: 20,
//         borderRadius: 16,
//         padding: 16,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.08,
//         shadowRadius: 8,
//         elevation: 4,
//     },
//     clockDate: { color: '#6c757d', fontSize: 12, fontWeight: '600', marginBottom: 4 },
//     clockTime: { color: '#343a40', fontSize: 24, fontWeight: 'bold' },
//     placeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
//     placeText: { color: '#6c757d', fontSize: 12 },
//     clockIconWrap: {
//         width: 48, height: 48, borderRadius: 24, backgroundColor: '#e8f0fe',
//         alignItems: 'center', justifyContent: 'center',
//     },

//     section: { marginHorizontal: 16, marginBottom: 20 },
//     sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
//     sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40' },

//     grid: {
//         flexDirection: 'row',
//         flexWrap: 'wrap',
//         justifyContent: 'space-between',
//     },
//     tile: {
//         width: '31%',
//         backgroundColor: '#fff',
//         borderRadius: 14,
//         paddingVertical: 16,
//         alignItems: 'center',
//         marginBottom: 14,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.05,
//         shadowRadius: 6,
//         elevation: 2,
//     },
//     tileIconWrap: {
//         width: 48, height: 48, borderRadius: 24,
//         alignItems: 'center', justifyContent: 'center', marginBottom: 8,
//     },
//     tileLabel: { fontSize: 11, fontWeight: '600', color: '#343a40', textAlign: 'center' },
//     tileDisabled: { opacity: 0.6 },
//     tileLabelDisabled: { color: '#adb5bd' },
// });

// export default HomeScreen;

// HomeScreen.tsx - Grid dashboard landing screen
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { apiService } from '../services/api';
import FloatingBroadcastButton from '../components/FloatingBroadcastButton';

interface UserData {
    username?: string;
    empid?: string;
    position?: string;
}

interface NotificationItem {
    id: string;
    type: 'leave' | 'ot';
    status: 'Approved' | 'Rejected';
    title: string;
    subtitle: string;
    date: string | null;
}

interface RecentAttendanceItem {
    id: string;
    projectName: string;
    dateLabel: string;
    timeLabel: string;
    placeLabel: string;
    isCheckedOut: boolean;
}

interface TileConfig {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: (navigation: any) => void;
}

const DISMISSED_NOTIF_KEY = 'homeDismissedNotificationIds';

const TILES: TileConfig[] = [
    {
        key: 'attendance',
        label: 'Attendance',
        icon: 'time-outline',
        color: '#007bff',
        onPress: (navigation) => navigation.navigate('AttendanceHistory'),
    },
    {
        key: 'leave',
        label: 'Leave',
        icon: 'calendar-outline',
        color: '#20c997',
        onPress: (navigation) => navigation.navigate('Leave'),
    },
    {
        key: 'projects',
        label: 'Projects',
        icon: 'briefcase-outline',
        color: '#fd7e14',
        onPress: (navigation) => navigation.navigate('Projects'),
    },
    {
        key: 'violations',
        label: 'Violations',
        icon: 'warning-outline',
        color: '#dc3545',
        onPress: (navigation) => navigation.navigate('Violations'),
    },
    {
        key: 'documents',
        label: 'Documents',
        icon: 'document-text-outline',
        color: '#6f42c1',
        onPress: (navigation) => navigation.navigate('Documents'),
    },
    // {
    //     key: 'broadcasts',
    //     label: 'Broadcasts',
    //     icon: 'megaphone-outline',
    //     color: '#e83e8c',
    //     onPress: (navigation) => navigation.navigate('Broadcasts'),
    // },
    {
        key: 'faceEnrollment',
        label: 'Face Register',
        icon: 'scan-outline',
        color: '#0dcaf0',
        onPress: (navigation) => navigation.navigate('FaceEnrollment'),
    },
];

const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [now, setNow] = useState(new Date());
    const [placeName, setPlaceName] = useState<string>('');
    const [faceEnrolled, setFaceEnrolled] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [notifLoading, setNotifLoading] = useState(true);
    const [hiddenNotifIds, setHiddenNotifIds] = useState<string[]>([]);
    const [lastDismissed, setLastDismissed] = useState<NotificationItem | null>(null);
    const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

    const [recentAttendance, setRecentAttendance] = useState<RecentAttendanceItem[]>([]);
    const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState(true);

    useEffect(() => {
        loadUserData();
        resolveLocationLabel();
        loadDismissedNotifIds();
        loadNotifications();
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => {
            clearInterval(timer);
            if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        };
    }, []);

    const loadDismissedNotifIds = async () => {
        try {
            const stored = await AsyncStorage.getItem(DISMISSED_NOTIF_KEY);
            if (stored) {
                setHiddenNotifIds(JSON.parse(stored));
            }
        } catch (error) {
            console.log('Error loading dismissed notifications:', error);
        }
    };

    const persistDismissedNotifIds = async (ids: string[]) => {
        try {
            // Keep the last 50 so this doesn't grow forever
            await AsyncStorage.setItem(DISMISSED_NOTIF_KEY, JSON.stringify(ids.slice(-50)));
        } catch (error) {
            console.log('Error saving dismissed notifications:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            setNotifLoading(true);
            const [leaveRes, otRes] = await Promise.all([
                apiService.getMyLeaves(),
                apiService.getMyOt(),
            ]);

            const items: NotificationItem[] = [];

            if (leaveRes?.status && Array.isArray(leaveRes.leaves)) {
                leaveRes.leaves.forEach((l) => {
                    if (l.status !== 'Approved' && l.status !== 'Rejected') return;
                    items.push({
                        id: `leave-${l.id}`,
                        type: 'leave',
                        status: l.status,
                        title: `${l.leave_type} Leave ${l.status}`,
                        subtitle: `${l.from_date} - ${l.to_date}`,
                        date: l.reviewed_at || l.submitted_at,
                    });
                });
            }

            if (otRes?.status && Array.isArray(otRes.records)) {
                otRes.records.forEach((o: any) => {
                    if (o.status !== 'Approved' && o.status !== 'Rejected') return;
                    items.push({
                        id: `ot-${o.id}`,
                        type: 'ot',
                        status: o.status as 'Approved' | 'Rejected',
                        title: `Overtime ${o.status}`,
                        subtitle: o.date || o.attendance_date || o.project_name || '',
                        date: o.reviewed_at || o.date || o.attendance_date,
                    });
                });
            }

            items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            setNotifications(items.slice(0, 5));
        } catch (error) {
            console.log('Error loading notifications:', error);
        } finally {
            setNotifLoading(false);
        }
    };

    const loadUserData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                const data = JSON.parse(userDataString);
                setUserData(data);
                checkFaceEnrollment(data?.empid);
                loadRecentAttendance(data?.empid);
            } else {
                setAttendanceHistoryLoading(false);
            }
        } catch (error) {
            console.log('Error loading user data:', error);
            setAttendanceHistoryLoading(false);
        }
    };

    // Last 2 attendance records (most recent first) for the Home screen summary
    const loadRecentAttendance = async (empid?: string) => {
        if (!empid) {
            setAttendanceHistoryLoading(false);
            return;
        }
        try {
            setAttendanceHistoryLoading(true);
            const response = await apiService.getMyProjectCheckIns(empid);
            const checkins = Array.isArray(response?.checkins) ? response.checkins : [];

            const sorted = [...checkins].sort((a: any, b: any) => {
                const aTime = new Date(a.check_out_time || a.check_in_time || a.date || 0).getTime();
                const bTime = new Date(b.check_out_time || b.check_in_time || b.date || 0).getTime();
                return bTime - aTime;
            });

            const items: RecentAttendanceItem[] = sorted.slice(0, 2).map((r: any, idx: number) => {
                const isCheckedOut = !!r.check_out_time;
                const referenceTime = r.check_out_time || r.check_in_time || r.date;
                return {
                    id: String(r.id ?? idx),
                    projectName: r.project_name || 'Project',
                    dateLabel: formatDateOnly(referenceTime),
                    timeLabel: formatTimeOnly(referenceTime),
                    placeLabel: r.checkout_place || r.checkin_place || 'Not recorded',
                    isCheckedOut,
                };
            });
            setRecentAttendance(items);
        } catch (error) {
            console.log('Error loading recent attendance:', error);
        } finally {
            setAttendanceHistoryLoading(false);
        }
    };

    const formatDateOnly = (value?: string | null) => {
        if (!value) return '--';
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTimeOnly = (value?: string | null) => {
        if (!value) return '--';
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    // Swipe-to-dismiss a notification. It's hidden immediately and saved so it stays
    // hidden even after the screen refreshes. Undo (within a few seconds) brings it back.
    const handleDismissNotification = (item: NotificationItem) => {
        setHiddenNotifIds((prev) => {
            if (prev.includes(item.id)) return prev;
            const updated = [...prev, item.id];
            persistDismissedNotifIds(updated);
            return updated;
        });
        setLastDismissed(item);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = setTimeout(() => setLastDismissed(null), 4000);
    };

    const handleUndoDismiss = () => {
        if (!lastDismissed) return;
        const restoredId = lastDismissed.id;
        setHiddenNotifIds((prev) => {
            const updated = prev.filter((id) => id !== restoredId);
            persistDismissedNotifIds(updated);
            return updated;
        });
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setLastDismissed(null);
    };

    const checkFaceEnrollment = async (empid?: string) => {
        try {
            if (empid) {
                const result = await apiService.checkFaceEnrollment(empid);
                setFaceEnrolled(result.enrolled);
                if (result.enrolled) {
                    await AsyncStorage.setItem('faceEnrolled', 'true');
                } else {
                    await AsyncStorage.removeItem('faceEnrolled');
                }
            } else {
                const faceStatus = await AsyncStorage.getItem('faceEnrolled');
                setFaceEnrolled(faceStatus === 'true');
            }
        } catch (error) {
            console.log('Error checking face enrollment:', error);
            const faceStatus = await AsyncStorage.getItem('faceEnrolled');
            setFaceEnrolled(faceStatus === 'true');
        }
    };

    const resolveLocationLabel = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const places = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            if (places && places.length > 0) {
                const p = places[0];
                setPlaceName([p.city, p.region].filter(Boolean).join(', '));
            }
        } catch (error) {
            console.log('Location label error:', error);
        }
    };

    const getGreeting = () => {
        const hour = now.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    onPress: async () => {
                        await apiService.logout();
                        await AsyncStorage.removeItem('rememberMe');
                        navigation.replace('Login');
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const dateStr = now.toLocaleDateString(undefined, {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Header - same blue rounded header used on Project Detail */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerGreeting} numberOfLines={1}>
                        {getGreeting()},
                    </Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {userData?.username || 'User'}
                    </Text>
                    <View style={styles.employeeInfo}>
                        <View style={styles.infoBadge}>
                            <Ionicons name="briefcase-outline" size={14} color="#fff" />
                            <Text style={styles.infoText}>EMP: {userData?.empid || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoBadge}>
                            <Ionicons name="business-outline" size={14} color="#fff" />
                            <Text style={styles.infoText}>
                                {userData?.position || 'Employee'}
                            </Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={22} color="#fff" />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Floating white card - same pattern as Project Detail's tab bar card */}
                <View style={styles.clockCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.clockDate}>{dateStr}</Text>
                        <Text style={styles.clockTime}>{timeStr}</Text>
                        {!!placeName && (
                            <View style={styles.placeRow}>
                                <Ionicons name="location-outline" size={13} color="#6c757d" />
                                <Text style={styles.placeText}>{placeName}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.clockIconWrap}>
                        <Ionicons name="time-outline" size={26} color="#007bff" />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>What do you want to do today?</Text>
                    </View>

                    {/* Grid */}
                    <View style={styles.grid}>
                        {TILES.map((tile) => {
                            const isFaceTile = tile.key === 'faceEnrollment';
                            const isDisabled = isFaceTile && faceEnrolled;
                            return (
                                <TouchableOpacity
                                    key={tile.key}
                                    style={[styles.tile, isDisabled && styles.tileDisabled]}
                                    activeOpacity={0.8}
                                    disabled={isDisabled}
                                    onPress={() => tile.onPress(navigation)}
                                >
                                    <View
                                        style={[
                                            styles.tileIconWrap,
                                            { backgroundColor: isDisabled ? '#e9ecef' : `${tile.color}1A` },
                                        ]}
                                    >
                                        <Ionicons
                                            name={isDisabled ? 'checkmark-circle' : tile.icon}
                                            size={26}
                                            color={isDisabled ? '#adb5bd' : tile.color}
                                        />
                                    </View>
                                    <Text style={[styles.tileLabel, isDisabled && styles.tileLabelDisabled]}>
                                        {isFaceTile && faceEnrolled ? 'Enrolled' : tile.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Notifications - approved/rejected leave & OT show up here. Swipe left to dismiss, Undo appears below. */}
                {!notifLoading && notifications.filter((n) => !hiddenNotifIds.includes(n.id)).length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Notifications</Text>
                        </View>
                        <View style={styles.notifList}>
                            {notifications
                                .filter((item) => !hiddenNotifIds.includes(item.id))
                                .map((item) => {
                                    const isApproved = item.status === 'Approved';
                                    return (
                                        <Swipeable
                                            key={item.id}
                                            ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
                                            friction={2}
                                            rightThreshold={40}
                                            overshootRight={false}
                                            onSwipeableOpen={() => handleDismissNotification(item)}
                                            renderRightActions={() => (
                                                <View style={styles.notifDismissAction}>
                                                    <Ionicons name="trash-outline" size={20} color="#fff" />
                                                    <Text style={styles.notifDismissText}>Dismiss</Text>
                                                </View>
                                            )}
                                        >
                                            <View style={styles.notifCard}>
                                                <View
                                                    style={[
                                                        styles.notifIconWrap,
                                                        { backgroundColor: isApproved ? '#20c99733' : '#dc354533' },
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={isApproved ? 'checkmark-circle' : 'close-circle'}
                                                        size={22}
                                                        color={isApproved ? '#20c997' : '#dc3545'}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.notifTitle}>{item.title}</Text>
                                                    {!!item.subtitle && (
                                                        <Text style={styles.notifSubtitle}>{item.subtitle}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        </Swipeable>
                                    );
                                })}
                        </View>

                        {!!lastDismissed && (
                            <View style={styles.undoBar}>
                                <Text style={styles.undoText} numberOfLines={1}>
                                    Notification dismissed
                                </Text>
                                <TouchableOpacity onPress={handleUndoDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={styles.undoAction}>UNDO</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Recent Attendance - last 2 check-in/out records, each with its own date, time & place box */}
                {!attendanceHistoryLoading && recentAttendance.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Attendance</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('AttendanceHistory')}>
                                <Text style={styles.sectionLink}>View All</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.historyList}>
                            {recentAttendance.map((item) => (
                                <View key={item.id} style={styles.historyCard}>
                                    <View style={styles.historyCardHeader}>
                                        <Text style={styles.historyProjectName} numberOfLines={1}>
                                            {item.projectName}
                                        </Text>
                                        <View
                                            style={[
                                                styles.historyStatusBadge,
                                                { backgroundColor: item.isCheckedOut ? '#20c99733' : '#007bff33' },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.historyStatusText,
                                                    { color: item.isCheckedOut ? '#20c997' : '#007bff' },
                                                ]}
                                            >
                                                {item.isCheckedOut ? 'Checked Out' : 'Checked In'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.historyBoxRow}>
                                        <View style={styles.historyBox}>
                                            <Ionicons name="calendar-outline" size={15} color="#007bff" />
                                            <Text style={styles.historyBoxLabel}>Date</Text>
                                            <Text style={styles.historyBoxValue} numberOfLines={1}>
                                                {item.dateLabel}
                                            </Text>
                                        </View>
                                        <View style={styles.historyBox}>
                                            <Ionicons name="time-outline" size={15} color="#fd7e14" />
                                            <Text style={styles.historyBoxLabel}>Time</Text>
                                            <Text style={styles.historyBoxValue} numberOfLines={1}>
                                                {item.timeLabel}
                                            </Text>
                                        </View>
                                        <View style={styles.historyBox}>
                                            <Ionicons name="location-outline" size={15} color="#20c997" />
                                            <Text style={styles.historyBoxLabel}>Place</Text>
                                            <Text style={styles.historyBoxValue} numberOfLines={1}>
                                                {item.placeLabel}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
            <FloatingBroadcastButton navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    // Matches ProjectDetailScreen's container/header/section tokens exactly
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    header: {
        backgroundColor: '#007bff',
        paddingTop: 55,
        paddingBottom: 32,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 2, marginBottom: 10 },
    employeeInfo: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    infoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4,
    },
    infoText: { color: '#fff', fontSize: 11 },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 22,
        gap: 6,
        marginLeft: 10,
        marginTop: 4,
    },
    logoutButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    scrollContent: { paddingBottom: 40 },

    clockCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -10,
        marginBottom: 20,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    clockDate: { color: '#6c757d', fontSize: 12, fontWeight: '600', marginBottom: 4 },
    clockTime: { color: '#343a40', fontSize: 24, fontWeight: 'bold' },
    placeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
    placeText: { color: '#6c757d', fontSize: 12 },
    clockIconWrap: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#e8f0fe',
        alignItems: 'center', justifyContent: 'center',
    },

    section: { marginHorizontal: 16, marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40' },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    tile: {
        width: '31%',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    tileIconWrap: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    tileLabel: { fontSize: 11, fontWeight: '600', color: '#343a40', textAlign: 'center' },
    tileDisabled: { opacity: 0.6 },
    tileLabelDisabled: { color: '#adb5bd' },

    notifList: { gap: 10 },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    notifIconWrap: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
    },
    notifTitle: { fontSize: 13, fontWeight: '700', color: '#343a40' },
    notifSubtitle: { fontSize: 12, color: '#6c757d', marginTop: 2 },

    notifDismissAction: {
        backgroundColor: '#dc3545',
        justifyContent: 'center',
        alignItems: 'center',
        width: 76,
        borderRadius: 14,
        marginLeft: -14,
    },
    notifDismissText: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 4 },

    undoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#343a40',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginTop: 10,
    },
    undoText: { color: '#fff', fontSize: 12, flex: 1 },
    undoAction: { color: '#0dcaf0', fontSize: 12, fontWeight: '700', marginLeft: 12 },

    sectionLink: { fontSize: 12, fontWeight: '600', color: '#007bff' },

    historyList: { gap: 12 },
    historyCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    historyCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    historyProjectName: { fontSize: 14, fontWeight: '700', color: '#343a40', flex: 1, marginRight: 8 },
    historyStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    historyStatusText: { fontSize: 10, fontWeight: '700' },

    historyBoxRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    historyBox: {
        flex: 1,
        backgroundColor: '#f8f9fb',
        borderWidth: 1,
        borderColor: '#eef1f5',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 3,
    },
    historyBoxLabel: { fontSize: 10, color: '#adb5bd', fontWeight: '600', textTransform: 'uppercase' },
    historyBoxValue: { fontSize: 12, color: '#343a40', fontWeight: '700', textAlign: 'center' },
});

export default HomeScreen;