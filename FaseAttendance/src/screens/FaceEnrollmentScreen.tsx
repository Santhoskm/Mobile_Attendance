import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { muteCameraSound } from '../utils/cameraOptimizer';
import * as ImageManipulator from 'expo-image-manipulator';




const FaceEnrollmentScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(true);
    const cameraRef = useRef<CameraView>(null);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        loadUserData();
        requestCameraPermission();
        setupMutedCamera();
    }, []);

    const setupMutedCamera = async () => {
        await muteCameraSound();
    };

    const loadUserData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            console.log('Raw userData from storage:', userDataString);

            if (userDataString) {
                const data = JSON.parse(userDataString);
                console.log('Parsed user data:', data);

                const empid = data.empid || data.employee_id || data.empno || data.employeeId;
                console.log('Extracted empid:', empid);

                setUserData({
                    ...data,
                    empid: empid
                });

                if (!empid) {
                    console.log('No empid found in user data');
                    Alert.alert(
                        'Error',
                        'Employee ID not found. Please login again.',
                        [
                            {
                                text: 'OK',
                                onPress: () => navigation.replace('Login')
                            }
                        ]
                    );
                }
            } else {
                console.log('No user data found in storage');
                Alert.alert(
                    'Error',
                    'User data not found. Please login again.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.replace('Login')
                        }
                    ]
                );
            }
        } catch (error) {
            console.log('Error loading user data:', error);
            Alert.alert('Error', 'Failed to load user data. Please login again.');
        }
    };

    const requestCameraPermission = async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');

        if (status !== 'granted') {
            Alert.alert(
                'Permission Required',
                'Camera permission is needed to enroll your face.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Grant Permission', onPress: requestCameraPermission }
                ]
            );
        }
    };

    const takePicture = async () => {
        if (cameraRef.current && cameraReady) {
            try {
                if (Platform.OS === 'android') {
                    await Audio.setAudioModeAsync({
                        shouldDuckAndroid: true,
                        playThroughEarpieceAndroid: false,
                    });
                }

                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.7,
                    base64: true,
                    skipProcessing: true,
                    mute: true,
                    ...(Platform.OS === 'android' && { mute: true })
                });

                if (photo) {
                    setImage(photo.uri);
                    setShowCamera(false);
                }
            } catch (error) {
                console.log('Error taking picture:', error);
                Alert.alert('Error', 'Failed to take picture. Please try again.');
            }
        }
    };

    const retakePicture = () => {
        setImage(null);
        setShowCamera(true);
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




    const enrollFace = async () => {
        if (!image) {
            Alert.alert('Error', 'Please take a photo first.');
            return;
        }

        const empid = userData?.empid;
        console.log('Using empid for enrollment:', empid);

        if (!empid) {
            Alert.alert(
                'Error',
                'Employee ID not found. Please login again.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.replace('Login')
                    }
                ]
            );
            return;
        }

        setIsLoading(true);

        const compressedUri = await compressImage(image);

        try {
            const formData = new FormData();
            formData.append('empid', empid);
            formData.append('image', {
                uri: compressedUri,
                type: 'image/jpeg',
                name: 'face_image.jpg',
            } as any);

            console.log('Sending enrollment request for empid:', empid);

            const response = await apiService.enrollFace(formData);

            console.log('Enrollment response:', response);

            if (response.message || response.status === 'success') {
                await AsyncStorage.setItem('faceEnrolled', 'true');

                try {
                    const verification = await apiService.checkFaceEnrollment(empid);
                    if (verification.enrolled) {
                        Alert.alert(
                            'Success',
                            response.message || 'Face enrolled successfully!',
                            [
                                {
                                    text: 'OK',
                                    onPress: () => navigation.goBack()
                                }
                            ]
                        );
                    } else {
                        Alert.alert(
                            'Warning',
                            'Face enrollment completed but verification failed. Please contact support if you face issues.',
                            [
                                {
                                    text: 'OK',
                                    onPress: () => navigation.goBack()
                                }
                            ]
                        );
                    }
                } catch (verifyError) {
                    console.log('Verification error:', verifyError);
                    Alert.alert(
                        'Success',
                        response.message || 'Face enrolled successfully!',
                        [
                            {
                                text: 'OK',
                                onPress: () => navigation.goBack()
                            }
                        ]
                    );
                }
            } else {
                Alert.alert(
                    'Enrollment Failed',
                    response.error || response.message || 'Failed to enroll face. Please try again.'
                );
            }
        } catch (error: any) {
            console.log('Enrollment error:', error);

            let errorMessage = 'Failed to enroll face. Please try again.';

            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message === 'Network Error') {
                errorMessage = 'Cannot connect to server. Please check your internet connection.';
            }

            Alert.alert('Enrollment Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Face Enrollment</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text style={styles.permissionText}>Requesting camera permission...</Text>
                </View>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Face Enrollment</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContent}>
                    <Ionicons name="camera-outline" size={80} color="#6c757d" />
                    <Text style={styles.permissionText}>Camera permission is required</Text>
                    <TouchableOpacity
                        style={styles.grantButton}
                        onPress={requestCameraPermission}
                    >
                        <Text style={styles.grantButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Face Enrollment</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {showCamera ? (
                    <>
                        <View style={styles.cameraContainer}>
                            <CameraView
                                ref={cameraRef}
                                style={styles.camera}
                                facing="front"
                                onCameraReady={() => setCameraReady(true)}
                                mute={true}
                                pictureSize="640x480"
                                animateShutter={false}
                            />
                            <View style={styles.overlay}>
                                <View style={styles.faceFrame}>
                                    <Text style={styles.faceFrameText}>Align your face here</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.instructions}>
                            <Ionicons name="bulb-outline" size={20} color="#007bff" />
                            <Text style={styles.instructionText}>
                                Make sure your face is well-lit and centered in the frame
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={takePicture}
                        >
                            <View style={styles.captureInnerButton} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.previewContainer}>
                            <Image source={{ uri: image || '' }} style={styles.previewImage} />
                            <View style={styles.previewOverlay}>
                                <TouchableOpacity
                                    style={styles.retakeButton}
                                    onPress={retakePicture}
                                >
                                    <Ionicons name="refresh-outline" size={24} color="#fff" />
                                    <Text style={styles.retakeText}>Retake</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.previewInstructions}>
                            <Ionicons name="checkmark-circle-outline" size={24} color="#28a745" />
                            <Text style={styles.previewInstructionText}>
                                Review your photo before enrolling
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.enrollButton}
                            onPress={enrollFace}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                                    <Text style={styles.buttonText}>Enroll Face</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
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
    content: {
        flex: 1,
        padding: 20,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    cameraContainer: {
        height: Dimensions.get('window').height * 0.6,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 20,
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    faceFrame: {
        width: 250,
        height: 250,
        borderRadius: 125,
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
    instructions: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e7f3ff',
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        gap: 10,
    },
    instructionText: {
        flex: 1,
        color: '#007bff',
        fontSize: 14,
    },
    captureButton: {
        alignSelf: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    captureInnerButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#007bff',
    },
    previewContainer: {
        height: Dimensions.get('window').height * 0.6,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 20,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    previewOverlay: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    retakeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        gap: 10,
    },
    retakeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    previewInstructions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d4edda',
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        gap: 10,
    },
    previewInstructionText: {
        color: '#28a745',
        fontSize: 14,
        fontWeight: '500',
    },
    enrollButton: {
        backgroundColor: '#28a745',
        padding: 16,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
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
    permissionText: {
        color: '#6c757d',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
    },
});

export default FaceEnrollmentScreen;