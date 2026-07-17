// FloatingBroadcastButton.tsx
// A floating "📢" button that the user can drag anywhere on screen.
// When there are unread broadcasts, a small popup bubble slides in showing
// the latest one, then auto-dismisses. A small dot (no number) shows while
// there are unread broadcasts, and it disappears as soon as the user opens
// the broadcast list. Position is remembered between app opens.
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    PanResponder,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

interface Broadcast {
    id: number;
    title: string;
    is_read?: boolean;
    created_at: string;
}

const POPUP_AUTOHIDE_MS = 5000;
const POLL_INTERVAL_MS = 60000; // re-check for new broadcasts every 60s while app is open
const FAB_SIZE = 56;
const EDGE_MARGIN = 12;
const POSITION_STORAGE_KEY = 'floatingBroadcastButtonPosition';
const DRAG_THRESHOLD = 6; // px of movement before a touch counts as a drag, not a tap

// Default position: bottom-right, above the tab bar
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DEFAULT_X = SCREEN_W - FAB_SIZE - EDGE_MARGIN;
const DEFAULT_Y = SCREEN_H - FAB_SIZE - 160;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const FloatingBroadcastButton: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [latest, setLatest] = useState<Broadcast | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [ready, setReady] = useState(false);
    const lastSeenIdRef = useRef<number | null>(null);
    const popupAnim = useRef(new Animated.Value(0)).current;
    const badgeAnim = useRef(new Animated.Value(1)).current;

    // Draggable position
    const pan = useRef(new Animated.ValueXY({ x: DEFAULT_X, y: DEFAULT_Y })).current;
    const posRef = useRef({ x: DEFAULT_X, y: DEFAULT_Y });
    const dragStartRef = useRef({ x: DEFAULT_X, y: DEFAULT_Y });
    const movedRef = useRef(false);

    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(POSITION_STORAGE_KEY);
                if (saved) {
                    const { x, y } = JSON.parse(saved);
                    const safeX = clamp(x, EDGE_MARGIN, SCREEN_W - FAB_SIZE - EDGE_MARGIN);
                    const safeY = clamp(y, EDGE_MARGIN, SCREEN_H - FAB_SIZE - EDGE_MARGIN);
                    pan.setValue({ x: safeX, y: safeY });
                    posRef.current = { x: safeX, y: safeY };
                }
            } catch (error) {
                console.log('FloatingBroadcastButton position load error:', error);
            } finally {
                setReady(true);
            }
        })();
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const load = async () => {
        try {
            const response = await apiService.getBroadcasts();
            const list: Broadcast[] = response.broadcasts || [];
            const unread = list.filter((b) => !b.is_read);
            setUnreadCount(response.unread_count ?? unread.length);

            const newest = unread[0];
            if (newest && newest.id !== lastSeenIdRef.current) {
                lastSeenIdRef.current = newest.id;
                setLatest(newest);
                triggerPopup();
                bounceBadge();
            }
        } catch (error) {
            console.log('FloatingBroadcastButton load error:', error);
        }
    };

    const triggerPopup = () => {
        setShowPopup(true);
        Animated.sequence([
            Animated.timing(popupAnim, {
                toValue: 1,
                duration: 250,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
            Animated.delay(POPUP_AUTOHIDE_MS),
            Animated.timing(popupAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => setShowPopup(false));
    };

    const bounceBadge = () => {
        badgeAnim.setValue(1.4);
        Animated.spring(badgeAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    };

    const openBroadcasts = () => {
        setShowPopup(false);
        popupAnim.setValue(0);
        // Hide the unread indicator immediately once opened, no need to keep showing it
        setUnreadCount(0);
        navigation.navigate('Broadcasts');
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_evt, gesture) =>
                Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
            onPanResponderGrant: () => {
                movedRef.current = false;
                dragStartRef.current = { ...posRef.current };
                pan.setOffset(posRef.current);
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (_evt, gesture) => {
                if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) {
                    movedRef.current = true;
                }
                Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_evt, gesture);
            },
            onPanResponderRelease: async () => {
                pan.flattenOffset();

                // @ts-ignore - _value exists on Animated.Value internally
                const rawX = pan.x._value as number;
                // @ts-ignore
                const rawY = pan.y._value as number;

                const clampedX = clamp(rawX, EDGE_MARGIN, SCREEN_W - FAB_SIZE - EDGE_MARGIN);
                const clampedY = clamp(rawY, EDGE_MARGIN, SCREEN_H - FAB_SIZE - EDGE_MARGIN);

                Animated.spring(pan, {
                    toValue: { x: clampedX, y: clampedY },
                    useNativeDriver: false,
                    friction: 6,
                }).start(async () => {
                    posRef.current = { x: clampedX, y: clampedY };
                    try {
                        await AsyncStorage.setItem(
                            POSITION_STORAGE_KEY,
                            JSON.stringify({ x: clampedX, y: clampedY })
                        );
                    } catch (error) {
                        console.log('FloatingBroadcastButton position save error:', error);
                    }
                });

                if (!movedRef.current) {
                    // It was a tap, not a drag
                    openBroadcasts();
                }
            },
        })
    ).current;

    if (!ready) return null;

    // Popup should open above/left of the button and stay on-screen; flip side
    // near the right edge so it doesn't get clipped.
    const nearRightEdge = posRef.current.x > SCREEN_W - FAB_SIZE - 260;

    return (
        <Animated.View
            style={[styles.wrap, { transform: pan.getTranslateTransform() }]}
            pointerEvents="box-none"
        >
            {showPopup && latest && (
                <Animated.View
                    style={[
                        styles.popup,
                        nearRightEdge ? { right: 0 } : { left: 0 },
                        {
                            opacity: popupAnim,
                            transform: [
                                { scale: popupAnim },
                                {
                                    translateY: popupAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <TouchableOpacity style={styles.popupTouchable} onPress={openBroadcasts} activeOpacity={0.85}>
                        <Ionicons name="megaphone" size={18} color="#007bff" />
                        <View style={styles.popupTextWrap}>
                            <Text style={styles.popupTitle} numberOfLines={1}>New broadcast</Text>
                            <Text style={styles.popupBody} numberOfLines={2}>{latest.title}</Text>
                        </View>
                        <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => {
                                Animated.timing(popupAnim, { toValue: 0, duration: 150, useNativeDriver: true })
                                    .start(() => setShowPopup(false));
                            }}
                        >
                            <Ionicons name="close" size={16} color="#adb5bd" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                    <View style={[styles.popupTail, nearRightEdge ? { right: 22 } : { left: 22 }]} />
                </Animated.View>
            )}

            <View style={styles.fab} {...panResponder.panHandlers}>
                <Ionicons name="megaphone" size={24} color="#fff" />
                {unreadCount > 0 && (
                    <Animated.View style={[styles.dot, { transform: [{ scale: badgeAnim }] }]} />
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        alignItems: 'flex-end',
        zIndex: 50,
    },
    fab: {
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        backgroundColor: '#007bff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    dot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#dc3545',
        borderWidth: 2,
        borderColor: '#fff',
    },

    popup: {
        position: 'absolute',
        bottom: FAB_SIZE + 10,
        maxWidth: 250,
    },
    popupTouchable: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    popupTextWrap: { flex: 1 },
    popupTitle: { fontSize: 11, fontWeight: '700', color: '#007bff' },
    popupBody: { fontSize: 12, color: '#343a40', marginTop: 2 },
    popupTail: {
        position: 'absolute',
        bottom: -6,
        width: 12,
        height: 12,
        backgroundColor: '#fff',
        transform: [{ rotate: '45deg' }],
    },
});

export default FloatingBroadcastButton;