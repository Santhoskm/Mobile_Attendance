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
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Camera, CameraView } from 'expo-camera';
import { apiService } from '../services/api';
import * as ImageManipulator from 'expo-image-manipulator';
import { offlineQueue } from '../services/offlineQueue';
import * as Crypto from 'expo-crypto';
import { isWithinGeofence } from '../utils/geofence';
import { optimizeCameraForSpeed } from '../utils/cameraOptimizer';






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

const DashboardScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
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
    const isCapturingRef = useRef(false);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [locationPermission, setLocationPermission] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const shifts: any[] = route?.params?.selectedProject?.shifts || [];
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [showShiftPicker, setShowShiftPicker] = useState(false);
    const selectedProject = route?.params?.selectedProject;
    const siteLatitude = selectedProject?.latitude;
    const siteLongitude = selectedProject?.longitude;
    const geofenceRadius = selectedProject?.geofence_radius || 200;
    const projectId = route?.params?.projectId;
    const projectName =
        route?.params?.projectName ||
        selectedProject?.projectname ||
        selectedProject?.name ||
        'NAN';

    useEffect(() => {
        loadUserData();
        requestPermissions();
        setupAudioForMute();
        refreshPendingCount();
    }, []);

    useEffect(() => {
        if (userData?.empid) {
            checkFaceEnrollment();
            loadAttendanceStatus();
        }
    }, [userData]);

    useEffect(() => {
        if (showCamera && cameraReady) {
            const autoCaptureTimer = setTimeout(() => {
                captureAndVerify();
            }, 500);
            return () => clearTimeout(autoCaptureTimer);
        }
    }, [showCamera, cameraReady]);

    const setupAudioForMute = async () => {
        await optimizeCameraForSpeed();
    };

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


    const refreshPendingCount = async () => {
        const count = await offlineQueue.count();
        setPendingCount(count);
    };

    const loadAttendanceStatus = async () => {
        try {
            const empid = userData?.empid;
            if (!empid) return;

            const response = await apiService.getAttendanceStatus(empid);

            setAttendanceStatus({
                isCheckedIn: response.is_checked_in === true,
                isCheckedOut: response.is_checked_out === true,
                checkInTime: response.check_in_time || null,
                checkOutTime: response.check_out_time || null,
                checkInPlace: response.checkin_place || response.check_in_place,
                checkOutPlace: response.checkout_place || response.check_out_place,
            });
        } catch (error) {
            console.log('Attendance status load error:', error);
        }
    };

    const checkFaceEnrollment = async () => {
        try {
            const empid = userData?.empid;
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

    const requestPermissions = async () => {
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus.status === 'granted');

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

    const compressImage = async (uri: string): Promise<string> => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 480 } }],
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
            );
            return result.uri;
        } catch (error) {
            console.log('Image compression error:', error);
            return uri;
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

        if (shifts.length > 1) {
            setShowShiftPicker(true);
            return;
        }
        if (shifts.length === 1) {
            setSelectedShift(shifts[0]);
        }
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

    // TO:
    const captureAndVerify = async () => {
        if (!cameraRef.current || !cameraReady || isLoading || isCapturingRef.current) return;
        isCapturingRef.current = true;
        if (cameraRef.current && cameraReady) {
            let currentLocation: Location.LocationObject | null = null;
            let photo: any = null;
            let compressedUri: string = '';

            try {
                currentLocation = await getCurrentLocation();
                if (!currentLocation) {
                    Alert.alert('Error', 'Unable to get location. Please try again.');
                    setShowCamera(false);
                    return;
                }

                let geofenceStatus = 'unknown';
                if (siteLatitude && siteLongitude) {
                    const inside = isWithinGeofence(
                        currentLocation.coords.latitude,
                        currentLocation.coords.longitude,
                        siteLatitude,
                        siteLongitude,
                        geofenceRadius
                    );
                    geofenceStatus = inside ? 'inside' : 'outside';
                }

                setIsLoading(true);

                photo = await cameraRef.current.takePictureAsync({
                    quality: 0.6,

                    skipProcessing: true,
                    mute: true,
                    ...(Platform.OS === 'android' && { mute: true })
                });

                if (photo) {
                    setShowCamera(false);

                    const empid = userData?.empid;
                    if (!empid) {
                        Alert.alert('Error', 'Employee ID not found. Please login again.');
                        setIsLoading(false);
                        return;
                    }

                    compressedUri = await compressImage(photo.uri);

                    const formData = new FormData();
                    formData.append('empid', empid);
                    formData.append('image', {
                        uri: compressedUri,
                        type: 'image/jpeg',
                        name: 'face_image.jpg',
                    } as any);
                    formData.append('latitude', currentLocation.coords.latitude.toString());
                    formData.append('longitude', currentLocation.coords.longitude.toString());
                    formData.append('project_id', projectId ? projectId.toString() : '');
                    formData.append('project_name', projectName || 'NAN');
                    if (cameraAction === 'checkin' && selectedShift) {
                        formData.append('shift_id', String(selectedShift.id));
                    }
                    formData.append('geofence_status', geofenceStatus);

                    const requestId = Crypto.randomUUID();
                    formData.append('request_id', requestId);


                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Request timeout')), 40000)
                    );

                    let response;
                    if (cameraAction === 'checkin') {
                        response = await Promise.race([
                            apiService.faceCheckIn(formData),
                            timeoutPromise
                        ]);
                    } else {
                        response = await Promise.race([
                            apiService.faceCheckOut(formData),
                            timeoutPromise
                        ]);
                    }

                    if (response.error === 'already_checked_in') {
                        setAttendanceStatus({
                            isCheckedIn: true,
                            isCheckedOut: false,
                            checkInTime: response.check_in_time || new Date().toLocaleTimeString(),
                            checkOutTime: null,
                            checkInPlace: response.checkin_place || response.check_in_place,
                        });

                        Alert.alert('Already Checked In', response.message || 'You are already checked in.');
                        return;
                    }

                    if (response.error === 'wrong_project') {
                        Alert.alert(
                            'Wrong Project',
                            response.message || 'You already checked in to another project. Please check out first.'
                        );
                        await loadAttendanceStatus();
                        return;
                    }

                    if (response.error === 'no_open_checkin') {
                        setAttendanceStatus({
                            isCheckedIn: false,
                            isCheckedOut: false,
                            checkInTime: null,
                            checkOutTime: null,
                        });

                        Alert.alert(
                            'No Open Check-in',
                            response.message || 'No active check-in found. Please check in first.'
                        );
                        return;
                    }

                    if (response.error === 'Check-in not allowed outside shift hours') {
                        Alert.alert(
                            'Outside Shift Hours',
                            `Check-in is only allowed between ${response.shift_start} and ${response.shift_end}.`
                        );
                        return;
                    }


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
                                `Checked in successfully!`
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
                                `Checked out successfully!`
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

                const isConnectivityIssue =
                    error.message === 'Network Error' || error.message === 'Request timeout';

                if (isConnectivityIssue && photo && currentLocation) {
                    // Queue for later sync instead of failing outright
                    const loc = currentLocation;

                    await offlineQueue.enqueue({
                        empid: userData?.empid || '',
                        photoUri: compressedUri,
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                        projectId: projectId ? projectId.toString() : '',
                        projectName: projectName || 'NAN',
                        action: cameraAction,
                    });
                    await refreshPendingCount();
                    apiService.faceCheckIn // no-op reference to avoid unused import warnings

                    const currentTime = new Date().toLocaleTimeString();
                    if (cameraAction === 'checkin') {
                        setAttendanceStatus({
                            isCheckedIn: true,
                            isCheckedOut: false,
                            checkInTime: currentTime,
                            checkOutTime: null,
                            checkInPlace: 'Pending sync',
                        });
                    } else {
                        setAttendanceStatus(prev => ({
                            ...prev,
                            isCheckedOut: true,
                            checkOutTime: currentTime,
                            checkOutPlace: 'Pending sync',
                        }));
                    }

                    Alert.alert(
                        'Saved Offline',
                        `No connection — your ${cameraAction} was saved and will sync automatically when you're back online.`
                    );
                } else {
                    let errorMessage = `Failed to ${cameraAction}. Please try again.`;
                    if (error.response?.data?.error) {
                        errorMessage = error.response.data.error;
                    } else if (error.response?.data?.message) {
                        errorMessage = error.response.data.message;
                    }
                    Alert.alert('Error', errorMessage);
                }
            } finally {
                setIsLoading(false);
                setCameraReady(false);
                isCapturingRef.current = false;
            }
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUserData();
        await checkFaceEnrollment();
        await loadAttendanceStatus();
        await refreshPendingCount();
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
                        await apiService.logout();
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
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.navigate('Main')}
                    >
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.name}>Check In</Text>
                    </View>
                    <View style={styles.backButton} />
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
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.name}>Check In</Text>
                    </View>
                    <View style={styles.backButton} />
                </View>

                {/* Project Card - only shown when opened for a specific project */}
                {/* Project Card - Prominently displayed */}
                <View style={styles.projectCard}>
                    <Ionicons name="folder-outline" size={28} color="#212c6b" />
                    <View style={styles.projectInfo}>
                        <Text style={styles.projectLabel}>Current Project</Text>
                        <Text style={styles.projectName}>{projectName}</Text>
                        {projectId && (
                            <Text style={styles.projectId}>Project ID: {projectId}</Text>
                        )}
                    </View>
                </View>

                {/* Face Status Card - Only show if not enrolled */}
                {!faceEnrolled && (
                    <TouchableOpacity
                        style={styles.faceCard}
                        onPress={() => navigation.navigate('FaceEnrollment')}
                    >
                        <Ionicons name="scan-outline" size={44} color="#fff" />
                        <View style={styles.faceCardText}>
                            <Text style={styles.faceTitle}>Face Not Registered</Text>
                            <Text style={styles.faceSub}>Tap to enroll your face for attendance</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </TouchableOpacity>
                )}

                <View style={styles.locationCard}>
                    <Ionicons name="location-outline" size={20} color={locationPermission ? "#28a745" : "#dc3545"} />
                    <Text style={styles.locationText}>
                        {locationPermission ? "Location access granted" : "Location access required"}
                    </Text>
                </View>

                {pendingCount > 0 && (
                    <View style={styles.locationCard}>
                        <Ionicons name="cloud-upload-outline" size={20} color="#ff7a1a" />
                        <Text style={styles.locationText}>
                            {pendingCount} attendance record{pendingCount > 1 ? 's' : ''} waiting to sync
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.locationCard}
                    onPress={() => navigation.navigate('AttendanceHistory')}
                >
                    <Ionicons name="time-outline" size={20} color="#212c6b" />
                    <Text style={styles.locationText}>View Attendance History</Text>
                    <Ionicons name="chevron-forward" size={18} color="#6c757d" />
                </TouchableOpacity>

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
                        mute={true}
                        pictureSize="640x480"
                        animateShutter={false}
                        enableTorch={false}
                        zoom={0}
                        autofocus="off"
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
        backgroundColor: '#212c6b',
        padding: 28,
        paddingTop: 55,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 5,
        marginRight: 10,
    },
    headerTextContainer: {
        flex: 1,
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
    projectCard: {
        margin: 20,
        marginTop: 20,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#212c6b',
    },
    projectInfo: {
        flex: 1,
        marginLeft: 15,
    },
    projectLabel: {
        fontSize: 12,
        color: '#6c757d',
        marginBottom: 4,
    },
    projectName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 2,
    },
    projectId: {
        fontSize: 12,
        color: '#212c6b',
    },
    faceCard: {
        margin: 20,
        marginTop: -10,
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ff7a1a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        color: '#212c6b',
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
        backgroundColor: '#212c6b',
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
        backgroundColor: '#212c6b',
    },
});

export default DashboardScreen;