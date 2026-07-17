// ViolationsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Modal,
    TextInput,
    ScrollView,
    Alert,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

interface ViolationType {
    id: number;
    name: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    description: string;
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

interface Project {
    project_id: number;
    project_name: string;
    role?: string;
}

const ViolationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [violations, setViolations] = useState<Violation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'Pending' | 'Reviewed' | 'Rejected'>('all');
    const [userData, setUserData] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Submit violation state
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
    const [targetEmpno, setTargetEmpno] = useState('');
    const [violationDescription, setViolationDescription] = useState('');
    const [violationLocation, setViolationLocation] = useState('');
    const [violationDate, setViolationDate] = useState(new Date().toISOString().split('T')[0]);
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
    }, []);

    useEffect(() => {
        if (userData?.empid) {
            loadProjects();
            loadViolationTypes();
        }
    }, [userData]);

    useEffect(() => {
        if (userData?.empid) {
            loadViolations();
        }
    }, [userData, selectedProjectId, projects]);

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

    const loadProjects = async () => {
        try {
            const response = await apiService.getMyProjects(userData?.empid);
            if (response.status && response.projects) {
                setProjects(response.projects);
                if (response.projects.length > 0 && !selectedProjectId) {
                    setSelectedProjectId('');
                }
            }
        } catch (error) {
            console.log('Error loading projects:', error);
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

    // const loadViolations = async () => {
    //     setLoading(true);
    //     try {
    //         const projectId = selectedProjectId || undefined;
    //         const response = await apiService.getViolations(userData?.empid, projectId);
    //         if (response.status && response.violations) {
    //             setViolations(response.violations);
    //         } else {
    //             setViolations([]);
    //         }
    //     } catch (error) {
    //         console.log('Error loading violations:', error);
    //         setViolations([]);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const loadViolations = async () => {
        setLoading(true);

        try {
            let allViolations: Violation[] = [];

            if (selectedProjectId) {
                const response = await apiService.getViolations(userData?.empid, selectedProjectId);
                allViolations = response.violations || [];
            } else {
                const responses = await Promise.all(
                    projects.map(p =>
                        apiService.getViolations(userData?.empid, String(p.project_id))
                    )
                );

                allViolations = responses.flatMap(res => res.violations || []);
            }

            setViolations(allViolations);
        } catch (error) {
            console.log('Error loading violations:', error);
            setViolations([]);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadViolations();
        setRefreshing(false);
    };

    const filtered = violations.filter(v => {
        if (filter === 'all') return true;
        return v.status === filter;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return '#ff7a1a';
            case 'Reviewed': return '#28a745';
            case 'Rejected': return '#dc3545';
            default: return '#6c757d';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'Pending': return '#fff4e6';
            case 'Reviewed': return '#d4edda';
            case 'Rejected': return '#fdecea';
            default: return '#e9ecef';
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return '#dc3545';
            case 'High': return '#ff7a1a';
            case 'Medium': return '#ffc107';
            case 'Low': return '#28a745';
            default: return '#6c757d';
        }
    };

    const pickEvidence = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant gallery access to upload evidence.');
            return;
        }

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
            Alert.alert('Permission Required', 'Please grant camera access to take evidence photos.');
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

    const handleSubmitViolation = async () => {
        if (!selectedProjectId) {
            Alert.alert('Error', 'Please select a project.');
            return;
        }
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
            formData.append('project_id', selectedProjectId);
            formData.append('empno', targetEmpno.trim());
            formData.append('raised_by_empno', userData?.empno || userData?.empid || '');
            formData.append('description', violationDescription.trim());
            if (violationLocation.trim()) {
                formData.append('location', violationLocation.trim());
            }
            if (selectedTypeId) {
                formData.append('violation_type_id', String(selectedTypeId));
            }
            if (violationDate) {
                formData.append('violation_date', violationDate);
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
                setShowSubmitModal(false);
                resetSubmitForm();
                loadViolations();
            } else {
                Alert.alert('Error', response.message || 'Failed to submit violation.');
            }
        } catch (error: any) {
            console.log('Submit violation error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to submit violation. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetSubmitForm = () => {
        setSelectedTypeId(null);
        setTargetEmpno('');
        setViolationDescription('');
        setViolationLocation('');
        setViolationDate(new Date().toISOString().split('T')[0]);
        setEvidenceUri(null);
    };

    const handleReview = (violation: Violation) => {
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
            console.log('Review violation error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to review violation.');
        } finally {
            setReviewing(false);
        }
    };

    const renderViolationItem = ({ item }: { item: Violation }) => {
        const isPending = item.status === 'Pending';
        const isSupervisor = projects.some(p => p.project_id === item.project_id && p.role === 'Supervisor');

        return (
            <View style={[styles.card, !isPending && styles.cardDimmed]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <Text style={styles.projectName}>{item.project_name}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.violationType}>
                        {item.violation_type || 'General Violation'}
                    </Text>
                    <Text style={styles.description} numberOfLines={2}>
                        {item.description}
                    </Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>👤 {item.empno} - {item.employee_name}</Text>
                    </View>
                    {item.location && (
                        <View style={styles.metaRow}>
                            <Ionicons name="location-outline" size={12} color="#6c757d" />
                            <Text style={styles.metaText}>{item.location}</Text>
                        </View>
                    )}
                    {item.penalty && (
                        <View style={styles.metaRow}>
                            <Ionicons name="warning-outline" size={12} color="#ff7a1a" />
                            <Text style={[styles.metaText, styles.penaltyText]}>Penalty: {item.penalty}</Text>
                        </View>
                    )}
                    <Text style={styles.timestamp}>
                        {new Date(item.violation_date).toLocaleDateString()} • Raised by: {item.raised_by_empno}
                    </Text>
                </View>

                {isPending && isSupervisor && (
                    <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => handleReview(item)}
                    >
                        <Text style={styles.reviewButtonText}>Review</Text>
                        <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                )}

                {item.review_remarks && (
                    <View style={styles.reviewRemarks}>
                        <Text style={styles.reviewRemarksLabel}>Review Remarks:</Text>
                        <Text style={styles.reviewRemarksText}>{item.review_remarks}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={26} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { flex: 1, marginLeft: 12 }]}>Violations</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowSubmitModal(true)}
                >
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Project Filter */}
            <View style={styles.filterContainer}>
                <View style={styles.projectPickerWrapper}>
                    <Picker
                        selectedValue={selectedProjectId}
                        onValueChange={(value) => setSelectedProjectId(value)}
                        style={styles.projectPicker}
                        dropdownIconColor="#007bff"
                    >
                        <Picker.Item label="All Projects" value="" />
                        {projects.map((p) => (
                            <Picker.Item key={p.project_id} label={p.project_name} value={String(p.project_id)} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* Status Filters */}
            <View style={styles.filterRow}>
                {(['all', 'Pending', 'Reviewed', 'Rejected'] as const).map(f => {
                    const count = violations.filter(v => f === 'all' ? true : v.status === f).length;
                    return (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterTab, filter === f && styles.filterTabActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                                {f === 'all' ? `All (${violations.length})` : `${f} (${count})`}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={18} color="#007bff" />
                <Text style={styles.infoText}>
                    Violations are logged when your location doesn't match the project site or face verification fails. Your supervisor can review these.
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#007bff" />
            ) : filtered.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="shield-checkmark-outline" size={64} color="#d4edda" />
                    <Text style={styles.emptyTitle}>
                        {filter === 'all' ? 'No violations found' :
                            filter === 'Pending' ? 'No pending violations' :
                                'No reviewed violations'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {filter === 'all'
                            ? 'Your attendance records look clean.'
                            : filter === 'Pending'
                                ? 'All violations have been reviewed.'
                                : 'No violations have been reviewed yet.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderViolationItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Submit Violation Modal */}
            <Modal
                visible={showSubmitModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSubmitModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Report Violation</Text>
                            <TouchableOpacity onPress={() => setShowSubmitModal(false)}>
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Project Select */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Project *</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={selectedProjectId}
                                        onValueChange={(value) => setSelectedProjectId(value)}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Select a project" value="" />
                                        {projects.map((p) => (
                                            <Picker.Item key={p.project_id} label={p.project_name} value={String(p.project_id)} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            {/* Violation Type */}
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

                            {/* Target Employee */}
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

                            {/* Description */}
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

                            {/* Location */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Location</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Where did this occur?"
                                    value={violationLocation}
                                    onChangeText={setViolationLocation}
                                />
                            </View>

                            {/* Date */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Date</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="YYYY-MM-DD"
                                    value={violationDate}
                                    onChangeText={setViolationDate}
                                />
                            </View>

                            {/* Evidence */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Evidence (Optional)</Text>
                                <View style={styles.evidenceRow}>
                                    <TouchableOpacity style={styles.evidenceButton} onPress={takePhoto}>
                                        <Ionicons name="camera-outline" size={20} color="#007bff" />
                                        <Text style={styles.evidenceButtonText}>Camera</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.evidenceButton} onPress={pickEvidence}>
                                        <Ionicons name="image-outline" size={20} color="#007bff" />
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
            <Modal
                visible={showReviewModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowReviewModal(false)}
            >
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
                                        <Text style={styles.reviewInfoLabel}>Project</Text>
                                        <Text style={styles.reviewInfoValue}>{selectedViolation.project_name}</Text>
                                        <Text style={styles.reviewInfoLabel}>Description</Text>
                                        <Text style={styles.reviewInfoValue}>{selectedViolation.description}</Text>
                                        {selectedViolation.location && (
                                            <>
                                                <Text style={styles.reviewInfoLabel}>Location</Text>
                                                <Text style={styles.reviewInfoValue}>{selectedViolation.location}</Text>
                                            </>
                                        )}
                                    </View>

                                    {/* Action */}
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Action *</Text>
                                        <View style={styles.reviewActionRow}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.reviewActionButton,
                                                    reviewAction === 'approve' && styles.reviewActionApprove,
                                                ]}
                                                onPress={() => setReviewAction('approve')}
                                            >
                                                <Ionicons name="checkmark-circle" size={20} color={reviewAction === 'approve' ? '#fff' : '#28a745'} />
                                                <Text style={[
                                                    styles.reviewActionText,
                                                    reviewAction === 'approve' && styles.reviewActionTextActive,
                                                ]}>Approve</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    styles.reviewActionButton,
                                                    reviewAction === 'reject' && styles.reviewActionReject,
                                                ]}
                                                onPress={() => setReviewAction('reject')}
                                            >
                                                <Ionicons name="close-circle" size={20} color={reviewAction === 'reject' ? '#fff' : '#dc3545'} />
                                                <Text style={[
                                                    styles.reviewActionText,
                                                    reviewAction === 'reject' && styles.reviewActionTextActive,
                                                ]}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Penalty (only for approve) */}
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

                                    {/* Remarks */}
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
        backgroundColor: '#007bff',
        paddingTop: 55,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    backButton: { padding: 5 },
    addButton: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },

    filterContainer: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
    },
    projectPickerWrapper: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
        overflow: 'hidden',
    },

    projectPicker: {
        height: 56,
        color: '#343a40',
        width: '100%',
    },

    filterRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#e9ecef',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    filterTabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    filterTabText: { fontSize: 12, color: '#6c757d', fontWeight: '600' },
    filterTabTextActive: { color: '#007bff' },

    infoBanner: {
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#e8f0fe',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    infoText: { flex: 1, fontSize: 12, color: '#1a56db', lineHeight: 18 },

    list: { padding: 16, paddingTop: 4 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardDimmed: { opacity: 0.7 },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardHeaderLeft: { flex: 1 },
    projectName: { fontSize: 16, fontWeight: 'bold', color: '#343a40' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: '700' },
    cardBody: { gap: 4 },
    violationType: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
    description: { fontSize: 13, color: '#6c757d', lineHeight: 18 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: '#6c757d' },
    penaltyText: { color: '#dc3545', fontWeight: '600' },
    timestamp: { fontSize: 11, color: '#adb5bd', marginTop: 4 },

    reviewButton: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007bff',
        paddingVertical: 8,
        borderRadius: 10,
        gap: 4,
    },
    reviewButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    reviewRemarks: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f3f5',
        gap: 2,
    },
    reviewRemarksLabel: { fontSize: 11, color: '#6c757d', fontWeight: '600' },
    reviewRemarksText: { fontSize: 12, color: '#343a40' },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: '#6c757d', marginTop: 8, textAlign: 'center' },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        width: '92%',
        maxHeight: '85%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#343a40' },
    modalBody: { padding: 20 },

    formGroup: { marginBottom: 16 },
    formLabel: { fontSize: 14, fontWeight: '600', color: '#343a40', marginBottom: 6 },
    formInput: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: '#343a40',
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    pickerWrapper: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 10,
        overflow: 'hidden',
    },
    picker: { height: 48, color: '#343a40' },

    evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    evidenceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#e8f0fe',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    evidenceButtonText: { color: '#007bff', fontSize: 14, fontWeight: '500' },
    evidencePreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    evidencePreviewText: { fontSize: 13, color: '#28a745' },

    submitButton: {
        backgroundColor: '#28a745',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    disabledButton: { backgroundColor: '#6c757d', opacity: 0.6 },

    // Review modal specific
    reviewInfoCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 4,
    },
    reviewInfoLabel: { fontSize: 11, color: '#6c757d', fontWeight: '600', marginTop: 4 },
    reviewInfoValue: { fontSize: 14, color: '#343a40' },
    reviewActionRow: { flexDirection: 'row', gap: 12 },
    reviewActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#e9ecef',
        backgroundColor: '#fff',
    },
    reviewActionApprove: { backgroundColor: '#28a745', borderColor: '#28a745' },
    reviewActionReject: { backgroundColor: '#dc3545', borderColor: '#dc3545' },
    reviewActionText: { fontSize: 14, fontWeight: '600', color: '#6c757d' },
    reviewActionTextActive: { color: '#fff' },
});

export default ViolationsScreen;