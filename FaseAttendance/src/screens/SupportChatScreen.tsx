// SupportChatScreen.tsx
// Employee/supervisor side of the admin support chat. One thread per employee,
// shared with the admin web inbox (chatinbox.html / chat_thread_detail.html).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import HeaderLogo from '../components/HeaderLogo';

interface ChatMessage {
    id: number;
    text: string;
    is_from_admin: boolean;
    sent_by_name: string | null;
    created_at: string;
}

const POLL_INTERVAL_MS = 12000;

const SupportChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<FlatList>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await apiService.getChatMessages();
            if (response.status && response.messages) {
                setMessages(response.messages);
            }
        } catch (error) {
            console.log('Load chat error:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [load]);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);
        setText('');
        try {
            const response = await apiService.sendChatMessage(trimmed);
            if (response.status && response.message_obj) {
                setMessages((prev) => [...prev, response.message_obj]);
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            }
        } catch (error) {
            console.log('Send chat message error:', error);
            setText(trimmed); // restore text so the user can retry
        } finally {
            setSending(false);
        }
    };

    const renderItem = ({ item }: { item: ChatMessage }) => (
        <View style={[styles.bubbleRow, item.is_from_admin ? styles.bubbleRowLeft : styles.bubbleRowRight]}>
            <View style={[styles.bubble, item.is_from_admin ? styles.bubbleAdmin : styles.bubbleMine]}>
                <Text style={item.is_from_admin ? styles.bubbleTextAdmin : styles.bubbleTextMine}>
                    {item.text}
                </Text>
                <Text style={item.is_from_admin ? styles.bubbleMetaAdmin : styles.bubbleMetaMine}>
                    {item.is_from_admin ? (item.sent_by_name || 'Admin') : 'You'} •{' '}
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <HeaderLogo />
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Support Chat</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {loading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : messages.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="chatbubble-ellipses-outline" size={56} color="#ced4da" />
                        <Text style={styles.emptyTitle}>No messages yet</Text>
                        <Text style={styles.emptySubtext}>
                            Send a message to admin and they'll reply here.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                    />
                )}

                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={text}
                        onChangeText={setText}
                        placeholder="Type a message…"
                        placeholderTextColor="#adb5bd"
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!text.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={18} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    header: {
        backgroundColor: '#3B82F6',
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

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#495057', marginTop: 12 },
    emptySubtext: { fontSize: 13, color: '#868e96', marginTop: 4, textAlign: 'center' },

    list: { padding: 16, paddingBottom: 8 },
    bubbleRow: { flexDirection: 'row', marginBottom: 10 },
    bubbleRowLeft: { justifyContent: 'flex-start' },
    bubbleRowRight: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '78%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
    bubbleAdmin: { backgroundColor: '#fff', borderBottomLeftRadius: 2 },
    bubbleMine: { backgroundColor: '#3B82F6', borderBottomRightRadius: 2 },
    bubbleTextAdmin: { color: '#212529', fontSize: 14 },
    bubbleTextMine: { color: '#fff', fontSize: 14 },
    bubbleMetaAdmin: { color: '#868e96', fontSize: 10, marginTop: 4 },
    bubbleMetaMine: { color: '#e7f0ff', fontSize: 10, marginTop: 4 },

    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    input: {
        flex: 1,
        maxHeight: 100,
        backgroundColor: '#f0f4f8',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#212529',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: { backgroundColor: '#adb5bd' },
});

export default SupportChatScreen;