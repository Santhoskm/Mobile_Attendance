import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { apiService } from '../services/api';

type TabType = 'received' | 'uploaded';

interface Document {
    id: string | number;
    name: string;
    type: string;
    size?: string;
    uploaded_at: string;
    status?: 'pending' | 'approved' | 'rejected';
    uploaded_by?: string;
    url?: string;
}

const DOC_ICONS: Record<string, string> = {
    pdf: 'document-text',
    doc: 'document',
    docx: 'document',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    xls: 'grid',
    xlsx: 'grid',
};

const DOC_COLORS: Record<string, string> = {
    pdf: '#dc3545',
    doc: '#007bff',
    docx: '#007bff',
    jpg: '#28a745',
    jpeg: '#28a745',
    png: '#28a745',
    xls: '#28a745',
    xlsx: '#28a745',
};

const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() || 'file';

const DocumentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState<TabType>('received');
    const [receivedDocs, setReceivedDocs] = useState<Document[]>([]);
    const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        loadUserAndDocs();
    }, []);

    const loadUserAndDocs = async () => {
        setLoading(true);
        try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
                const data = JSON.parse(userDataString);
                setUserData(data);
                await loadDocuments(data.empid);
            }
        } catch (error) {
            console.log('Error loading user:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadDocuments = async (empid: string) => {
        try {
            const response = await apiService.getMyDocuments(empid);
            setReceivedDocs(response?.received || []);
            setUploadedDocs(response?.uploaded || []);
        } catch (error) {
            console.log('Error loading documents:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        if (userData?.empid) await loadDocuments(userData.empid);
        setRefreshing(false);
    };

    const handleUpload = async () => {
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

            Alert.alert(
                'Upload Document',
                `Upload "${file.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Upload',
                        onPress: async () => {
                            setUploading(true);
                            try {
                                const formData = new FormData();
                                formData.append('empid', userData?.empid || '');
                                formData.append('document', {
                                    uri: file.uri,
                                    type: file.mimeType || 'application/octet-stream',
                                    name: file.name,
                                } as any);

                                await apiService.uploadDocument(formData);

                                Alert.alert('Success', 'Document uploaded successfully.');
                                if (userData?.empid) await loadDocuments(userData.empid);
                                setActiveTab('uploaded');
                            } catch (error) {
                                Alert.alert('Upload Failed', 'Could not upload the document. Please try again.');
                            } finally {
                                setUploading(false);
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Could not open file picker.');
        }
    };

    const renderDocItem = ({ item }: { item: Document }) => {
        const ext = getExtension(item.name);
        const icon = DOC_ICONS[ext] || 'document-outline';
        const color = DOC_COLORS[ext] || '#6c757d';

        return (
            <View style={styles.docCard}>
                <View style={[styles.docIconWrap, { backgroundColor: color + '18' }]}>
                    <Ionicons name={icon as any} size={28} color={color} />
                </View>
                <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.docMeta}>
                        {ext.toUpperCase()}
                        {item.size ? ` • ${item.size}` : ''}
                        {item.uploaded_by ? ` • From: ${item.uploaded_by}` : ''}
                    </Text>
                    <Text style={styles.docDate}>{item.uploaded_at}</Text>
                </View>
                <View style={styles.docActions}>
                    {activeTab === 'uploaded' && item.status && (
                        <View style={[
                            styles.docStatusBadge,
                            item.status === 'approved' ? styles.statusApproved :
                                item.status === 'rejected' ? styles.statusRejected :
                                    styles.statusPending,
                        ]}>
                            <Text style={styles.docStatusText}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                        </View>
                    )}
                    {item.url && (
                        <TouchableOpacity style={styles.docViewBtn}>
                            <Ionicons name="eye-outline" size={18} color="#007bff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const currentDocs = activeTab === 'received' ? receivedDocs : uploadedDocs;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Documents</Text>
                <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handleUpload}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                            <Text style={styles.uploadBtnText}>Upload</Text>
                        </>
                    )}
                </TouchableOpacity>
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
                        Received ({receivedDocs.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'uploaded' && styles.tabActive]}
                    onPress={() => setActiveTab('uploaded')}
                >
                    <Ionicons
                        name="cloud-upload-outline"
                        size={16}
                        color={activeTab === 'uploaded' ? '#007bff' : '#6c757d'}
                    />
                    <Text style={[styles.tabText, activeTab === 'uploaded' && styles.tabTextActive]}>
                        Uploaded ({uploadedDocs.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Info strip */}
            <View style={styles.infoStrip}>
                <Ionicons name="information-circle-outline" size={14} color="#6c757d" />
                <Text style={styles.infoStripText}>
                    {activeTab === 'received'
                        ? 'Documents sent to you by HR or your supervisor'
                        : 'Documents you have submitted (work permits, certs, etc.)'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#007bff" />
            ) : currentDocs.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons
                        name={activeTab === 'received' ? 'download-outline' : 'cloud-upload-outline'}
                        size={64}
                        color="#dee2e6"
                    />
                    <Text style={styles.emptyTitle}>
                        {activeTab === 'received' ? 'No documents received' : 'No documents uploaded'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {activeTab === 'received'
                            ? 'Documents from HR or your supervisor will appear here.'
                            : 'Tap Upload above to submit a document.'}
                    </Text>
                    {activeTab === 'uploaded' && (
                        <TouchableOpacity style={styles.emptyUploadBtn} onPress={handleUpload}>
                            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                            <Text style={styles.emptyUploadBtnText}>Upload a Document</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={currentDocs}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderDocItem}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8', paddingBottom: 80 },

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
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    tabRow: {
        flexDirection: 'row',
        margin: 16,
        backgroundColor: '#e9ecef',
        borderRadius: 14,
        padding: 4,
        gap: 4,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10, borderRadius: 10,
    },
    tabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08, shadowRadius: 2, elevation: 2,
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
        width: 52, height: 52, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    docInfo: { flex: 1 },
    docName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', marginBottom: 3 },
    docMeta: { fontSize: 11, color: '#6c757d', marginBottom: 2 },
    docDate: { fontSize: 11, color: '#adb5bd' },
    docActions: { alignItems: 'flex-end', gap: 6 },
    docStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusApproved: { backgroundColor: '#d4edda' },
    statusRejected: { backgroundColor: '#fdecea' },
    statusPending: { backgroundColor: '#fff4e6' },
    docStatusText: { fontSize: 10, fontWeight: '700', color: '#495057' },
    docViewBtn: { padding: 4 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: '#6c757d', marginTop: 8, textAlign: 'center', lineHeight: 20 },
    emptyUploadBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#007bff', paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: 20, marginTop: 20,
    },
    emptyUploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default DocumentsScreen;