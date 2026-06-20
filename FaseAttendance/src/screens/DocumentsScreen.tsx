// DocumentsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    ScrollView,
    SafeAreaView,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { apiService } from '../services/api';
import { Picker } from '@react-native-picker/picker';

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
    related_violation_id: number | null;
    status: 'Sent' | 'Acknowledged';
    acknowledged_at: string | null;
    created_at: string;
}

interface Project {
    id: number;
    projectname: string;
    role?: string;
}

type TabType = 'received' | 'sent';

const DOC_TYPES = [
    'Warning Letter',
    'Show Cause',
    'Contract',
    'Payslip',
    'Medical Certificate',
    'Leave Form',
    'General',
    'Other',
];

const DOC_ICONS: Record<string, string> = {
    'Warning Letter': 'alert-circle',
    'Show Cause': 'document-text',
    Contract: 'document',
    Payslip: 'cash',
    'Medical Certificate': 'medical',
    'Leave Form': 'calendar',
    General: 'document-outline',
    Other: 'ellipsis-horizontal',
};

const DocumentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState<TabType>('received');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Send document state
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendProjectId, setSendProjectId] = useState<string>('');
    const [sendTargetEmpno, setSendTargetEmpno] = useState('');
    const [sendTitle, setSendTitle] = useState('');
    const [sendDocumentType, setSendDocumentType] = useState('General');
    const [sendDescription, setSendDescription] = useState('');
    const [sendFileUri, setSendFileUri] = useState<string | null>(null);
    const [sendFileName, setSendFileName] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadUserData();
    }, []);

    useEffect(() => {
        if (userData?.empid) {
            loadProjects();
        }
    }, [userData]);

    useEffect(() => {
        if (userData?.empid) {
            loadDocuments();
        }
    }, [userData, selectedProjectId, activeTab]);

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
                    setSelectedProjectId(String(response.projects[0].id));
                }
            }
        } catch (error) {
            console.log('Error loading projects:', error);
        }
    };

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const projectId = selectedProjectId || undefined;
            const response = await apiService.getDocuments(userData?.empid, projectId);

            if (response.status && response.documents) {
                // Filter by direction based on active tab
                const filtered = response.documents.filter((d: Document) => {
                    if (activeTab === 'received') {
                        return d.direction === 'SUPERVISOR_TO_EMP';
                    } else {
                        return d.direction === 'EMP_TO_SUPERVISOR';
                    }
                });
                setDocuments(filtered);
            } else {
                setDocuments([]);
            }
        } catch (error) {
            console.log('Error loading documents:', error);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDocuments();
        setRefreshing(false);
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
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

    const handleSendDocument = async () => {
        if (!sendProjectId) {
            Alert.alert('Error', 'Please select a project.');
            return;
        }
        if (activeTab === 'received' && !sendTargetEmpno.trim()) {
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
            formData.append('project_id', sendProjectId);
            formData.append('sender_empno', userData?.empid || '');
            formData.append('title', sendTitle.trim());
            formData.append('document_type', sendDocumentType);
            if (sendDescription.trim()) {
                formData.append('description', sendDescription.trim());
            }
            if (activeTab === 'received') {
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
            Alert.alert('Error', error.response?.data?.message || 'Failed to send document. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const resetSendForm = () => {
        setSendProjectId('');
        setSendTargetEmpno('');
        setSendTitle('');
        setSendDocumentType('General');
        setSendDescription('');
        setSendFileUri(null);
        setSendFileName('');
    };

    const handleAcknowledge = async (documentId: number) => {
        try {
            const response = await apiService.acknowledgeDocument(documentId, userData?.empid || '');
            if (response.status) {
                Alert.alert('Success', 'Document acknowledged.');
                loadDocuments();
            } else {
                Alert.alert('Error', response.message || 'Failed to acknowledge document.');
            }
        } catch (error: any) {
            console.log('Acknowledge error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to acknowledge document.');
        }
    };

    const openFile = async (url: string) => {
        try {
            // Check if it's a full URL or relative path
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

    const getDocumentIcon = (type: string) => {
        return DOC_ICONS[type] || 'document-outline';
    };

    const getStatusColor = (status: string) => {
        return status === 'Acknowledged' ? '#28a745' : '#ff7a1a';
    };

    const getStatusBg = (status: string) => {
        return status === 'Acknowledged' ? '#d4edda' : '#fff4e6';
    };

    const renderDocumentItem = ({ item }: { item: Document }) => {
        const isReceived = item.direction === 'SUPERVISOR_TO_EMP';
        const isPending = item.status === 'Sent';

        return (
            <View style={styles.docCard}>
                <View style={styles.docIconWrap}>
                    <Ionicons
                        name={getDocumentIcon(item.document_type) as any}
                        size={28}
                        color="#007bff"
                    />
                </View>

                <View style={styles.docInfo}>
                    <Text style={styles.docTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.docMeta}>
                        {item.document_type} • {item.project_name}
                    </Text>
                    <Text style={styles.docMeta}>
                        {isReceived ? `From: ${item.sent_by_empno}` : `To: Supervisor`}
                    </Text>
                    <Text style={styles.docDate}>
                        {new Date(item.created_at).toLocaleString()}
                    </Text>
                </View>

                <View style={styles.docActions}>
                    <View style={[styles.docStatusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                        <Text style={[styles.docStatusText, { color: getStatusColor(item.status) }]}>
                            {item.status}
                        </Text>
                    </View>

                    {item.file_url && (
                        <TouchableOpacity
                            style={styles.docActionBtn}
                            onPress={() => openFile(item.file_url)}
                        >
                            <Ionicons name="eye-outline" size={18} color="#007bff" />
                        </TouchableOpacity>
                    )}

                    {isPending && isReceived && (
                        <TouchableOpacity
                            style={[styles.docActionBtn, styles.acknowledgeBtn]}
                            onPress={() => handleAcknowledge(item.id)}
                        >
                            <Ionicons name="checkmark-outline" size={18} color="#28a745" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Documents</Text>
                <TouchableOpacity
                    style={styles.sendButton}
                    onPress={() => setShowSendModal(true)}
                >
                    <Ionicons name="send-outline" size={20} color="#fff" />
                    <Text style={styles.sendButtonText}>Send</Text>
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
                            <Picker.Item key={p.id} label={p.projectname} value={String(p.id)} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'received' && styles.tabActive]}
                    onPress={() => setActiveTab('received')}
                >
                    <Ionicons
                        name="download-outline"
                        size={16}
                        color={activeTab === 'received' ? '#007bff' : '#6c757d'}
                    />
                    <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
                        Received
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
                    onPress={() => setActiveTab('sent')}
                >
                    <Ionicons
                        name="send-outline"
                        size={16}
                        color={activeTab === 'sent' ? '#007bff' : '#6c757d'}
                    />
                    <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
                        Sent
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Info Strip */}
            <View style={styles.infoStrip}>
                <Ionicons name="information-circle-outline" size={14} color="#6c757d" />
                <Text style={styles.infoStripText}>
                    {activeTab === 'received'
                        ? 'Documents sent to you by HR or your supervisor'
                        : 'Documents you have sent to your supervisor'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#007bff" />
            ) : documents.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons
                        name={activeTab === 'received' ? 'download-outline' : 'send-outline'}
                        size={64}
                        color="#dee2e6"
                    />
                    <Text style={styles.emptyTitle}>
                        {activeTab === 'received' ? 'No documents received' : 'No documents sent'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {activeTab === 'received'
                            ? 'Documents from HR or your supervisor will appear here.'
                            : 'Documents you send to your supervisor will appear here.'}
                    </Text>
                    {activeTab === 'sent' && (
                        <TouchableOpacity style={styles.emptySendBtn} onPress={() => setShowSendModal(true)}>
                            <Ionicons name="send-outline" size={18} color="#fff" />
                            <Text style={styles.emptySendBtnText}>Send a Document</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={documents}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderDocumentItem}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Send Document Modal */}
            <Modal
                visible={showSendModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSendModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send Document</Text>
                            <TouchableOpacity onPress={() => setShowSendModal(false)}>
                                <Ionicons name="close" size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Project */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Project *</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={sendProjectId}
                                        onValueChange={(value) => setSendProjectId(value)}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Select a project" value="" />
                                        {projects.map((p) => (
                                            <Picker.Item key={p.id} label={p.projectname} value={String(p.id)} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            {/* Recipient (only for received tab - sending to employee) */}
                            {activeTab === 'received' && (
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Recipient Employee Number *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter employee number"
                                        value={sendTargetEmpno}
                                        onChangeText={setSendTargetEmpno}
                                        autoCapitalize="none"
                                    />
                                </View>
                            )}

                            {activeTab === 'sent' && (
                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle-outline" size={18} color="#007bff" />
                                    <Text style={styles.infoBoxText}>
                                        This document will be sent to your project supervisor.
                                    </Text>
                                </View>
                            )}

                            {/* Title */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Title *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Enter document title"
                                    value={sendTitle}
                                    onChangeText={setSendTitle}
                                />
                            </View>

                            {/* Document Type */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Document Type</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={sendDocumentType}
                                        onValueChange={(value) => setSendDocumentType(value)}
                                        style={styles.picker}
                                    >
                                        {DOC_TYPES.map((type) => (
                                            <Picker.Item key={type} label={type} value={type} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            {/* Description */}
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

                            {/* File */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>File *</Text>
                                <TouchableOpacity style={styles.filePicker} onPress={pickDocument}>
                                    <Ionicons name="cloud-upload-outline" size={24} color="#007bff" />
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
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
        height: 44,
        color: '#343a40',
    },

    tabRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#e9ecef',
        borderRadius: 14,
        padding: 4,
        gap: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    tabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: { fontSize: 13, color: '#6c757d', fontWeight: '600' },
    tabTextActive: { color: '#007bff' },

    infoStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginHorizontal: 16,
        marginBottom: 10,
    },
    infoStripText: { fontSize: 12, color: '#6c757d', flex: 1 },

    list: { padding: 16, paddingTop: 4 },

    docCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    docIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#e8f0fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    docInfo: { flex: 1 },
    docTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
    docMeta: { fontSize: 11, color: '#6c757d', marginTop: 1 },
    docDate: { fontSize: 11, color: '#adb5bd', marginTop: 2 },
    docActions: { alignItems: 'flex-end', gap: 4 },
    docStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    docStatusText: { fontSize: 10, fontWeight: '700' },
    docActionBtn: {
        padding: 4,
    },
    acknowledgeBtn: {
        backgroundColor: '#d4edda',
        borderRadius: 12,
        padding: 4,
    },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: '#6c757d', marginTop: 8, textAlign: 'center', lineHeight: 20 },
    emptySendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#007bff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        marginTop: 20,
    },
    emptySendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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

    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#e8f0fe',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    infoBoxText: { flex: 1, fontSize: 13, color: '#1a56db' },

    filePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 10,
        padding: 16,
        borderStyle: 'dashed',
    },
    filePickerText: { color: '#007bff', fontSize: 14, flex: 1 },

    submitButton: {
        backgroundColor: '#007bff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    disabledButton: { backgroundColor: '#6c757d', opacity: 0.6 },
});

export default DocumentsScreen;