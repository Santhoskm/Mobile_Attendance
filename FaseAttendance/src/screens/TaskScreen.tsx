// TaskScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import * as Location from 'expo-location';

interface UserData {
    user_id?: number;
    username?: string;
    empid?: string;
    position?: string;
    department?: string;
}

interface AssignedProject {
    id: number;
    projectname: string;
    project_code?: string;
    site_address?: string;
    shift_start?: string;
    shift_end?: string;
    role: 'Supervisor' | 'Employee';
}

interface LastAttendance {
    checkInTime: string | null;
    checkOutTime: string | null;
    checkInDate: string | null;
    checkOutDate: string | null;
    checkInPlace?: string;
    checkOutPlace?: string;
    projectName?: string;
}

const TaskScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [projects, setProjects] = useState<AssignedProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [locationPermission, setLocationPermission] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // State for last attendance
    const [lastAttendance, setLastAttendance] = useState<LastAttendance>({
        checkInTime: null,
        checkOutTime: null,
        checkInDate: null,
        checkOutDate: null,
    });
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    useEffect(() => {
        loadUserData();
        requestLocationPermission();
    }, []);

    useEffect(() => {
        if (userData?.empid) {
            loadProjects();
            loadLastAttendance();
        }
    }, [userData]);

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationPermission(status === 'granted');
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                setCurrentLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            }
        } catch (error) {
            console.log('Location permission error:', error);
        }
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

    // const loadProjects = async () => {
    //     setIsLoading(true);
    //     try {
    //         const empid = userData?.empid;
    //         if (!empid) {
    //             setProjects([]);
    //             setIsLoading(false);
    //             return;
    //         }

    //         const response = await apiService.getMyProjects(empid);
    //         console.log('My Projects response:', response);

    //         if (response.status && response.projects) {
    //             setProjects(response.projects);
    //         } else {
    //             setProjects([]);
    //         }
    //     } catch (error: any) {
    //         console.log('Error loading projects:', error);
    //         let errorMessage = 'Failed to load projects';
    //         if (error.message === 'Network Error') {
    //             errorMessage = 'Cannot connect to server. Please check your internet connection.';
    //         }
    //         Alert.alert('Error', errorMessage);
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };
    // TaskScreen.tsx - Update the loadProjects function

    const loadProjects = async () => {
        setIsLoading(true);
        try {
            const empid = userData?.empid;
            if (!empid) {
                setProjects([]);
                setIsLoading(false);
                return;
            }

            const response = await apiService.getMyProjects(empid);
            console.log('My Projects response:', response);

            if (response.status && response.projects) {
                // Map the response to match the expected format
                const mappedProjects = response.projects.map((p: any) => ({
                    id: p.id || p.project_id,
                    projectname: p.projectname || p.project_name || 'N/A',
                    site_address: p.site_address || p.siteaddress || null,
                    shift_start: p.shift_start || null,
                    shift_end: p.shift_end || null,
                    role: p.role || 'Employee',
                    project_code: p.project_code || p.projectcode || null,
                }));
                setProjects(mappedProjects);
            } else {
                setProjects([]);
            }
        } catch (error: any) {
            console.log('Error loading projects:', error);
            let errorMessage = 'Failed to load projects';
            if (error.message === 'Network Error') {
                errorMessage = 'Cannot connect to server. Please check your internet connection.';
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const loadLastAttendance = async () => {
        const empid = userData?.empid;
        if (!empid) return;

        setLoadingAttendance(true);
        try {
            const response = await apiService.getMyProjectCheckIns(empid);

            if (response.checkins && response.checkins.length > 0) {
                const sortedCheckins = [...response.checkins].sort((a, b) =>
                    new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()
                );

                const latest = sortedCheckins[0];

                setLastAttendance({
                    checkInTime: latest.check_in_time ? formatTimeOnly(latest.check_in_time) : null,
                    checkOutTime: latest.check_out_time ? formatTimeOnly(latest.check_out_time) : null,
                    checkInDate: latest.check_in_time ? formatDateOnly(latest.check_in_time) : null,
                    checkOutDate: latest.check_out_time ? formatDateOnly(latest.check_out_time) : null,
                    checkInPlace: latest.check_in_place || latest.checkin_place,
                    checkOutPlace: latest.check_out_place || latest.checkout_place,
                    projectName: latest.project_name,
                });
            } else {
                setLastAttendance({
                    checkInTime: null,
                    checkOutTime: null,
                    checkInDate: null,
                    checkOutDate: null,
                });
            }
        } catch (error) {
            console.log('Last attendance load error:', error);
            setLastAttendance({
                checkInTime: null,
                checkOutTime: null,
                checkInDate: null,
                checkOutDate: null,
            });
        } finally {
            setLoadingAttendance(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProjects();
        await loadLastAttendance();
        setRefreshing(false);
    };

    const getProjectName = (project: AssignedProject) => {
        return project.projectname || 'NAN';
    };

    const handleProjectPress = (project: AssignedProject) => {
        navigation.navigate('ProjectDetail', {
            projectId: project.id,
            projectName: getProjectName(project),
            userRole: project.role,
            project: project,
        });
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

    // Format helpers
    const formatTimeOnly = (value: string | null) => {
        if (!value) return '--:--';
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateOnly = (value: string | null) => {
        if (!value) return '--';
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString([], {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const isToday = (dateStr: string | null) => {
        if (!dateStr) return false;
        const today = new Date();
        const date = new Date(dateStr);
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const hasCheckInData = lastAttendance.checkInTime !== null;

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header Section */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.welcomeSection}>
                        <Text style={styles.greeting}>{getGreeting()},</Text>
                        <Text style={styles.userName}>{userData?.username || 'Employee'}</Text>
                        <View style={styles.employeeInfo}>
                            <View style={styles.infoBadge}>
                                <Ionicons name="briefcase-outline" size={16} color="#fff" />
                                <Text style={styles.infoText}>EMP: {userData?.empid || 'N/A'}</Text>
                            </View>
                            <View style={styles.infoBadge}>
                                <Ionicons name="business-outline" size={16} color="#fff" />
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
                        <Ionicons name="log-out-outline" size={24} color="#fff" />
                        <Text style={styles.logoutButtonText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Last Attendance Card */}
            <View style={styles.attendanceCard}>
                <View style={styles.attendanceHeader}>
                    <Ionicons name="time-outline" size={22} color="#007bff" />
                    <Text style={styles.attendanceTitle}>Last Attendance</Text>
                    {loadingAttendance ? (
                        <ActivityIndicator size="small" color="#007bff" />
                    ) : (
                        <View style={[
                            styles.statusBadge,
                            hasCheckInData ? styles.statusCheckedIn : styles.statusNotCheckedIn
                        ]}>
                            <Text style={styles.statusBadgeText}>
                                {hasCheckInData ? 'Record Found' : 'No Records'}
                            </Text>
                        </View>
                    )}
                </View>

                {hasCheckInData ? (
                    <>
                        <View style={styles.attendanceRow}>
                            <View style={styles.attendanceItem}>
                                <View style={[styles.attendanceIcon, styles.checkInIcon]}>
                                    <Ionicons name="log-in-outline" size={18} color="#28a745" />
                                </View>
                                <View style={styles.attendanceInfo}>
                                    <Text style={styles.attendanceLabel}>Last Check In</Text>
                                    <Text style={styles.attendanceValue}>
                                        {lastAttendance.checkInTime}
                                    </Text>
                                    <Text style={styles.attendanceDate}>
                                        {lastAttendance.checkInDate}
                                        {isToday(lastAttendance.checkInDate) && (
                                            <Text style={styles.todayBadge}> • Today</Text>
                                        )}
                                    </Text>
                                    {lastAttendance.checkInPlace && (
                                        <Text style={styles.attendancePlace} numberOfLines={1}>
                                            📍 {lastAttendance.checkInPlace}
                                        </Text>
                                    )}
                                    {lastAttendance.projectName && (
                                        <Text style={styles.attendanceProject} numberOfLines={1}>
                                            📁 {lastAttendance.projectName}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.attendanceDivider} />

                            <View style={styles.attendanceItem}>
                                <View style={[styles.attendanceIcon, styles.checkOutIcon]}>
                                    <Ionicons name="log-out-outline" size={18} color="#dc3545" />
                                </View>
                                <View style={styles.attendanceInfo}>
                                    <Text style={styles.attendanceLabel}>Last Check Out</Text>
                                    <Text style={styles.attendanceValue}>
                                        {lastAttendance.checkOutTime || '--:--'}
                                    </Text>
                                    <Text style={styles.attendanceDate}>
                                        {lastAttendance.checkOutDate || '--'}
                                        {lastAttendance.checkOutDate && isToday(lastAttendance.checkOutDate) && (
                                            <Text style={styles.todayBadge}> • Today</Text>
                                        )}
                                    </Text>
                                    {lastAttendance.checkOutPlace && (
                                        <Text style={styles.attendancePlace} numberOfLines={1}>
                                            📍 {lastAttendance.checkOutPlace}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.noAttendanceContainer}>
                        <Ionicons name="calendar-outline" size={48} color="#dee2e6" />
                        <Text style={styles.noAttendanceText}>No attendance records found</Text>
                        <Text style={styles.noAttendanceSubtext}>
                            Your check-in/out history will appear here
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.attendanceHistoryLink}
                    onPress={() => navigation.navigate('AttendanceHistory')}
                >
                    <Text style={styles.attendanceHistoryText}>View Full History</Text>
                    <Ionicons name="chevron-forward" size={16} color="#007bff" />
                </TouchableOpacity>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
                <View style={[styles.statCard, styles.totalCard]}>
                    <Ionicons name="folder-outline" size={28} color="#fff" />
                    <Text style={styles.statNumber}>{projects.length}</Text>
                    <Text style={styles.statLabel}>Assigned Projects</Text>
                </View>
                <View style={[styles.statCard, styles.progressCard]}>
                    <Ionicons name="people-outline" size={28} color="#fff" />
                    <Text style={styles.statNumber}>
                        {projects.filter(p => p.role === 'Supervisor').length}
                    </Text>
                    <Text style={styles.statLabel}>As Supervisor</Text>
                </View>
            </View>

            {/* Projects Section */}
            <View style={styles.projectsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Projects</Text>
                    <Text style={styles.projectCount}>{projects.length} Projects</Text>
                </View>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007bff" />
                        <Text style={styles.loadingText}>Loading projects...</Text>
                    </View>
                ) : projects.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="folder-open-outline" size={80} color="#6c757d" />
                        <Text style={styles.emptyTitle}>No Projects Assigned</Text>
                        <Text style={styles.emptyText}>You haven't been assigned to any projects yet.</Text>
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={onRefresh}
                        >
                            <Text style={styles.refreshButtonText}>Refresh</Text>
                            <Ionicons name="refresh-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    projects.map((project) => {
                        const isSupervisor = project.role === 'Supervisor';

                        return (
                            <TouchableOpacity
                                key={project.id}
                                style={[styles.projectCard, isSupervisor && styles.supervisorCard]}
                                onPress={() => handleProjectPress(project)}
                            >
                                <View style={styles.projectHeader}>
                                    <View style={styles.projectTitleContainer}>
                                        <View style={[styles.roleIndicator, isSupervisor ? styles.supervisorIndicator : styles.employeeIndicator]} />
                                        <Text style={styles.projectTitle}>{project.projectname}</Text>
                                    </View>
                                    <View style={[styles.roleBadge, isSupervisor ? styles.supervisorBadge : styles.employeeBadge]}>
                                        <Text style={styles.roleBadgeText}>
                                            {isSupervisor ? 'Supervisor' : 'Employee'}
                                        </Text>
                                    </View>
                                </View>

                                {project.site_address && (
                                    <Text style={styles.projectDescription} numberOfLines={2}>
                                        📍 {project.site_address}
                                    </Text>
                                )}

                                <View style={styles.projectFooter}>
                                    <View style={styles.priorityContainer}>
                                        <Ionicons
                                            name={isSupervisor ? 'shield-checkmark-outline' : 'person-outline'}
                                            size={16}
                                            color={isSupervisor ? '#007bff' : '#28a745'}
                                        />
                                        <Text style={[styles.priorityText, { color: isSupervisor ? '#007bff' : '#28a745' }]}>
                                            {isSupervisor ? 'Supervisor Access' : 'Employee Access'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.actionButton}>
                                    <Text style={styles.actionText}>
                                        {isSupervisor ? 'Manage Project →' : 'View Project →'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>

            {/* Quick Action Buttons */}
            <View style={styles.quickActions}>
                <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => navigation.navigate('Dashboard')}
                >
                    <Ionicons name="log-in-outline" size={28} color="#28a745" />
                    <Text style={styles.quickActionText}>Mark Attendance</Text>
                    <Text style={styles.quickActionSubtext}>Check In/Out</Text>
                </TouchableOpacity>
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
        paddingTop: 55,
        paddingBottom: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    welcomeSection: {
        flex: 1,
    },
    greeting: {
        color: '#dbeafe',
        fontSize: 14,
        marginBottom: 5,
    },
    userName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    employeeInfo: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 5,
        flexWrap: 'wrap',
    },
    infoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 5,
    },
    infoText: {
        color: '#fff',
        fontSize: 12,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 25,
        gap: 8,
        marginLeft: 10,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    attendanceCard: {
        marginHorizontal: 20,
        marginTop: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    attendanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 10,
    },
    attendanceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#343a40',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusCheckedIn: {
        backgroundColor: '#d4edda',
    },
    statusNotCheckedIn: {
        backgroundColor: '#f8d7da',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#495057',
    },
    attendanceRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    attendanceItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 4,
    },
    attendanceIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkInIcon: {
        backgroundColor: '#d4edda',
    },
    checkOutIcon: {
        backgroundColor: '#f8d7da',
    },
    attendanceInfo: {
        flex: 1,
    },
    attendanceLabel: {
        fontSize: 11,
        color: '#6c757d',
        fontWeight: '500',
    },
    attendanceValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#343a40',
    },
    attendanceDate: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 1,
    },
    todayBadge: {
        color: '#28a745',
        fontWeight: '600',
    },
    attendancePlace: {
        fontSize: 11,
        color: '#6c757d',
        marginTop: 1,
    },
    attendanceProject: {
        fontSize: 11,
        color: '#007bff',
        marginTop: 1,
        fontWeight: '500',
    },
    attendanceDivider: {
        width: 1,
        backgroundColor: '#e9ecef',
        marginHorizontal: 8,
    },
    attendanceHistoryLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f3f5',
        gap: 4,
    },
    attendanceHistoryText: {
        color: '#007bff',
        fontSize: 13,
        fontWeight: '600',
    },
    noAttendanceContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 4,
    },
    noAttendanceText: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
        marginTop: 8,
    },
    noAttendanceSubtext: {
        fontSize: 12,
        color: '#adb5bd',
    },
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 25,
        gap: 12,
    },
    statCard: {
        flex: 1,
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    totalCard: {
        backgroundColor: '#6c757d',
    },
    progressCard: {
        backgroundColor: '#007bff',
    },
    statNumber: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        color: '#e0f2fe',
        fontSize: 12,
        marginTop: 4,
    },
    projectsSection: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#343a40',
    },
    projectCount: {
        fontSize: 14,
        color: '#6c757d',
        backgroundColor: '#e9ecef',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#6c757d',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#fff',
        borderRadius: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#6c757d',
        marginTop: 15,
    },
    emptyText: {
        color: '#6c757d',
        marginTop: 8,
        marginBottom: 20,
        textAlign: 'center',
    },
    refreshButton: {
        flexDirection: 'row',
        backgroundColor: '#007bff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 10,
        alignItems: 'center',
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    projectCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    supervisorCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#007bff',
    },
    projectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    projectTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    roleIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    supervisorIndicator: {
        backgroundColor: '#007bff',
    },
    employeeIndicator: {
        backgroundColor: '#28a745',
    },
    projectTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#343a40',
        flex: 1,
    },
    roleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    supervisorBadge: {
        backgroundColor: '#e8f0fe',
    },
    employeeBadge: {
        backgroundColor: '#d4edda',
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#495057',
    },
    projectDescription: {
        fontSize: 14,
        color: '#6c757d',
        marginBottom: 12,
        lineHeight: 20,
    },
    projectFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    priorityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    priorityText: {
        fontSize: 12,
        fontWeight: '600',
    },
    actionButton: {
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        paddingTop: 10,
        alignItems: 'flex-end',
    },
    actionText: {
        color: '#007bff',
        fontSize: 12,
        fontWeight: '600',
    },
    quickActions: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 30,
        gap: 15,
    },
    quickActionButton: {
        flex: 1,
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
    quickActionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#343a40',
        marginTop: 10,
    },
    quickActionSubtext: {
        fontSize: 11,
        color: '#6c757d',
        marginTop: 4,
    },
});

export default TaskScreen;