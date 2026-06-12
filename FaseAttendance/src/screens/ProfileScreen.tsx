import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [faceEnrolled, setFaceEnrolled] = useState(false);

    useEffect(() => {
        loadUserData();
        checkFaceEnrollment();
    }, []);

    const loadUserData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                setUserData(JSON.parse(userDataString));
            }
        } catch (error) {
            console.log('Error loading user data:', error);
        }
    };

    const checkFaceEnrollment = async () => {
        try {
            const faceStatus = await AsyncStorage.getItem('faceEnrolled');
            setFaceEnrolled(faceStatus === 'true');
        } catch (error) {
            console.log('Error checking face enrollment:', error);
        }
    };

    const handleEnrollFace = () => {
        navigation.navigate('FaceEnrollment');
    };

    const handleChangePassword = () => {
        Alert.alert('Change Password', 'This feature will be implemented soon.');
    };

    const handleContactSupport = () => {
        Alert.alert('Contact Support', 'support@iet.com\n+91 1234567890');
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                {/* <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 40 }} /> */}
            </View>

            {/* Profile Info */}
            <View style={styles.profileInfo}>
                <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>
                        {userData?.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                    </Text>
                </View>
                <Text style={styles.userName}>{userData?.username || 'User Name'}</Text>
                <Text style={styles.userEmpId}>Employee ID: {userData?.empid || 'N/A'}</Text>
                <Text style={styles.userRole}>Employee</Text>
            </View>

            {/* Stats Cards */}
            {/* <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>12</Text>
                    <Text style={styles.statLabel}>Total Days</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>98%</Text>
                    <Text style={styles.statLabel}>Attendance</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Leaves</Text>
                </View>
            </View> */}

            {/* Menu Items */}
            <View style={styles.menuSection}>
                <Text style={styles.menuTitle}>Account Settings</Text>

                <TouchableOpacity style={styles.menuItem} onPress={handleEnrollFace}>
                    <View style={styles.menuIcon}>
                        <Ionicons name="scan-outline" size={24} color={faceEnrolled ? "#28a745" : "#007bff"} />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Face Enrollment</Text>
                        <Text style={styles.menuSubtext}>
                            {faceEnrolled ? "Face already enrolled" : "Enroll your face for attendance"}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6c757d" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
                    <View style={styles.menuIcon}>
                        <Ionicons name="lock-closed-outline" size={24} color="#007bff" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Change Password</Text>
                        <Text style={styles.menuSubtext}>Update your password</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6c757d" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleContactSupport}>
                    <View style={styles.menuIcon}>
                        <Ionicons name="help-circle-outline" size={24} color="#007bff" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Help & Support</Text>
                        <Text style={styles.menuSubtext}>Contact support team</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6c757d" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIcon}>
                        <Ionicons name="document-text-outline" size={24} color="#007bff" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Terms & Conditions</Text>
                        <Text style={styles.menuSubtext}>Read our terms</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6c757d" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIcon}>
                        <Ionicons name="shield-checkmark-outline" size={24} color="#007bff" />
                    </View>
                    <View style={styles.menuContent}>
                        <Text style={styles.menuText}>Privacy Policy</Text>
                        <Text style={styles.menuSubtext}>Read our privacy policy</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6c757d" />
                </TouchableOpacity>
            </View>

            {/* App Info */}
            <View style={styles.appInfo}>
                <Text style={styles.appVersion}>Version 1.0.0</Text>
                <Text style={styles.copyright}>© 2026 IET Workforce Management System</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#007bff',
        padding: 20,
        paddingTop: 55,
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    profileInfo: {
        alignItems: 'center',
        marginTop: -40,
        marginBottom: 20,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ffd400',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarLargeText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#343a40',
        marginTop: 15,
    },
    userEmpId: {
        fontSize: 16,
        color: '#6c757d',
        marginTop: 5,
    },
    userRole: {
        fontSize: 14,
        color: '#007bff',
        marginTop: 5,
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 25,
        gap: 15,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#007bff',
    },
    statLabel: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 5,
    },
    menuSection: {
        marginHorizontal: 20,
        marginBottom: 25,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 15,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    menuIcon: {
        width: 40,
        alignItems: 'center',
    },
    menuContent: {
        flex: 1,
        marginLeft: 10,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#343a40',
    },
    menuSubtext: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 2,
    },
    appInfo: {
        alignItems: 'center',
        paddingVertical: 20,
        marginBottom: 20,
    },
    appVersion: {
        fontSize: 12,
        color: '#6c757d',
    },
    copyright: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 5,
    },
});

export default ProfileScreen;