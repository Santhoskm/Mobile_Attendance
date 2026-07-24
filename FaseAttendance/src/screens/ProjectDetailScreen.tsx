// ProjectDetailScreen.tsx
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
    FlatList,
    Modal,
    TextInput,
    SafeAreaView,
    Linking,
    Dimensions,
    Platform,
    InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { offlineQueue } from '../services/offlineQueue';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { isWithinGeofence } from '../utils/geofence';
import { optimizeCameraForSpeed } from '../utils/cameraOptimizer';
import * as ImageManipulator from 'expo-image-manipulator';


interface Shift {
    id: number;
    shift_name: string;
    shiftstarttime: string;
    shiftendtime: string;
    shift_startdate?: string | null;   // "YYYY-MM-DD"
    shift_enddate?: string | null;     // "YYYY-MM-DD"
    works_mon?: boolean;
    works_tue?: boolean;
    works_wed?: boolean;
    works_thu?: boolean;
    works_fri?: boolean;
    works_sat?: boolean;
    works_sun?: boolean;
}

interface ProjectDetail {
    id: number;
    projectname: string;
    project_code?: string;
    site_address?: string;
    shift_start?: string;
    shift_end?: string;
    shifts?: Shift[];
    assigned_shift_id?: number | null;
    role: 'Supervisor' | 'Employee';
    latitude?: number;
    longitude?: number;
    geofence_radius?: number;
}


interface Employee {
    empno: string;
    empname: string;
    role: string;
    designation: string;
    contact: string;
    shift_id?: number | null;
    shift_name?: string | null;
}

interface Violation {
    id: number;
    project_id: number;
    project_name: string;
    empno: string;
    employee_name: string;
    violation_type: string | null;
    violation_date: string;
    description: string;
    location: string;
    evidence_url: string | null;
    raised_by_empno: string;
    status: 'Pending' | 'Reviewed' | 'Rejected';
    penalty: string;
    reviewed_by_empno: string | null;
    reviewed_at: string | null;
    review_remarks: string;
    created_at: string;
}


// ADD after the Violation interface
interface OtRecord {
    id: number;
    date: string;
    check_in: string | null;
    check_out: string | null;
    shift_name: string | null;
    ot_minutes: number;
    ot_status: 'Pending' | 'Approved' | 'Rejected';
    ot_reviewed_by: string | null;
    ot_reviewed_at: string | null;
    ot_review_notes: string;
}

interface Document {
    id: number;
    project_id: number;
    project_name: string;
    empno: string;
    employee_name: string;
    direction: 'SUPERVISOR_TO_EMP' | 'EMP_TO_SUPERVISOR';
    sent_by_empno: string;
    title: string;
    document_type: string;
    description: string;
    file_url: string;
    status: 'Sent' | 'Acknowledged';
    created_at: string;
}

interface AttendanceRecord {
    id: number;
    date: string;
    check_in_time: string;
    check_out_time: string | null;
    status: string;
    checkin_place?: string;
    checkout_place?: string;
    shift_name?: string;
}

const ProjectDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
    const { projectId, projectName, userRole, project } = route.params;
    const isSupervisor = userRole === 'Supervisor';

    const [userData, setUserData] = useState<any>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Section nav bar state
    const [activeTab, setActiveTab] = useState<'attendance' | 'team' | 'violations' | 'ot' | 'documents'>('attendance');

    // Attendance state
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [currentCheckInId, setCurrentCheckInId] = useState<number | null>(null);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [otherProjectCheckIn, setOtherProjectCheckIn] = useState<string | null>(null);
    const shifts: Shift[] = project?.shifts || [];

    const getTodayDayKey = (): keyof Shift => {
        const map: (keyof Shift)[] = ['works_sun', 'works_mon', 'works_tue', 'works_wed', 'works_thu', 'works_fri', 'works_sat'];
        return map[new Date().getDay()];
    };

    // Is this shift scheduled to run at all today — within its date range and on today's weekday?
    const isShiftScheduledToday = (s: Shift) => {
        const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        if (s.shift_startdate && todayStr < s.shift_startdate) return false;
        if (s.shift_enddate && todayStr > s.shift_enddate) return false;
        const dayKey = getTodayDayKey();
        if (s[dayKey] === false) return false; // explicit day-off; undefined/true = scheduled
        return true;
    };

    // Human-readable reason a shift isn't available yet — powers the "Starts on ..." messaging.
    const getShiftScheduleLabel = (s: Shift): string | null => {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (s.shift_startdate && todayStr < s.shift_startdate) {
            const d = new Date(s.shift_startdate);
            return `Starts ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
        if (s.shift_enddate && todayStr > s.shift_enddate) return 'Shift ended';
        const dayKey = getTodayDayKey();
        if (s[dayKey] === false) return 'Not scheduled today';
        return null;
    };

    const isShiftActiveNow = (s: Shift) => {
        if (!isShiftScheduledToday(s)) return false;
        const nowStr = new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
        return nowStr >= s.shiftstarttime && nowStr <= s.shiftendtime;
    };
    const activeShifts = shifts.filter(isShiftActiveNow);

    // Worker: shift is fixed by their project assignment — no picking, just a window check.
    // Worker: shift is fixed by their project assignment — no picking, just a window check.
    const myShift: Shift | null = shifts.find(s => s.id === project?.assigned_shift_id) || null;
    const myShiftIsActiveNow = myShift ? isShiftActiveNow(myShift) : false;

    // Supervisor: locked to their assigned shift, same as a worker, whenever one is assigned.
    // Only a supervisor with NO shift assignment falls back to picking among whichever is live right now.
    const isShiftLockedSupervisor = isSupervisor && !!myShift;
    const [supervisorSelectedShift, setSupervisorSelectedShift] = useState<Shift | null>(null);

    useEffect(() => {
        if (!isSupervisor) return;
        if (myShift) {
            setSupervisorSelectedShift(myShift);
            return;
        }
        if (activeShifts.length === 1 && (!supervisorSelectedShift || !isShiftActiveNow(supervisorSelectedShift))) {
            setSupervisorSelectedShift(activeShifts[0]);
        } else if (supervisorSelectedShift && !isShiftActiveNow(supervisorSelectedShift)) {
            setSupervisorSelectedShift(null);
        }
        // re-check every 30s so the UI flips automatically at shift boundaries
    }, [shifts, isSupervisor, myShift]);

    const selectedShift = isSupervisor ? supervisorSelectedShift : myShift;

    // Camera state for attendance
    const [showCamera, setShowCamera] = useState(false);
    const [cameraAction, setCameraAction] = useState<'checkin' | 'checkout'>('checkin');
    const [cameraReady, setCameraReady] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [locationPermission, setLocationPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Violations state
    const [violations, setViolations] = useState<Violation[]>([]);
    const [loadingViolations, setLoadingViolations] = useState(false);

    const [otRecords, setOtRecords] = useState<OtRecord[]>([]);
    const [loadingOt, setLoadingOt] = useState(false);

    const [violationFilter, setViolationFilter] = useState<'all' | 'Pending' | 'Reviewed' | 'Rejected'>('all');

    // Documents state
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loadingDocuments, setLoadingDocuments] = useState(false);
    const [docFilter, setDocFilter] = useState<'all' | 'received' | 'sent'>('all');

    // Selected employee for profile view
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showEmployeeProfile, setShowEmployeeProfile] = useState(false);

    // Send document state
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendTargetEmpno, setSendTargetEmpno] = useState('');
    const [sendTitle, setSendTitle] = useState('');
    const [sendDocumentType, setSendDocumentType] = useState('General');
    const [sendDescription, setSendDescription] = useState('');
    const [sendFileUri, setSendFileUri] = useState<string | null>(null);
    const [sendFileName, setSendFileName] = useState('');
    const [sending, setSending] = useState(false);

    // Submit violation state
    const [showViolationModal, setShowViolationModal] = useState(false);
    const [violationTypes, setViolationTypes] = useState<any[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
    const [targetEmpno, setTargetEmpno] = useState('');
    const [violationDescription, setViolationDescription] = useState('');
    const [violationLocation, setViolationLocation] = useState('');
    const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Review violation state
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [reviewPenalty, setReviewPenalty] = useState('');
    const [reviewing, setReviewing] = useState(false);

    useEffect(() => {
        loadUserData();

        InteractionManager.runAfterInteractions(() => {
            requestPermissions();
        });
        if (isSupervisor) {
            loadViolationTypes();
        }
        refreshPendingCount();
    }, []);

    useEffect(() => {
        if (userData?.empid) {
            // Needed right away for the Check In / Check Out button state.
            checkAttendanceStatus();
            // Everything else can wait until the screen transition has finished,
            // instead of competing with it for the JS thread.
            InteractionManager.runAfterInteractions(() => {
                if (isSupervisor) {
                    loadEmployees();
                }
                loadViolations();
                loadOt();
                loadDocuments();
                loadAttendance();
            });
        }
    }, [userData]);

    const requestPermissions = async () => {
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus.status === 'granted');

        const locationStatus = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(locationStatus.status === 'granted');

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

    const loadViolationTypes = async () => {
        try {
            const response = await apiService.getViolationTypes();
            if (response.status && response.violation_types) {
                setViolationTypes(response.violation_types);
            }
        } catch (error) {
            console.log('Error loading violation types:', error);
        }
    };

    const loadEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const response = await apiService.getProjectEmployees(projectId, userData?.empid);
            if (response.status && response.employees) {
                setEmployees(response.employees);
            }
        } catch (error) {
            console.log('Error loading employees:', error);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const loadAttendance = async () => {
        setLoadingAttendance(true);
        try {
            const empid = userData?.empid;
            if (!empid) {
                setLoadingAttendance(false);
                return;
            }
            // Use existing my_project_checkins endpoint
            const response = await apiService.getMyProjectCheckIns(empid);
            if (response.status && response.checkins) {
                // Filter check-ins for this specific project
                const projectCheckins = response.checkins.filter(
                    (record: any) => String(record.project_id) === String(projectId)
                );
                // Format the data for display
                const formattedRecords = projectCheckins.map((record: any) => ({
                    id: record.id,
                    date: record.check_in_time ? new Date(record.check_in_time).toISOString().split('T')[0] : '',
                    check_in_time: record.check_in_time,
                    check_out_time: record.check_out_time,
                    status: record.check_out_time ? 'Completed' : 'Active',
                    checkin_place: record.check_in_place || record.checkin_place,
                    checkout_place: record.check_out_place || record.checkout_place,
                }));
                setAttendanceRecords(formattedRecords);
            }
        } catch (error) {
            console.log('Error loading attendance:', error);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const checkAttendanceStatus = async () => {
        try {
            const empid = userData?.empid;
            if (!empid) return;

            const response = await apiService.getAttendanceStatus(empid);
            if (response.is_checked_in) {

                // Check if the active check-in is for THIS project
                if (String(response.project_id) === String(projectId)) {
                    setIsCheckedIn(true);
                    setCheckInTime(response.check_in_time);
                    setCurrentCheckInId(response.id);
                    setOtherProjectCheckIn(null);
                } else {
                    // User is checked in to a DIFFERENT project
                    setIsCheckedIn(false);
                    setCheckInTime(null);
                    setCurrentCheckInId(null);
                    setOtherProjectCheckIn(response.project_name || 'Another Project');
                }
            } else {
                setIsCheckedIn(false);
                setCheckInTime(null);
                setCurrentCheckInId(null);
                setOtherProjectCheckIn(null);
            }
        } catch (error) {
            console.log('Error checking attendance status:', error);
        }
    };

    const refreshPendingCount = async () => {
        const count = await offlineQueue.count();
        setPendingCount(count);
    };

    const loadViolations = async () => {
        setLoadingViolations(true);
        try {
            const response = await apiService.getViolations(userData?.empid, String(projectId));
            if (response.status && response.violations) {
                setViolations(response.violations);
            }
        } catch (error) {
            console.log('Error loading violations:', error);
        } finally {
            setLoadingViolations(false);
        }
    };

    const loadOt = async () => {
        setLoadingOt(true);
        try {
            const response = await apiService.getMyOt(projectId);
            if (response.status) {
                setOtRecords(response.records);
            }
        } finally {
            setLoadingOt(false);
        }
    };




    const loadDocuments = async () => {
        setLoadingDocuments(true);
        try {
            const response = await apiService.getDocuments(userData?.empid, String(projectId));
            if (response.status && response.documents) {
                setDocuments(response.documents);
            }
        } catch (error) {
            console.log('Error loading documents:', error);
        } finally {
            setLoadingDocuments(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        if (isSupervisor) {
            await loadEmployees();
        }
        await loadViolations();
        await loadOt();
        await loadDocuments();
        await loadAttendance();
        await checkAttendanceStatus();
        await refreshPendingCount();
        setRefreshing(false);
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

    const handleAttendance = (action: 'checkin' | 'checkout') => {
        if (!userData?.empid) {
            Alert.alert('Error', 'Employee ID not found. Please login again.');
            return;
        }

        if (action === 'checkin' && isCheckedIn) {
            Alert.alert('Error', 'You are already checked in to this project.');
            return;
        }

        if (action === 'checkin' && otherProjectCheckIn) {
            Alert.alert(
                'Already Checked In',
                `You are checked in to "${otherProjectCheckIn}". Please check out first.`,
                [{ text: 'OK' }]
            );
            return;
        }

        if (action === 'checkout' && !isCheckedIn && !otherProjectCheckIn) {
            Alert.alert('Error', 'You need to check in first.');
            return;
        }


        if (action === 'checkin') {
            if (isShiftLockedSupervisor) {
                // Supervisor assigned to a specific shift — same rule as a worker.
                if (!myShiftIsActiveNow) {
                    const scheduleReason = getShiftScheduleLabel(myShift!);
                    if (scheduleReason) {
                        Alert.alert('Shift Not Available', scheduleReason);
                    } else {
                        Alert.alert('Outside Shift Hours', `Your shift is ${myShift!.shiftstarttime}–${myShift!.shiftendtime}.`);
                    }
                    return;
                }
            } else if (isSupervisor) {
                // Supervisor with no shift assignment — pick among whichever is live right now.
                if (shifts.length > 0 && activeShifts.length === 0) {
                    Alert.alert('No Shift Active', 'No shift is currently open for check-in. Please try again during shift hours.');
                    return;
                }
                if (activeShifts.length > 1 && !selectedShift) {
                    Alert.alert('Select a Shift', 'Please choose a shift before checking in.');
                    return;
                }
            } else {
                if (shifts.length > 0 && !myShift) {
                    Alert.alert('No Shift Assigned', 'You have not been assigned a shift on this project. Contact your supervisor.');
                    return;
                }
                if (myShift && !myShiftIsActiveNow) {
                    const scheduleReason = getShiftScheduleLabel(myShift);
                    if (scheduleReason) {
                        Alert.alert('Shift Not Available', scheduleReason);
                    } else {
                        Alert.alert('Outside Shift Hours', `Your shift is ${myShift.shiftstarttime}–${myShift.shiftendtime}.`);
                    }
                    return;
                }
            }
        }

        setCameraAction(action);
        setShowCamera(true);
    };

    const captureAndVerify = async () => {
        if (!cameraRef.current || !cameraReady || isLoading) return;

        let currentLocation: Location.LocationObject | null = null;
        let photo: any = null;
        let compressedUri: string = '';

        try {
            // Give instant feedback and take the photo first -- GPS/geofence checks
            // used to run before this and delayed the shutter with no spinner shown.
            setIsLoading(true);

            photo = await cameraRef.current.takePictureAsync({
                quality: 0.6,
                base64: true,
                skipProcessing: true,
                mute: true,
                ...(Platform.OS === 'android' && { mute: true })
            });
            setShowCamera(false);

            currentLocation = await getCurrentLocation();
            if (!currentLocation) {
                Alert.alert('Error', 'Unable to get location. Please try again.');
                setIsLoading(false);
                return;
            }

            // Check geofence if project has location
            if (project?.latitude && project?.longitude) {
                const inside = isWithinGeofence(
                    currentLocation.coords.latitude,
                    currentLocation.coords.longitude,
                    project.latitude,
                    project.longitude,
                    project.geofence_radius || 200
                );
                if (!inside) {
                    Alert.alert(
                        'Outside Geofence',
                        'You are outside the project location. Please move to the project site.',
                        [{ text: 'OK' }]
                    );
                    setIsLoading(false);
                    return;
                }
            }

            if (photo) {
                const empid = userData?.empid;
                if (!empid) {
                    Alert.alert('Error', 'Employee ID not found.');
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
                formData.append('project_id', String(projectId));
                if (cameraAction === 'checkin' && selectedShift) {
                    formData.append('shift_id', String(selectedShift.id));
                }

                const requestId = Crypto.randomUUID();
                formData.append('request_id', requestId);

                let response;
                if (cameraAction === 'checkin') {
                    response = await apiService.faceCheckIn(formData);
                } else {
                    response = await apiService.faceCheckOut(formData);
                }

                if (response.error === 'already_checked_in') {
                    setIsCheckedIn(true);
                    Alert.alert('Already Checked In', response.message || 'You are already checked in.');
                    await checkAttendanceStatus();
                    return;
                }

                if (response.error === 'wrong_project') {
                    Alert.alert(
                        'Wrong Project',
                        response.message || `You are checked in to "${response.active_project}". Please check out first.`
                    );
                    await checkAttendanceStatus();
                    return;
                }

                if (response.error === 'no_open_checkin') {
                    setIsCheckedIn(false);
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
                    if (cameraAction === 'checkin') {
                        setIsCheckedIn(true);
                        setCheckInTime(new Date().toLocaleTimeString());
                        setOtherProjectCheckIn(null);
                        Alert.alert(
                            'Success',
                            `Checked in successfully!`
                        );
                    } else {
                        setIsCheckedIn(false);
                        setCheckInTime(null);
                        setOtherProjectCheckIn(null);
                        if (response.ot_status === 'Pending') {
                            Alert.alert(
                                'Checked Out — Overtime Pending',
                                `You checked out ${response.ot_minutes} min late. This has been sent for approval and won't count until approved.`
                            );
                        } else {
                            Alert.alert(
                                'Success',
                                'Checked out successfully!'
                            );
                        }
                    }
                    await loadAttendance();
                    await checkAttendanceStatus();
                } else {
                    Alert.alert(
                        'Verification Failed',
                        response.message || 'Face verification failed. Please try again.'
                    );
                }
            }
        } catch (error: any) {
            console.log(`${cameraAction} error:`, error);

            const netState = await NetInfo.fetch();
            const isActuallyOffline = !netState.isConnected || !netState.isInternetReachable;
            const wasNetworkOrTimeout =
                error.message === 'Network Error' || error.code === 'ECONNABORTED';
            if (isActuallyOffline && wasNetworkOrTimeout && photo && currentLocation) {
                await offlineQueue.enqueue({
                    empid: userData?.empid || '',
                    photoUri: compressedUri,
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                    projectId: String(projectId),
                    projectName: projectName || 'NAN',
                    action: cameraAction,
                });
                await refreshPendingCount();

                Alert.alert(
                    'Saved Offline',
                    `No connection — your ${cameraAction} was saved and will sync automatically.`
                );
            } else if (!isActuallyOffline && error.code === 'ECONNABORTED') {
                Alert.alert(
                    'Server Slow',
                    'The server took too long to respond. Please check your connection and try again.'
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
        }
    };

    const handleViewEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setShowEmployeeProfile(true);
    };

    const filteredViolations = violations.filter(v => {
        if (violationFilter === 'all') return true;
        return v.status === violationFilter;
    });

    // AFTER
    const filteredDocuments = documents.filter(d => {
        if (docFilter === 'all') return true;
        const iSentThis = d.sent_by_empno === userData?.empid;
        if (docFilter === 'sent') return iSentThis;
        if (docFilter === 'received') return !iSentThis;
        return true;
    });

    // Badge counts for the section nav bar
    const pendingViolationsCount = violations.filter(v => v.status === 'Pending').length;
    const pendingOtCount = otRecords.filter(o => o.ot_status === 'Pending').length;
    const unreadDocumentsCount = documents.filter(d => d.status === 'Sent').length;

    // Icon-first tab bar: inactive tabs show just the icon (+ a small dot if something needs
    // attention), the active tab expands to show its label and full count.
    const tabItems: {
        key: 'attendance' | 'team' | 'violations' | 'ot' | 'documents';
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        activeIcon: keyof typeof Ionicons.glyphMap;
        count: number;
        visible: boolean;
    }[] = [
            { key: 'attendance', label: 'Attendance', icon: 'time-outline', activeIcon: 'time', count: 0, visible: true },
            { key: 'team', label: 'Team', icon: 'people-outline', activeIcon: 'people', count: employees.length, visible: isSupervisor },
            { key: 'violations', label: 'Violations', icon: 'warning-outline', activeIcon: 'warning', count: pendingViolationsCount, visible: true },
            { key: 'ot', label: 'OT', icon: 'hourglass-outline', activeIcon: 'hourglass', count: pendingOtCount, visible: true },
            { key: 'documents', label: 'Documents', icon: 'document-text-outline', activeIcon: 'document-text', count: unreadDocumentsCount, visible: true },
        ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return '#ff7a1a';
            case 'Reviewed':
            case 'Approved': return '#28a745';
            case 'Rejected': return '#dc3545';
            default: return '#6c757d';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'Pending': return '#fff4e6';
            case 'Reviewed':
            case 'Approved': return '#d4edda';
            case 'Rejected': return '#fdecea';
            default: return '#e9ecef';
        }
    };

    const handleSendDocument = async () => {
        if (!sendTargetEmpno.trim() && isSupervisor) {
            Alert.alert('Error', 'Please enter the employee number.');
            return;
        }
        if (!sendTitle.trim()) {
            Alert.alert('Error', 'Please enter a title.');
            return;
        }
        if (!sendFileUri) {
            Alert.alert('Error', 'Please select a file to upload.');
            return;
        }

        setSending(true);

        try {
            const formData = new FormData();
            formData.append('project_id', String(projectId));
            formData.append('sender_empno', userData?.empno || userData?.empid || '');
            formData.append('title', sendTitle.trim());
            formData.append('document_type', sendDocumentType);
            if (sendDescription.trim()) {
                formData.append('description', sendDescription.trim());
            }

            if (isSupervisor) {
                formData.append('target_empno', sendTargetEmpno.trim());
            }

            const filename = sendFileName || 'document.pdf';
            formData.append('file', {
                uri: sendFileUri,
                type: 'application/octet-stream',
                name: filename,
            } as any);

            const response = await apiService.sendDocument(formData);

            if (response.status) {
                Alert.alert('Success', 'Document sent successfully.');
                setShowSendModal(false);
                resetSendForm();
                loadDocuments();
            } else {
                Alert.alert('Error', response.message || 'Failed to send document.');
            }
        } catch (error: any) {
            console.log('Send document error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to send document.');
        } finally {
            setSending(false);
        }
    };

    const resetSendForm = () => {
        setSendTargetEmpno('');
        setSendTitle('');
        setSendDocumentType('General');
        setSendDescription('');
        setSendFileUri(null);
        setSendFileName('');
    };

    const handleAcknowledge = async (documentId: number) => {
        try {
            const response = await apiService.acknowledgeDocument(documentId, userData?.empno || userData?.empid || '');
            if (response.status) {
                Alert.alert('Success', 'Document acknowledged.');
                loadDocuments();
            } else {
                Alert.alert('Error', response.message || 'Failed to acknowledge document.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to acknowledge document.');
        }
    };

    const handleSubmitViolation = async () => {
        if (!targetEmpno.trim()) {
            Alert.alert('Error', 'Please enter the employee number.');
            return;
        }
        if (!violationDescription.trim()) {
            Alert.alert('Error', 'Please enter a description.');
            return;
        }

        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('project_id', String(projectId));
            formData.append('empno', targetEmpno.trim());
            formData.append('raised_by_empno', userData?.empno || userData?.empid || '');
            formData.append('description', violationDescription.trim());
            if (violationLocation.trim()) {
                formData.append('location', violationLocation.trim());
            }
            if (selectedTypeId) {
                formData.append('violation_type_id', String(selectedTypeId));
            }
            if (evidenceUri) {
                const filename = evidenceUri.split('/').pop() || 'evidence.jpg';
                formData.append('evidence', {
                    uri: evidenceUri,
                    type: 'image/jpeg',
                    name: filename,
                } as any);
            }

            const response = await apiService.submitViolation(formData);

            if (response.status) {
                Alert.alert('Success', 'Violation submitted successfully.');
                setShowViolationModal(false);
                resetViolationForm();
                loadViolations();
            } else {
                Alert.alert('Error', response.message || 'Failed to submit violation.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to submit violation.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetViolationForm = () => {
        setSelectedTypeId(null);
        setTargetEmpno('');
        setViolationDescription('');
        setViolationLocation('');
        setEvidenceUri(null);
    };

    const handleReviewViolation = (violation: Violation) => {
        setSelectedViolation(violation);
        setReviewAction('approve');
        setReviewRemarks('');
        setReviewPenalty('');
        setShowReviewModal(true);
    };

    const handleSubmitReview = async () => {
        if (!selectedViolation) return;

        setReviewing(true);

        try {
            const data = {
                reviewer_empno: userData?.empno || userData?.empid || '',
                action: reviewAction,
                review_remarks: reviewRemarks.trim() || 'No remarks provided.',
            };

            if (reviewAction === 'approve' && reviewPenalty.trim()) {
                (data as any).penalty = reviewPenalty.trim();
            }

            const response = await apiService.reviewViolation(selectedViolation.id, data);

            if (response.status) {
                Alert.alert('Success', response.message || 'Violation reviewed successfully.');
                setShowReviewModal(false);
                setSelectedViolation(null);
                loadViolations();
            } else {
                Alert.alert('Error', response.message || 'Failed to review violation.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to review violation.');
        } finally {
            setReviewing(false);
        }
    };

    const openFile = async (url: string) => {
        try {
            const fullUrl = url.startsWith('http') ? url : `http://143.198.220.10${url}`;
            const supported = await Linking.canOpenURL(fullUrl);
            if (supported) {
                await Linking.openURL(fullUrl);
            } else {
                Alert.alert('Error', 'Cannot open this file type.');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not open the file.');
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled || !result.assets?.[0]) return;

            const file = result.assets[0];
            const MAX_MB = 10;
            if (file.size && file.size > MAX_MB * 1024 * 1024) {
                Alert.alert('File Too Large', `Please upload files under ${MAX_MB}MB.`);
                return;
            }

            setSendFileUri(file.uri);
            setSendFileName(file.name);
        } catch (error) {
            Alert.alert('Error', 'Could not open file picker.');
        }
    };

    const pickEvidence = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
        });

        if (!result.canceled && result.assets[0]) {
            setEvidenceUri(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant camera access.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.6,
        });

        if (!result.canceled && result.assets[0]) {
            setEvidenceUri(result.assets[0].uri);
        }
    };

    const renderEmployeeItem = ({ item }: { item: Employee }) => (
        <TouchableOpacity style={styles.employeeCard} onPress={() => handleViewEmployee(item)}>
            <View style={styles.employeeAvatar}>
                <Text style={styles.employeeAvatarText}>
                    {item.empname ? item.empname.charAt(0).toUpperCase() : 'U'}
                </Text>
            </View>
            <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{item.empname}</Text>
                <Text style={styles.employeeId}>EMP: {item.empno}</Text>
                <Text style={styles.employeeRole}>{item.role}</Text>
                {item.shift_name && <Text style={styles.shiftTag}>{item.shift_name}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6c757d" />
        </TouchableOpacity>
    );

    const renderViolationItem = ({ item }: { item: Violation }) => (
        <View style={styles.violationCard}>
            <View style={styles.violationHeader}>
                <Text style={styles.violationEmpno}>{item.empno}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status}
                    </Text>
                </View>
            </View>
            <Text style={styles.violationType}>{item.violation_type || 'General Violation'}</Text>
            <Text style={styles.violationDesc} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.violationDate}>
                {new Date(item.violation_date).toLocaleDateString()} • Raised by: {item.raised_by_empno}
            </Text>
            {item.penalty && (
                <Text style={styles.penaltyText}>Penalty: {item.penalty}</Text>
            )}
            {isSupervisor && item.status === 'Pending' && (
                <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => handleReviewViolation(item)}
                >
                    <Text style={styles.reviewButtonText}>Review</Text>
                </TouchableOpacity>
            )}
        </View>
    );


    // ADD after renderViolationItem's closing );
    const renderOtItem = ({ item }: { item: OtRecord }) => (
        <View style={styles.violationCard}>
            <View style={styles.violationHeader}>
                <Text style={styles.violationEmpno}>{new Date(item.date).toLocaleDateString()}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.ot_status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.ot_status) }]}>
                        {item.ot_status}
                    </Text>
                </View>
            </View>
            <Text style={styles.violationType}>
                {item.shift_name || 'Shift'} · {item.ot_minutes} min overtime
            </Text>
            <Text style={styles.violationDesc}>
                Checked out at {item.check_out || '—'}
            </Text>
            {item.ot_reviewed_by && (
                <Text style={styles.violationDate}>
                    Reviewed by {item.ot_reviewed_by} on {item.ot_reviewed_at ? new Date(item.ot_reviewed_at).toLocaleDateString() : ''}
                </Text>
            )}
            {!!item.ot_review_notes && (
                <Text style={styles.penaltyText}>Note: {item.ot_review_notes}</Text>
            )}
        </View>
    );




    const renderDocumentItem = ({ item }: { item: Document }) => {
        const isReceived = item.direction === 'SUPERVISOR_TO_EMP';
        const isPending = item.status === 'Sent';

        return (
            <View style={styles.docCard}>
                <View style={styles.docIcon}>
                    <Ionicons name="document-text-outline" size={24} color="#212c6b" />
                </View>
                <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{item.title}</Text>
                    <Text style={styles.docMeta}>
                        {item.document_type} • {isReceived ? `From: ${item.sent_by_empno}` : `To: Supervisor`}
                    </Text>
                    <Text style={styles.docDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.docActions}>
                    <View style={[styles.docStatusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                        <Text style={[styles.docStatusText, { color: getStatusColor(item.status) }]}>
                            {item.status}
                        </Text>
                    </View>
                    {item.file_url && (
                        <TouchableOpacity onPress={() => openFile(item.file_url)} style={styles.docActionBtn}>
                            <Ionicons name="eye-outline" size={18} color="#212c6b" />
                        </TouchableOpacity>
                    )}
                    {isPending && isReceived && !isSupervisor && (
                        <TouchableOpacity onPress={() => handleAcknowledge(item.id)} style={styles.acknowledgeBtn}>
                            <Ionicons name="checkmark-outline" size={18} color="#28a745" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderAttendanceItem = ({ item }: { item: AttendanceRecord }) => (
        <View style={styles.attendanceRecordCard}>
            <View style={styles.attendanceRecordLeft}>
                <Text style={styles.attendanceRecordDate}>
                    {item.date ? new Date(item.date).toLocaleDateString() : '--'}
                </Text>

                {/* NEW SHIFT TAG */}
                {item.shift_name && <Text style={styles.shiftTag}>{item.shift_name}</Text>}

                <View style={styles.attendanceRecordTimes}>
                    <View style={styles.attendanceTimeRow}>
                        <Ionicons name="log-in-outline" size={14} color="#28a745" />
                        <Text style={styles.attendanceTimeText}>
                            {item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString() : '--:--'}
                        </Text>
                    </View>
                    <View style={styles.attendanceTimeRow}>
                        <Ionicons name="log-out-outline" size={14} color="#dc3545" />
                        <Text style={styles.attendanceTimeText}>
                            {item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString() : '--:--'}
                        </Text>
                    </View>
                </View>
            </View>
            <View style={styles.attendanceRecordRight}>
                <View style={[styles.attendanceStatusBadge,
                { backgroundColor: item.check_out_time ? '#d4edda' : '#fff4e6' }]}>
                    <Text style={[styles.attendanceStatusText,
                    { color: item.check_out_time ? '#28a745' : '#ff7a1a' }]}>
                        {item.check_out_time ? 'Completed' : 'Active'}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{projectName}</Text>
                <View style={styles.headerRight}>
                    <View style={[styles.roleHeaderBadge, isSupervisor ? styles.supervisorHeaderBadge : styles.employeeHeaderBadge]}>
                        <Text style={styles.roleHeaderBadgeText}>{isSupervisor ? 'Supervisor' : 'Employee'}</Text>
                    </View>
                </View>
            </View>

            {/* Section Nav Bar - icon-first: inactive tabs show just the icon, the active
                tab expands to show its label + count so the row never feels crowded */}
            <View style={styles.tabBarContainer}>
                {tabItems.filter((tab) => tab.visible).map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabBarItem, isActive && styles.tabBarItemActive]}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.tabIconWrap}>
                                <Ionicons
                                    name={isActive ? tab.activeIcon : tab.icon}
                                    size={isActive ? 18 : 20}
                                    color={isActive ? '#fff' : '#6c757d'}
                                />
                                {!isActive && tab.count > 0 && <View style={styles.tabDot} />}
                            </View>
                            {isActive && (
                                <>
                                    <Text style={styles.tabBarLabelActive} numberOfLines={1}>
                                        {tab.label}
                                    </Text>
                                    {tab.count > 0 && (
                                        <View style={styles.tabBarBadge}>
                                            <Text style={styles.tabBarBadgeText}>{tab.count}</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Attendance Section */}
                {activeTab === 'attendance' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Attendance</Text>
                            <View style={styles.attendanceStatusContainer}>
                                {isCheckedIn ? (
                                    <View style={styles.checkedInBadge}>
                                        <Ionicons name="checkmark-circle" size={14} color="#28a745" />
                                        <Text style={styles.checkedInText}>Checked In</Text>
                                    </View>
                                ) : otherProjectCheckIn ? (
                                    <View style={styles.otherProjectBadge}>
                                        <Ionicons name="warning-outline" size={14} color="#ff7a1a" />
                                        <Text style={styles.otherProjectText}>In: {otherProjectCheckIn}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.checkedOutBadge}>
                                        <Ionicons name="time-outline" size={14} color="#6c757d" />
                                        <Text style={styles.checkedOutText}>Checked Out</Text>
                                    </View>
                                )}
                                {pendingCount > 0 && (
                                    <View style={styles.pendingBadge}>
                                        <Ionicons name="cloud-upload-outline" size={14} color="#ff7a1a" />
                                        <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Show warning if checked in to another project */}
                        {otherProjectCheckIn && (
                            <View style={styles.warningInfo}>
                                <Ionicons name="warning-outline" size={16} color="#ff7a1a" />
                                <Text style={styles.warningInfoText}>
                                    You are checked in to "{otherProjectCheckIn}". Please check out first.
                                </Text>
                            </View>
                        )}

                        {shifts.length > 0 && !isCheckedIn && !otherProjectCheckIn && (
                            <View style={styles.shiftListContainer}>
                                <Text style={styles.shiftListLabel}>
                                    {myShift
                                        ? (getShiftScheduleLabel(myShift) || 'Your Shift')
                                        : isSupervisor
                                            ? (activeShifts.length > 0 ? 'Select Shift' : 'No shift active right now')
                                            : 'No shift assigned — contact your supervisor'}
                                </Text>
                                {shifts.map((s) => {
                                    if (isSupervisor && !myShift) {
                                        const tappable = isShiftActiveNow(s);
                                        const isSelected = selectedShift?.id === s.id;
                                        return (
                                            <TouchableOpacity
                                                key={s.id}
                                                disabled={!tappable}
                                                onPress={() => tappable && setSupervisorSelectedShift(s)}
                                                style={[
                                                    styles.shiftListRow,
                                                    isSelected && styles.shiftListRowActive,
                                                    !tappable && styles.shiftListRowDisabled,
                                                ]}
                                            >
                                                <View style={styles.shiftListTimeBox}>
                                                    <Text style={[styles.shiftListTimeText, !tappable && styles.shiftListTimeTextDisabled]}>{s.shiftstarttime}</Text>
                                                </View>
                                                <View style={styles.shiftListTimeBox}>
                                                    <Text style={[styles.shiftListTimeText, !tappable && styles.shiftListTimeTextDisabled]}>{s.shiftendtime}</Text>
                                                </View>
                                                {isSelected && (
                                                    <Ionicons name="checkmark-circle" size={20} color="#28a745" style={{ marginLeft: 8 }} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }
                                    const isMine = myShift?.id === s.id;
                                    return (
                                        <View
                                            key={s.id}
                                            style={[
                                                styles.shiftListRow,
                                                isMine && styles.shiftListRowActive,
                                                !isMine && styles.shiftListRowDisabled,
                                            ]}
                                        >
                                            <View style={styles.shiftListTimeBox}>
                                                <Text style={[styles.shiftListTimeText, !isMine && styles.shiftListTimeTextDisabled]}>{s.shiftstarttime}</Text>
                                            </View>
                                            <View style={styles.shiftListTimeBox}>
                                                <Text style={[styles.shiftListTimeText, !isMine && styles.shiftListTimeTextDisabled]}>{s.shiftendtime}</Text>
                                            </View>
                                            {isMine && (
                                                <Ionicons name="checkmark-circle" size={20} color="#28a745" style={{ marginLeft: 8 }} />
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.attendanceButtonRow}>
                            <TouchableOpacity
                                style={[
                                    styles.checkInButton,
                                    (isCheckedIn || otherProjectCheckIn || (shifts.length > 0 && (
                                        isShiftLockedSupervisor
                                            ? !myShiftIsActiveNow
                                            : isSupervisor
                                                ? (activeShifts.length === 0 || (activeShifts.length > 1 && !selectedShift))
                                                : (!myShift || !myShiftIsActiveNow)
                                    ))) && styles.disabledButton,
                                ]}
                                onPress={() => handleAttendance('checkin')}
                                disabled={isCheckedIn || !!otherProjectCheckIn || isLoading || (shifts.length > 0 && (
                                    isShiftLockedSupervisor
                                        ? !myShiftIsActiveNow
                                        : isSupervisor
                                            ? (activeShifts.length === 0 || (activeShifts.length > 1 && !selectedShift))
                                            : (!myShift || !myShiftIsActiveNow)
                                ))}
                            >
                                <Ionicons name="log-in-outline" size={24} color="#fff" />
                                <Text style={styles.attendanceButtonText}>Check In</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.checkOutButton, (!isCheckedIn && !otherProjectCheckIn) && styles.disabledButton]}
                                onPress={() => handleAttendance('checkout')}
                                disabled={(!isCheckedIn && !otherProjectCheckIn) || isLoading}
                            >
                                <Ionicons name="log-out-outline" size={24} color="#fff" />
                                <Text style={styles.attendanceButtonText}>Check Out</Text>
                            </TouchableOpacity>
                        </View>

                        {isCheckedIn && checkInTime && (
                            <View style={styles.checkInInfo}>
                                <Ionicons name="time-outline" size={16} color="#28a745" />
                                <Text style={styles.checkInInfoText}>
                                    Checked in at: {checkInTime}
                                </Text>
                            </View>
                        )}

                        {/* Attendance History */}
                        {loadingAttendance ? (
                            <ActivityIndicator size="small" color="#212c6b" style={{ marginTop: 8 }} />
                        ) : attendanceRecords.length > 0 ? (
                            <View style={styles.attendanceHistory}>
                                <Text style={styles.attendanceHistoryTitle}>Recent Activity</Text>
                                <FlatList
                                    data={attendanceRecords.slice(0, 5)}
                                    keyExtractor={(item) => String(item.id)}
                                    renderItem={renderAttendanceItem}
                                    scrollEnabled={false}
                                    nestedScrollEnabled
                                />
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No attendance records for this project</Text>
                        )}
                    </View>
                )}

                {/* Employee List (Supervisor only) */}
                {activeTab === 'team' && isSupervisor && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                Team Members{myShift ? ` · ${myShift.shift_name}` : ''}
                            </Text>
                            <Text style={styles.sectionCount}>{employees.length}</Text>
                        </View>
                        {loadingEmployees ? (
                            <ActivityIndicator size="small" color="#212c6b" />
                        ) : employees.length === 0 ? (
                            <Text style={styles.emptyText}>No employees assigned</Text>
                        ) : (
                            <FlatList
                                data={employees}
                                keyExtractor={(item) => item.empno}
                                renderItem={renderEmployeeItem}
                                scrollEnabled={false}
                                nestedScrollEnabled
                            />
                        )}
                    </View>
                )}

                {/* Violations Section */}
                {activeTab === 'violations' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Violations</Text>
                            <View style={styles.sectionActions}>
                                {isSupervisor && (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => setShowViolationModal(true)}
                                    >
                                        <Ionicons name="add" size={20} color="#212c6b" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                            {(['all', 'Pending', 'Reviewed', 'Rejected'] as const).map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.filterChip, violationFilter === f && styles.filterChipActive]}
                                    onPress={() => setViolationFilter(f)}
                                >
                                    <Text style={[styles.filterChipText, violationFilter === f && styles.filterChipTextActive]}>
                                        {f === 'all' ? 'All' : f}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {loadingViolations ? (
                            <ActivityIndicator size="small" color="#212c6b" />
                        ) : filteredViolations.length === 0 ? (
                            <Text style={styles.emptyText}>No violations found</Text>
                        ) : (
                            <FlatList
                                data={filteredViolations}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={renderViolationItem}
                                scrollEnabled={false}
                                nestedScrollEnabled
                            />
                        )}
                    </View>
                )}


                {/* OT Section — own overtime status only, no approve/reject here */}
                {activeTab === 'ot' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Overtime</Text>
                        </View>

                        {loadingOt ? (
                            <ActivityIndicator size="small" color="#212c6b" />
                        ) : otRecords.length === 0 ? (
                            <Text style={styles.emptyText}>No overtime records for this project</Text>
                        ) : (
                            <FlatList
                                data={otRecords}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={renderOtItem}
                                scrollEnabled={false}
                                nestedScrollEnabled
                            />
                        )}
                    </View>
                )}

                {/* Documents Section */}
                {activeTab === 'documents' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Documents</Text>
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => setShowSendModal(true)}
                            >
                                <Ionicons name="send-outline" size={20} color="#212c6b" />
                                <Text style={styles.addButtonText}>Send</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                            {(['all', 'received', 'sent'] as const).map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.filterChip, docFilter === f && styles.filterChipActive]}
                                    onPress={() => setDocFilter(f)}
                                >
                                    <Text style={[styles.filterChipText, docFilter === f && styles.filterChipTextActive]}>
                                        {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {loadingDocuments ? (
                            <ActivityIndicator size="small" color="#212c6b" />
                        ) : filteredDocuments.length === 0 ? (
                            <Text style={styles.emptyText}>No documents found</Text>
                        ) : (
                            <FlatList
                                data={filteredDocuments}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={renderDocumentItem}
                                scrollEnabled={false}
                                nestedScrollEnabled
                            />
                        )}
                    </View>
                )}
            </ScrollView>
            {/* Camera Modal for Attendance */}
            <Modal
                visible={showCamera}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowCamera(false)}
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
                        autofocus="on"
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

            {/* Employee Profile Modal */}
            <Modal visible={showEmployeeProfile} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Employee Profile</Text>
                            <TouchableOpacity onPress={() => setShowEmployeeProfile(false)}>
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>
                        {selectedEmployee && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.profileAvatar}>
                                    <Text style={styles.profileAvatarText}>
                                        {selectedEmployee.empname ? selectedEmployee.empname.charAt(0).toUpperCase() : 'U'}
                                    </Text>
                                </View>
                                <Text style={styles.profileName}>{selectedEmployee.empname}</Text>
                                <Text style={styles.profileEmpno}>EMP: {selectedEmployee.empno}</Text>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Role</Text>
                                    <Text style={styles.profileValue}>{selectedEmployee.role}</Text>
                                </View>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Designation</Text>
                                    <Text style={styles.profileValue}>{selectedEmployee.designation || 'N/A'}</Text>
                                </View>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Contact</Text>
                                    <Text style={styles.profileValue}>{selectedEmployee.contact || 'N/A'}</Text>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Send Document Modal */}
            <Modal visible={showSendModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send Document</Text>
                            <TouchableOpacity onPress={() => setShowSendModal(false)}>
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {isSupervisor && (
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Employee Number *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter employee number"
                                        value={sendTargetEmpno}
                                        onChangeText={setSendTargetEmpno}
                                        autoCapitalize="none"
                                    />
                                </View>
                            )}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Title *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Enter document title"
                                    value={sendTitle}
                                    onChangeText={setSendTitle}
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Document Type</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={sendDocumentType}
                                        onValueChange={(value) => setSendDocumentType(value)}
                                        style={styles.picker}
                                    >
                                        {['Warning Letter', 'Show Cause', 'Contract', 'Payslip', 'Medical Certificate', 'Leave Form', 'General', 'Other'].map((type) => (
                                            <Picker.Item key={type} label={type} value={type} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Description</Text>
                                <TextInput
                                    style={[styles.formInput, styles.textArea]}
                                    placeholder="Add a description..."
                                    value={sendDescription}
                                    onChangeText={setSendDescription}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>File *</Text>
                                <TouchableOpacity style={styles.filePicker} onPress={pickDocument}>
                                    <Ionicons name="cloud-upload-outline" size={24} color="#212c6b" />
                                    <Text style={styles.filePickerText}>
                                        {sendFileName ? sendFileName : 'Tap to select a file'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={[styles.submitButton, sending && styles.disabledButton]}
                                onPress={handleSendDocument}
                                disabled={sending}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Send Document</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Submit Violation Modal */}
            <Modal visible={showViolationModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Report Violation</Text>
                            <TouchableOpacity onPress={() => setShowViolationModal(false)}>
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Violation Type</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={selectedTypeId}
                                        onValueChange={(value) => setSelectedTypeId(value)}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Select a type" value={null} />
                                        {violationTypes.map((t) => (
                                            <Picker.Item key={t.id} label={`${t.name} (${t.severity})`} value={t.id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Employee Number *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Enter employee number"
                                    value={targetEmpno}
                                    onChangeText={setTargetEmpno}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Description *</Text>
                                <TextInput
                                    style={[styles.formInput, styles.textArea]}
                                    placeholder="Describe the violation..."
                                    value={violationDescription}
                                    onChangeText={setViolationDescription}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Location</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Where did this occur?"
                                    value={violationLocation}
                                    onChangeText={setViolationLocation}
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Evidence</Text>
                                <View style={styles.evidenceRow}>
                                    <TouchableOpacity style={styles.evidenceButton} onPress={takePhoto}>
                                        <Ionicons name="camera-outline" size={20} color="#212c6b" />
                                        <Text style={styles.evidenceButtonText}>Camera</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.evidenceButton} onPress={pickEvidence}>
                                        <Ionicons name="image-outline" size={20} color="#212c6b" />
                                        <Text style={styles.evidenceButtonText}>Gallery</Text>
                                    </TouchableOpacity>
                                    {evidenceUri && (
                                        <View style={styles.evidencePreview}>
                                            <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                                            <Text style={styles.evidencePreviewText}>Photo selected</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.submitButton, submitting && styles.disabledButton]}
                                onPress={handleSubmitViolation}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Submit Violation</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Review Violation Modal */}
            <Modal visible={showReviewModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Review Violation</Text>
                            <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {selectedViolation && (
                                <>
                                    <View style={styles.reviewInfoCard}>
                                        <Text style={styles.reviewInfoLabel}>Employee</Text>
                                        <Text style={styles.reviewInfoValue}>
                                            {selectedViolation.empno} - {selectedViolation.employee_name}
                                        </Text>
                                        <Text style={styles.reviewInfoLabel}>Description</Text>
                                        <Text style={styles.reviewInfoValue}>{selectedViolation.description}</Text>
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Action *</Text>
                                        <View style={styles.reviewActionRow}>
                                            <TouchableOpacity
                                                style={[styles.reviewActionButton, reviewAction === 'approve' && styles.reviewActionApprove]}
                                                onPress={() => setReviewAction('approve')}
                                            >
                                                <Ionicons name="checkmark-circle" size={20} color={reviewAction === 'approve' ? '#fff' : '#28a745'} />
                                                <Text style={[styles.reviewActionText, reviewAction === 'approve' && styles.reviewActionTextActive]}>Approve</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.reviewActionButton, reviewAction === 'reject' && styles.reviewActionReject]}
                                                onPress={() => setReviewAction('reject')}
                                            >
                                                <Ionicons name="close-circle" size={20} color={reviewAction === 'reject' ? '#fff' : '#dc3545'} />
                                                <Text style={[styles.reviewActionText, reviewAction === 'reject' && styles.reviewActionTextActive]}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {reviewAction === 'approve' && (
                                        <View style={styles.formGroup}>
                                            <Text style={styles.formLabel}>Penalty</Text>
                                            <TextInput
                                                style={styles.formInput}
                                                placeholder="Enter penalty (e.g., Warning Letter)"
                                                value={reviewPenalty}
                                                onChangeText={setReviewPenalty}
                                            />
                                        </View>
                                    )}
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Review Remarks *</Text>
                                        <TextInput
                                            style={[styles.formInput, styles.textArea]}
                                            placeholder="Add your review remarks..."
                                            value={reviewRemarks}
                                            onChangeText={setReviewRemarks}
                                            multiline
                                            numberOfLines={3}
                                            textAlignVertical="top"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.submitButton, reviewing && styles.disabledButton]}
                                        onPress={handleSubmitReview}
                                        disabled={reviewing}
                                    >
                                        {reviewing ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.submitButtonText}>Submit Review</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
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
    headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#fff', marginHorizontal: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    shiftChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    shiftChip: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
    shiftChipText: { fontSize: 12, color: '#4338CA', fontWeight: '600' },
    roleHeaderBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    supervisorHeaderBadge: { backgroundColor: 'rgba(255,255,255,0.25)' },
    employeeHeaderBadge: { backgroundColor: 'rgba(40,167,69,0.3)' },
    roleHeaderBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    tabBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -18,
        marginBottom: 16,
        borderRadius: 16,
        padding: 5,
        gap: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    tabBarItem: {
        // Inactive tabs stay a fixed, compact icon-only size; the active tab
        // (via tabBarItemActive) flexes to soak up the freed-up space for its label.
        flexGrow: 0,
        flexShrink: 0,
        width: 42,
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 12,
    },
    tabBarItemActive: {
        flexGrow: 1,
        flexShrink: 1,
        width: undefined,
        paddingHorizontal: 12,
        backgroundColor: '#212c6b',
    },
    tabIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    tabDot: {
        position: 'absolute',
        top: -2,
        right: -3,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#dc3545',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    tabBarLabel: { fontSize: 12, fontWeight: '600', color: '#6c757d' },
    tabBarLabelActive: { fontSize: 12, fontWeight: '600', color: '#fff', flexShrink: 1 },
    tabBarBadge: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBarBadgeText: { fontSize: 10, fontWeight: '700', color: '#212c6b' },

    section: { marginHorizontal: 16, marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40' },
    sectionCount: { fontSize: 14, color: '#6c757d', backgroundColor: '#e9ecef', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    sectionActions: { flexDirection: 'row', alignItems: 'center' },
    addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#e8f0fe' },
    addButtonText: { color: '#212c6b', fontSize: 13, fontWeight: '600' },

    // Attendance styles
    attendanceButtonRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    checkInButton: { flex: 1, backgroundColor: '#28a745', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    checkOutButton: { flex: 1, backgroundColor: '#dc3545', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    attendanceButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    disabledButton: { opacity: 0.6 },
    checkInInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#d4edda', padding: 10, borderRadius: 8, marginBottom: 12 },
    checkInInfoText: { fontSize: 14, color: '#28a745', fontWeight: '500' },

    attendanceStatusContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkedInBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d4edda', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    checkedInText: { fontSize: 12, color: '#28a745', fontWeight: '600' },
    checkedOutBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e9ecef', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    checkedOutText: { fontSize: 12, color: '#6c757d', fontWeight: '600' },
    otherProjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff4e6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    otherProjectText: { fontSize: 12, color: '#ff7a1a', fontWeight: '600' },
    pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#fff4e6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    pendingBadgeText: { fontSize: 12, color: '#ff7a1a', fontWeight: '700' },

    warningInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff4e6', padding: 10, borderRadius: 8, marginBottom: 12 },
    warningInfoText: { fontSize: 14, color: '#ff7a1a', fontWeight: '500', flex: 1 },

    attendanceHistory: { marginTop: 8 },
    attendanceHistoryTitle: { fontSize: 14, fontWeight: '600', color: '#6c757d', marginBottom: 8 },
    attendanceRecordCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    attendanceRecordLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    attendanceRecordDate: { fontSize: 13, fontWeight: '600', color: '#343a40', minWidth: 80 },
    attendanceRecordTimes: { gap: 2 },
    attendanceTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    attendanceTimeText: { fontSize: 12, color: '#6c757d' },
    attendanceRecordRight: { alignItems: 'flex-end' },
    attendanceStatusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    attendanceStatusText: { fontSize: 11, fontWeight: '600' },

    employeeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    employeeAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#212c6b',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    employeeAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    employeeInfo: { flex: 1 },
    employeeName: { fontSize: 16, fontWeight: '600', color: '#343a40' },
    employeeId: { fontSize: 12, color: '#6c757d' },
    employeeRole: { fontSize: 12, color: '#212c6b', fontWeight: '500' },

    violationCard: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    violationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    violationEmpno: { fontSize: 14, fontWeight: '600', color: '#343a40' },
    violationType: { fontSize: 13, color: '#212c6b', fontWeight: '500' },
    violationDesc: { fontSize: 13, color: '#6c757d', marginTop: 2 },
    violationDate: { fontSize: 11, color: '#adb5bd', marginTop: 4 },
    penaltyText: { fontSize: 12, color: '#dc3545', fontWeight: '600', marginTop: 2 },

    docCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    docIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    docInfo: { flex: 1 },
    docTitle: { fontSize: 14, fontWeight: '500', color: '#343a40' },
    docMeta: { fontSize: 12, color: '#6c757d' },
    docDate: { fontSize: 11, color: '#adb5bd' },
    docActions: { alignItems: 'flex-end', gap: 4 },
    docStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    docStatusText: { fontSize: 10, fontWeight: '700' },
    docActionBtn: { padding: 4 },
    acknowledgeBtn: { backgroundColor: '#d4edda', borderRadius: 12, padding: 4 },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '700' },

    reviewButton: {
        marginTop: 8,
        backgroundColor: '#212c6b',
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
    },
    reviewButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    filterScroll: { flexDirection: 'row', marginBottom: 12 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e9ecef', marginRight: 8 },
    filterChipActive: { backgroundColor: '#212c6b' },
    filterChipText: { fontSize: 12, color: '#6c757d', fontWeight: '500' },
    filterChipTextActive: { color: '#fff' },

    emptyText: { textAlign: 'center', color: '#6c757d', padding: 20 },

    // Camera styles
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 55, backgroundColor: 'rgba(0,0,0,0.5)' },
    cameraTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    closeButton: { padding: 5 },
    camera: { flex: 1, width: '100%' },
    faceFrameContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
    faceFrame: { width: Dimensions.get('window').width * 0.7, height: Dimensions.get('window').width * 0.7, borderRadius: Dimensions.get('window').width * 0.35, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
    faceFrameText: { color: '#fff', fontSize: 14, textAlign: 'center', position: 'absolute', bottom: -30, width: 200 },
    cameraFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 30, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    cameraInstruction: { color: '#fff', fontSize: 14, marginBottom: 20, textAlign: 'center' },
    captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    captureInnerButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#212c6b' },

    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { backgroundColor: '#fff', borderRadius: 24, width: '92%', maxHeight: '85%', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#343a40' },
    modalBody: { padding: 20 },

    formGroup: { marginBottom: 16 },
    formLabel: { fontSize: 14, fontWeight: '600', color: '#343a40', marginBottom: 6 },
    formInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 10, padding: 12, fontSize: 14, color: '#343a40' },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    pickerWrapper: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 10, overflow: 'hidden' },
    picker: { height: 48, color: '#343a40' },

    filePicker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 10, padding: 16, borderStyle: 'dashed' },
    filePickerText: { color: '#212c6b', fontSize: 14, flex: 1 },

    submitButton: { backgroundColor: '#212c6b', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    // REMOVED DUPLICATE disabledButton - using the one defined above

    evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    evidenceButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0fe', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    evidenceButtonText: { color: '#212c6b', fontSize: 14, fontWeight: '500' },
    evidencePreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    evidencePreviewText: { fontSize: 13, color: '#28a745' },

    reviewInfoCard: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 16, gap: 4 },
    reviewInfoLabel: { fontSize: 11, color: '#6c757d', fontWeight: '600', marginTop: 4 },
    reviewInfoValue: { fontSize: 14, color: '#343a40' },
    reviewActionRow: { flexDirection: 'row', gap: 12 },
    reviewActionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e9ecef', backgroundColor: '#fff' },
    reviewActionApprove: { backgroundColor: '#28a745', borderColor: '#28a745' },
    reviewActionReject: { backgroundColor: '#dc3545', borderColor: '#dc3545' },
    reviewActionText: { fontSize: 14, fontWeight: '600', color: '#6c757d' },
    reviewActionTextActive: { color: '#fff' },

    profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#212c6b', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
    profileAvatarText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
    profileName: { fontSize: 22, fontWeight: 'bold', color: '#343a40', textAlign: 'center' },
    profileEmpno: { fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 16 },
    profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
    profileLabel: { fontSize: 14, color: '#6c757d' },
    profileValue: { fontSize: 14, color: '#343a40', fontWeight: '500' },

    // Shift Picker Modal Styles
    shiftModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    shiftModalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%' },
    shiftModalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    shiftOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    shiftOptionText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
    shiftOptionTime: { fontSize: 12, color: '#64748B', marginTop: 2 },
    shiftModalCancel: { marginTop: 12, alignItems: 'center' },

    // Shift Tag Style for Attendance History (Added so your app doesn't crash from missing style)
    shiftTag: { fontSize: 11, color: '#4338CA', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4, marginBottom: 4, alignSelf: 'flex-start', overflow: 'hidden' },
    shiftListContainer: { marginBottom: 12 },
    shiftListLabel: { fontSize: 13, fontWeight: '700', color: '#495057', marginBottom: 8 },
    shiftListRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f8f9fa', borderRadius: 10, padding: 10, marginBottom: 8,
        borderWidth: 1.5, borderColor: 'transparent',
    },
    shiftListRowActive: { borderColor: '#28a745', backgroundColor: '#eafaf0' },
    shiftListRowDisabled: { opacity: 0.4 },
    shiftListTimeTextDisabled: { color: '#adb5bd' },
    shiftListTimeBox: {
        backgroundColor: '#e9ecef', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginRight: 10,
    },
    shiftListTimeText: { fontSize: 14, fontWeight: '600', color: '#212529' },
    // ADD to styles
    activeShiftBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#e9f9ee', borderRadius: 10, padding: 10, marginBottom: 10,
    },
    activeShiftBannerText: { fontSize: 12.5, color: '#1e7e34', fontWeight: '600' },
});

export default ProjectDetailScreen;