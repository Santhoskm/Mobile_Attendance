// HomeScreen.tsx - Grid dashboard landing screen
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { apiService } from '../services/api';

interface UserData {
    username?: string;
    empid?: string;
    position?: string;
}

interface TileConfig {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: (navigation: any) => void;
}

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

    useEffect(() => {
        loadUserData();
        resolveLocationLabel();
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const loadUserData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                const data = JSON.parse(userDataString);
                setUserData(data);
                checkFaceEnrollment(data?.empid);
            }
        } catch (error) {
            console.log('Error loading user data:', error);
        }
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
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    // Matches ProjectDetailScreen's container/header/section tokens exactly
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    header: {
        backgroundColor: '#007bff',
        paddingTop: 55,
        paddingBottom: 20,
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
        marginTop: -18,
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
});

export default HomeScreen;