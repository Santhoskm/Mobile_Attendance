// BroadcastsScreen.tsx
// Read-only: employees can VIEW broadcasts from admin but there is no send/reply
// UI here on purpose, and apiService has no matching "send" call for this screen.
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Linking,
    SafeAreaView,
    Image,
    Modal,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
interface Broadcast {
    id: number;
    title: string;
    description: string;
    document_type: string;
    target: 'ALL' | 'EMPLOYEE' | 'SUPERVISOR';
    sent_by_name: string;
    file_url: string | null;
    image_url: string | null;
    created_at: string;
}

const DOC_ICONS: Record<string, string> = {
    Announcement: 'megaphone',
    Circular: 'document-text',
    Policy: 'shield-checkmark',
    Notice: 'alert-circle',
    General: 'document-outline',
    Other: 'ellipsis-horizontal',
};

const BroadcastsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [descriptionModal, setDescriptionModal] = useState<Broadcast | null>(null);
    const [truncatedIds, setTruncatedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadBroadcasts();
    }, []);

    const loadBroadcasts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiService.getBroadcasts();
            if (response.status && response.broadcasts) {
                setBroadcasts(response.broadcasts);
            } else {
                setBroadcasts([]);
            }
        } catch (error) {
            console.log('Error loading broadcasts:', error);
            setBroadcasts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadBroadcasts();
        setRefreshing(false);
    };

    const openBroadcast = async (item: Broadcast) => {
        // Mark as read (best-effort, doesn't block viewing the attachment)
        apiService.markBroadcastRead(item.id).catch(() => { });

        if (item.image_url) {
            // Open the image full-screen inside the app
            setPreviewImage(item.image_url);
        } else if (item.file_url) {
            // Documents (pdf/doc/etc.) open in the device's own viewer/browser
            Linking.openURL(item.file_url).catch(() =>
                console.log('Could not open broadcast attachment')
            );
        }
    };

    const renderItem = ({ item }: { item: Broadcast }) => (
        <TouchableOpacity style={styles.card} onPress={() => openBroadcast(item)} activeOpacity={0.7}>
            <View style={styles.iconWrap}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                    <Ionicons
                        name={(DOC_ICONS[item.document_type] || 'document-outline') as any}
                        size={22}
                        color="#212c6b"
                    />
                )}
            </View>
            <View style={styles.info}>
                <Text style={styles.title}>{item.title}</Text>
                {!!item.description && (
                    <TouchableOpacity
                        onPress={() => truncatedIds.has(item.id) && setDescriptionModal(item)}
                        activeOpacity={truncatedIds.has(item.id) ? 0.6 : 1}
                        disabled={!truncatedIds.has(item.id)}
                    >
                        <Text
                            style={styles.desc}
                            numberOfLines={2}
                            onTextLayout={(e) => {
                                if (e.nativeEvent.lines.length > 2 && !truncatedIds.has(item.id)) {
                                    setTruncatedIds(prev => new Set(prev).add(item.id));
                                }
                            }}
                        >
                            {item.description}
                        </Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.meta}>
                    {item.document_type} • From {item.sent_by_name || 'Admin'}
                </Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {(item.file_url || item.image_url) && (
                <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Broadcasts</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading && !refreshing ? (
                <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color="#212c6b" />
                </View>
            ) : broadcasts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="megaphone-outline" size={56} color="#ced4da" />
                    <Text style={styles.emptyTitle}>No broadcasts yet</Text>
                    <Text style={styles.emptySubtext}>
                        Announcements from admin will show up here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={broadcasts}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#212c6b']} />
                    }
                />
            )}

            <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
                <TouchableOpacity
                    style={styles.previewOverlay}
                    activeOpacity={1}
                    onPress={() => setPreviewImage(null)}
                >
                    <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImage(null)}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {previewImage && (
                        <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
                    )}
                </TouchableOpacity>
            </Modal>
            + <Modal
                visible={!!descriptionModal}
                transparent
                animationType="fade"
                onRequestClose={() => setDescriptionModal(null)}
            >
                <TouchableOpacity style={styles.descOverlay} activeOpacity={1} onPress={() => setDescriptionModal(null)}>
                    <TouchableOpacity style={styles.descBox} activeOpacity={1} onPress={() => { }}>
                        <View style={styles.descHeader}>
                            <Text style={styles.descTitle}>{descriptionModal?.title}</Text>
                            <TouchableOpacity onPress={() => setDescriptionModal(null)}>
                                <Ionicons name="close" size={24} color="#495057" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.descScroll}>
                            <Text style={styles.descFullText}>{descriptionModal?.description}</Text>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
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
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },

    list: { padding: 16 },
    card: {
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
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#e8f0fe',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbnail: {
        width: 48,
        height: 48,
    },
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewImage: {
        width: '90%',
        height: '70%',
    },
    previewClose: {
        position: 'absolute',
        top: 55,
        right: 20,
        zIndex: 10,
        padding: 6,
    },
    descOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    descBox: { backgroundColor: '#fff', borderRadius: 16, padding: 18, width: '100%', maxHeight: '70%' },
    descHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    descTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', flex: 1, marginRight: 10 },
    descScroll: { maxHeight: '100%' },
    descFullText: { fontSize: 14, color: '#495057', lineHeight: 21 },
    info: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
    desc: { fontSize: 12, color: '#495057', marginTop: 2 },
    meta: { fontSize: 11, color: '#000000', marginTop: 4 },
    date: { fontSize: 11, color: '#adb5bd', marginTop: 2 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: '#000000', marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

export default BroadcastsScreen;