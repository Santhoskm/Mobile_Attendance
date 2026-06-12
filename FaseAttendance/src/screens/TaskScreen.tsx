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
    Modal,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, Project } from '../services/api';
import * as Location from 'expo-location';

interface UserData {
    user_id?: number;
    username?: string;
    empid?: string;
    position?: string;
    department?: string;
}

const TaskScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [checkInNotes, setCheckInNotes] = useState('');
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [checkedInProjects, setCheckedInProjects] = useState<number[]>([]);
    const [locationPermission, setLocationPermission] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        loadUserData();
        requestLocationPermission();
        loadCheckedInProjects();
    }, []);

    useEffect(() => {
        if (userData?.empid) {
            loadProjects();
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

    const loadCheckedInProjects = async () => {
        try {
            const checkedIn = await AsyncStorage.getItem('checkedInProjects');
            if (checkedIn) {
                setCheckedInProjects(JSON.parse(checkedIn));
            }
        } catch (error) {
            console.log('Error loading checked-in projects:', error);
        }
    };

    const saveCheckedInProjects = async (projectIds: number[]) => {
        try {
            await AsyncStorage.setItem('checkedInProjects', JSON.stringify(projectIds));
            setCheckedInProjects(projectIds);
        } catch (error) {
            console.log('Error saving checked-in projects:', error);
        }
    };

    const loadProjects = async () => {
        setIsLoading(true);
        try {
            const response = await apiService.getProjects(userData?.empid);
            console.log('Projects response:', response);

            let projectsList: Project[] = [];
            if (response.data && Array.isArray(response.data)) {
                projectsList = response.data;
            } else if (response.projects && Array.isArray(response.projects)) {
                projectsList = response.projects;
            } else if (Array.isArray(response)) {
                projectsList = response;
            }

            // Add priority if not present in API response
            projectsList = projectsList.map(project => ({
                ...project,
                priority: project.priority || determinePriority(project),
                status: project.status || 'active'
            }));

            setProjects(projectsList);
        } catch (error: any) {
            console.log('Error loading projects:', error);
            let errorMessage = 'Failed to load projects';
            if (error.message === 'Network Error') {
                errorMessage = 'Cannot connect to server. Please check your internet connection.';
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const determinePriority = (project: Project): 'high' | 'medium' | 'low' => {
        return 'medium';
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProjects();
        await loadCheckedInProjects();
        setRefreshing(false);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return '#dc3545';
            case 'medium':
                return '#ffc107';
            case 'low':
                return '#28a745';
            default:
                return '#6c757d';
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'alert-circle';
            case 'medium':
                return 'time';
            case 'low':
                return 'checkbox-outline';
            default:
                return 'information-circle';
        }
    };

    const getProjectName = (project: Project) => {
        return project.projectname || project.name || 'NAN';
    };

    const handleProjectPress = (project: Project) => {
        navigation.navigate('Dashboard', {
            selectedProject: project,
            projectId: project.id,
            projectName: getProjectName(project),
        });
    };

    const handleCheckIn = async () => {
        if (!selectedProject) return;
        if (!userData?.empid) {
            Alert.alert('Error', 'Employee ID not found. Please login again.');
            return;
        }

        if (!locationPermission) {
            Alert.alert(
                'Location Required',
                'Location permission is needed to check into projects.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Enable', onPress: requestLocationPermission }
                ]
            );
            return;
        }

        setIsCheckingIn(true);

        try {
            let location = currentLocation;
            if (!location && locationPermission) {
                const newLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                location = {
                    latitude: newLocation.coords.latitude,
                    longitude: newLocation.coords.longitude,
                };
            }

            const response = await apiService.checkInToProject(
                selectedProject.id,
                userData.empid,
                location || undefined
            );

            if (response.status === true) {
                const updatedCheckedIn = [...checkedInProjects, selectedProject.id];
                await saveCheckedInProjects(updatedCheckedIn);

                Alert.alert(
                    'Success',
                    response.message || `Successfully checked into ${selectedProject.projectname}!`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setShowCheckInModal(false);
                                setCheckInNotes('');
                                setSelectedProject(null);
                                loadProjects();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Check-in Failed', response.message || 'Failed to check into project.');
            }
        } catch (error: any) {
            console.log('Check-in error:', error);
            let errorMessage = 'Failed to check into project. Please try again.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message === 'Network Error') {
                errorMessage = 'Cannot connect to server. Please check your internet connection.';
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setIsCheckingIn(false);
        }
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

    const getProjectStats = () => {
        const total = projects.length;
        const inProgress = checkedInProjects.length;
        return { total, inProgress };
    };

    const stats = getProjectStats();

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

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
                <View style={[styles.statCard, styles.totalCard]}>
                    <Ionicons name="folder-outline" size={28} color="#fff" />
                    <Text style={styles.statNumber}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Total Projects</Text>
                </View>
                <View style={[styles.statCard, styles.progressCard]}>
                    <Ionicons name="play-circle-outline" size={28} color="#fff" />
                    <Text style={styles.statNumber}>{stats.inProgress}</Text>
                    <Text style={styles.statLabel}>In Progress</Text>
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
                        <Text style={styles.emptyText}>You don't have any projects yet.</Text>
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
                        const isCheckedIn = checkedInProjects.includes(project.id);

                        return (
                            <TouchableOpacity
                                key={project.id}
                                style={[
                                    styles.projectCard,
                                    isCheckedIn && styles.checkedInCard
                                ]}
                                onPress={() => handleProjectPress(project)}
                            >
                                <View style={styles.projectHeader}>
                                    <View style={styles.projectTitleContainer}>
                                        <View style={[
                                            styles.priorityIndicator,
                                            { backgroundColor: getPriorityColor(project.priority || 'medium') }
                                        ]} />
                                        <Text style={styles.projectTitle}>{project.projectname}</Text>
                                    </View>
                                </View>

                                <Text style={styles.projectDescription} numberOfLines={2}>
                                    {project.description || 'No description available'}
                                </Text>

                                <View style={styles.projectFooter}>
                                    <View style={styles.priorityContainer}>
                                        <Ionicons
                                            name={getPriorityIcon(project.priority || 'medium')}
                                            size={16}
                                            color={getPriorityColor(project.priority || 'medium')}
                                        />
                                        <Text style={[
                                            styles.priorityText,
                                            { color: getPriorityColor(project.priority || 'medium') }
                                        ]}>
                                            {(project.priority || 'MEDIUM').toUpperCase()} Priority
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.actionButton}>
                                    <Text style={styles.actionText}>
                                        {isCheckedIn ? 'Tap to view progress →' : 'Tap to check in →'}
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

                <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => navigation.navigate('Profile')}
                >
                    <Ionicons name="person-outline" size={28} color="#007bff" />
                    <Text style={styles.quickActionText}>My Profile</Text>
                    <Text style={styles.quickActionSubtext}>View & Edit</Text>
                </TouchableOpacity>
            </View>

            {/* Check-in Modal */}
            <Modal
                visible={showCheckInModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCheckInModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Check In to Project</Text>
                            <TouchableOpacity
                                onPress={() => setShowCheckInModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalContent}>
                            <View style={styles.projectInfoCard}>
                                <Ionicons name="folder-outline" size={32} color="#007bff" />
                                <View style={styles.projectInfoText}>
                                    <Text style={styles.projectInfoName}>{selectedProject?.name}</Text>
                                    <Text style={styles.projectInfoDept}>
                                        {selectedProject?.department || 'General'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.locationStatus}>
                                <Ionicons
                                    name={locationPermission ? "location" : "location-outline"}
                                    size={24}
                                    color={locationPermission ? "#28a745" : "#dc3545"}
                                />
                                <Text style={[styles.locationText, locationPermission && styles.locationActive]}>
                                    {locationPermission ? "Location access granted" : "Location access required"}
                                </Text>
                            </View>

                            <TextInput
                                style={styles.notesInput}
                                placeholder="Add notes (optional)"
                                placeholderTextColor="#6c757d"
                                value={checkInNotes}
                                onChangeText={setCheckInNotes}
                                multiline
                                numberOfLines={3}
                            />

                            <TouchableOpacity
                                style={[styles.checkInModalButton, isCheckingIn && styles.disabledButton]}
                                onPress={handleCheckIn}
                                disabled={isCheckingIn}
                            >
                                {isCheckingIn ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="log-in-outline" size={24} color="#fff" />
                                        <Text style={styles.checkInModalButtonText}>Confirm Check In</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginTop: -30,
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
    checkedInCard: {
        backgroundColor: '#e8f5e9',
        borderLeftWidth: 4,
        borderLeftColor: '#28a745',
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
    priorityIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    projectTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#343a40',
        flex: 1,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 25,
        width: '90%',
        maxHeight: '80%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#343a40',
    },
    modalCloseButton: {
        padding: 5,
    },
    modalContent: {
        padding: 20,
    },
    projectInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 15,
        marginBottom: 20,
        gap: 15,
    },
    projectInfoText: {
        flex: 1,
    },
    projectInfoName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
    },
    projectInfoDept: {
        fontSize: 14,
        color: '#6c757d',
        marginTop: 2,
    },
    locationStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        gap: 10,
    },
    locationText: {
        flex: 1,
        fontSize: 14,
        color: '#dc3545',
    },
    locationActive: {
        color: '#28a745',
    },
    notesInput: {
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: '#343a40',
        textAlignVertical: 'top',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    checkInModalButton: {
        backgroundColor: '#28a745',
        padding: 16,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    checkInModalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#6c757d',
        opacity: 0.6,
    },
});

export default TaskScreen;