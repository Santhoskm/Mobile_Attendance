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
    Modal,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Camera, CameraView } from 'expo-camera';
import { apiService } from '../services/api';

interface UserData {
    user_id?: number;
    username?: string;
    empid?: string;
}

interface AttendanceStatus {
    isCheckedIn: boolean;
    isCheckedOut: boolean;
    checkInTime: string | null;
    checkOutTime: string | null;
    checkInPlace?: string;
    checkOutPlace?: string;
}

const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
        isCheckedIn: false,
        isCheckedOut: false,
        checkInTime: null,
        checkOutTime: null,
    });
    const [faceEnrolled, setFaceEnrolled] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraAction, setCameraAction] = useState<'checkin' | 'checkout'>('checkin');
    const [cameraReady, setCameraReady] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [locationPermission, setLocationPermission] = useState(false);

    useEffect(() => {
        loadUserData();
        requestPermissions();
    }, []);

    // This will run whenever userData changes (after it's loaded)
    useEffect(() => {
        if (userData?.empid) {
            checkFaceEnrollment();
        }
    }, [userData]);

    const loadUserData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                const data = JSON.parse(userDataString);
                setUserData(data);
            }
        } catch (error) {
            console.log('Error loading user data:', error);
        }
    };

    const checkFaceEnrollment = async () => {
        try {
            const empid = userData?.empid;

            // If we have empid, check with server
            if (empid) {
                const result = await apiService.checkFaceEnrollment(empid);
                setFaceEnrolled(result.enrolled);

                // Update local storage to match server
                if (result.enrolled) {
                    await AsyncStorage.setItem('faceEnrolled', 'true');
                } else {
                    await AsyncStorage.removeItem('faceEnrolled');
                }
            } else {
                // Fallback to local storage if no empid
                const faceStatus = await AsyncStorage.getItem('faceEnrolled');
                setFaceEnrolled(faceStatus === 'true');
            }
        } catch (error) {
            console.log('Error checking face enrollment:', error);
            // Fallback to local storage
            const faceStatus = await AsyncStorage.getItem('faceEnrolled');
            setFaceEnrolled(faceStatus === 'true');
        }
    };

    const requestPermissions = async () => {
        // Request camera permission
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus.status === 'granted');

        // Request location permission
        const locationStatus = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(locationStatus.status === 'granted');

        if (locationStatus.status !== 'granted') {
            Alert.alert(
                'Permission Required',
                'Location permission is needed to mark attendance.',
                [{ text: 'OK' }]
            );
        }
    };

    const getCurrentLocation = async () => {
        if (!locationPermission) {
            Alert.alert('Error', 'Location permission not granted.');
            return null;
        }

        try {
            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            return currentLocation;
        } catch (error) {
            console.log('Error getting location:', error);
            Alert.alert('Error', 'Unable to get your location. Please enable GPS.');
            return null;
        }
    };

    const handleCheckIn = () => {
        if (!faceEnrolled) {
            Alert.alert(
                'Face Enrollment Required',
                'You need to enroll your face before checking in.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Enroll Now',
                        onPress: () => navigation.navigate('FaceEnrollment'),
                        style: 'default'
                    }
                ]
            );
            return;
        }

        if (attendanceStatus.isCheckedIn) {
            Alert.alert('Error', 'You have already checked in today.');
            return;
        }

        setCameraAction('checkin');
        setShowCamera(true);
    };

    const handleCheckOut = () => {
        if (!attendanceStatus.isCheckedIn) {
            Alert.alert('Error', 'You need to check in first before checking out.');
            return;
        }

        if (attendanceStatus.isCheckedOut) {
            Alert.alert('Error', 'You have already checked out today.');
            return;
        }

        setCameraAction('checkout');
        setShowCamera(true);
    };

    const captureAndVerify = async () => {
        if (cameraRef.current && cameraReady) {
            try {
                // Get current location
                const currentLocation = await getCurrentLocation();
                if (!currentLocation) {
                    Alert.alert('Error', 'Unable to get location. Please try again.');
                    setShowCamera(false);
                    return;
                }

                // Take picture
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    base64: true,
                });

                if (photo) {
                    setIsLoading(true);
                    setShowCamera(false);

                    const empid = userData?.empid;
                    if (!empid) {
                        Alert.alert('Error', 'Employee ID not found. Please login again.');
                        setIsLoading(false);
                        return;
                    }

                    // Prepare form data
                    const formData = new FormData();
                    formData.append('empid', empid);
                    formData.append('image', {
                        uri: photo.uri,
                        type: 'image/jpeg',
                        name: 'face_image.jpg',
                    } as any);
                    formData.append('latitude', currentLocation.coords.latitude.toString());
                    formData.append('longitude', currentLocation.coords.longitude.toString());

                    // Call appropriate API
                    let response;
                    if (cameraAction === 'checkin') {
                        response = await apiService.faceCheckIn(formData);
                    } else {
                        response = await apiService.faceCheckOut(formData);
                    }

                    console.log(`${cameraAction} response:`, response);

                    if (response.matched === true) {
                        const currentTime = new Date().toLocaleTimeString();

                        if (cameraAction === 'checkin') {
                            setAttendanceStatus({
                                isCheckedIn: true,
                                isCheckedOut: false,
                                checkInTime: currentTime,
                                checkOutTime: null,
                                checkInPlace: response.checkin_place,
                            });
                            Alert.alert(
                                'Success',
                                `Check-in successful!\nLocation: ${response.checkin_place || 'Unknown'}\nConfidence: ${(response.confidence * 100).toFixed(1)}%`
                            );
                        } else {
                            setAttendanceStatus({
                                ...attendanceStatus,
                                isCheckedOut: true,
                                checkOutTime: currentTime,
                                checkOutPlace: response.checkout_place,
                            });
                            Alert.alert(
                                'Success',
                                `Check-out successful!\nLocation: ${response.checkout_place || 'Unknown'}\nConfidence: ${(response.confidence * 100).toFixed(1)}%`
                            );
                        }
                    } else {
                        Alert.alert(
                            'Verification Failed',
                            response.message || 'Face verification failed. Please try again.'
                        );
                    }
                }
            } catch (error: any) {
                console.log(`${cameraAction} error:`, error);

                let errorMessage = `Failed to ${cameraAction}. Please try again.`;

                if (error.response?.data?.error) {
                    errorMessage = error.response.data.error;
                } else if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.message === 'Network Error') {
                    errorMessage = 'Cannot connect to server. Please check your internet connection.';
                }

                Alert.alert('Error', errorMessage);
            } finally {
                setIsLoading(false);
                setCameraReady(false);
            }
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUserData();
        await checkFaceEnrollment();
        setRefreshing(false);
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
                        await AsyncStorage.removeItem('userData');
                        await AsyncStorage.removeItem('userId');
                        await AsyncStorage.removeItem('rememberMe');
                        navigation.replace('Login');
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (hasCameraPermission === false) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {userData?.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                        </Text>
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.greeting}>{getGreeting()},</Text>
                        <Text style={styles.name}>{userData?.username || 'User'}</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                        <Ionicons name="log-out-outline" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.centerContent}>
                    <Ionicons name="camera-outline" size={80} color="#6c757d" />
                    <Text style={styles.permissionText}>Camera permission is required</Text>
                    <TouchableOpacity
                        style={styles.grantButton}
                        onPress={requestPermissions}
                    >
                        <Text style={styles.grantButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <>
            <ScrollView
                style={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {userData?.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.greeting}>{getGreeting()},</Text>
                        <Text style={styles.name}>{userData?.username || 'User'}</Text>
                        <Text style={styles.emp}>EMP: {userData?.empid || 'N/A'}</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                        <Ionicons name="log-out-outline" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Face Status Card */}
                <TouchableOpacity
                    style={[styles.faceCard, faceEnrolled ? styles.enrolledCard : styles.notEnrolledCard]}
                    onPress={() => !faceEnrolled && navigation.navigate('FaceEnrollment')}
                >
                    <Ionicons
                        name={faceEnrolled ? "checkmark-circle" : "scan-outline"}
                        size={44}
                        color={faceEnrolled ? "#22c55e" : "#fff"}
                    />
                    <View style={styles.faceCardText}>
                        <Text style={styles.faceTitle}>
                            {faceEnrolled ? "Face Registered" : "Face Not Registered"}
                        </Text>
                        <Text style={styles.faceSub}>
                            {faceEnrolled ? "Ready for face recognition" : "Tap to enroll your face"}
                        </Text>
                    </View>
                    {!faceEnrolled && <Ionicons name="chevron-forward" size={24} color="#fff" />}
                </TouchableOpacity>

                {/* Location Status */}
                <View style={styles.locationCard}>
                    <Ionicons name="location-outline" size={20} color={locationPermission ? "#28a745" : "#dc3545"} />
                    <Text style={styles.locationText}>
                        {locationPermission ? "Location access granted" : "Location access required"}
                    </Text>
                </View>

                {/* Mark Attendance Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Mark Attendance</Text>
                        <Text style={styles.time}>
                            {new Date().toLocaleTimeString()}
                        </Text>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[
                                styles.checkInButton,
                                (attendanceStatus.isCheckedIn || !faceEnrolled) && styles.disabledButton
                            ]}
                            onPress={handleCheckIn}
                            disabled={attendanceStatus.isCheckedIn || !faceEnrolled || isLoading}
                        >
                            <Ionicons name="log-in-outline" size={24} color="#fff" />
                            <Text style={styles.buttonText}>Check In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.checkOutButton,
                                (!attendanceStatus.isCheckedIn || attendanceStatus.isCheckedOut) && styles.disabledButton
                            ]}
                            onPress={handleCheckOut}
                            disabled={!attendanceStatus.isCheckedIn || attendanceStatus.isCheckedOut || isLoading}
                        >
                            <Ionicons name="log-out-outline" size={24} color="#fff" />
                            <Text style={styles.buttonText}>Check Out</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoText}>
                        <Ionicons name="camera-outline" size={16} color="#6c757d" />
                        <Text style={styles.infoTextContent}>
                            Live face verification with location tracking
                        </Text>
                    </View>
                </View>

                {/* Today's Overview */}
                <Text style={styles.sectionTitle}>Today's Overview</Text>
                <View style={styles.overviewGrid}>
                    <View style={styles.overviewCard}>
                        <Ionicons name="time-outline" size={32} color="#28a745" />
                        <Text style={styles.overviewValue}>
                            {attendanceStatus.checkInTime || '--:--'}
                        </Text>
                        <Text style={styles.overviewLabel}>Check In</Text>
                        {attendanceStatus.checkInPlace && (
                            <Text style={styles.overviewPlace}>{attendanceStatus.checkInPlace}</Text>
                        )}
                    </View>
                    <View style={styles.overviewCard}>
                        <Ionicons name="time-outline" size={32} color="#dc3545" />
                        <Text style={styles.overviewValue}>
                            {attendanceStatus.checkOutTime || '--:--'}
                        </Text>
                        <Text style={styles.overviewLabel}>Check Out</Text>
                        {attendanceStatus.checkOutPlace && (
                            <Text style={styles.overviewPlace}>{attendanceStatus.checkOutPlace}</Text>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Camera Modal */}
            <Modal
                visible={showCamera}
                animationType="slide"
                presentationStyle="fullScreen"
            >
                <View style={styles.cameraContainer}>
                    <View style={styles.cameraHeader}>
                        <Text style={styles.cameraTitle}>
                            {cameraAction === 'checkin' ? 'Check In' : 'Check Out'} - Face Verification
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setShowCamera(false);
                                setCameraReady(false);
                            }}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={30} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="front"
                        onCameraReady={() => setCameraReady(true)}
                    />

                    <View style={styles.faceFrameContainer}>
                        <View style={styles.faceFrame}>
                            <Text style={styles.faceFrameText}>Align your face here</Text>
                        </View>
                    </View>

                    <View style={styles.cameraFooter}>
                        <Text style={styles.cameraInstruction}>
                            Make sure your face is well-lit and centered
                        </Text>
                        <TouchableOpacity
                            style={[styles.captureButton, !cameraReady && styles.disabledButton]}
                            onPress={captureAndVerify}
                            disabled={!cameraReady || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="large" color="#fff" />
                            ) : (
                                <View style={styles.captureInnerButton} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#007bff',
        padding: 28,
        paddingTop: 55,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    profileButton: {
        width: 60,
        height: 60,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ffd400',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerTextContainer: {
        flex: 1,
        marginLeft: 15,
    },
    greeting: {
        color: '#dbeafe',
        fontSize: 14,
    },
    name: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    emp: {
        color: '#e0f2fe',
        fontSize: 13,
        marginTop: 2,
    },
    logoutButton: {
        padding: 5,
    },
    faceCard: {
        margin: 20,
        marginTop: -20,
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    enrolledCard: {
        backgroundColor: '#28a745',
    },
    notEnrolledCard: {
        backgroundColor: '#ff7a1a',
    },
    faceCardText: {
        flex: 1,
        marginLeft: 15,
    },
    faceTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    faceSub: {
        color: '#e0f2fe',
        fontSize: 13,
        marginTop: 4,
    },
    locationCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    locationText: {
        flex: 1,
        fontSize: 14,
        color: '#343a40',
    },
    card: {
        margin: 20,
        marginTop: 0,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#343a40',
    },
    time: {
        color: '#007bff',
        fontSize: 14,
        fontWeight: '500',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 15,
    },
    checkInButton: {
        flex: 1,
        backgroundColor: '#28a745',
        padding: 15,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    checkOutButton: {
        flex: 1,
        backgroundColor: '#dc3545',
        padding: 15,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    disabledButton: {
        backgroundColor: '#6c757d',
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    infoText: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    infoTextContent: {
        color: '#6c757d',
        fontSize: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginHorizontal: 20,
        marginBottom: 15,
        color: '#343a40',
    },
    overviewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 15,
        marginBottom: 20,
    },
    overviewCard: {
        width: '47%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    overviewValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#343a40',
        marginTop: 10,
    },
    overviewLabel: {
        color: '#6c757d',
        fontSize: 12,
        marginTop: 5,
    },
    overviewPlace: {
        fontSize: 10,
        color: '#6c757d',
        marginTop: 5,
        textAlign: 'center',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        color: '#6c757d',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
    },
    grantButton: {
        backgroundColor: '#007bff',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 20,
    },
    grantButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 55,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cameraTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: {
        padding: 5,
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    faceFrameContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    faceFrame: {
        width: Dimensions.get('window').width * 0.7,
        height: Dimensions.get('window').width * 0.7,
        borderRadius: Dimensions.get('window').width * 0.35,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    faceFrameText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        position: 'absolute',
        bottom: -30,
        width: 200,
    },
    cameraFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 30,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cameraInstruction: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInnerButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#007bff',
    },
});

export default DashboardScreen;