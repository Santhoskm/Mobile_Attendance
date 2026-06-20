// MainTabScreen.tsx - Keep the same but ensure navigation works

import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TaskScreen from './TaskScreen';
import ProfileScreen from './ProfileScreen';
import DocumentsScreen from './DocumentsScreen';
import ViolationsScreen from './ViolationsScreen';
import DashboardScreen from './DashboardScreen';

const TABS = [
    { key: 'projects', label: 'Projects', icon: 'briefcase-outline', activeIcon: 'briefcase' },
    { key: 'docs', label: 'Docs', icon: 'document-text-outline', activeIcon: 'document-text' },
    { key: 'checkin', label: '', icon: 'scan-circle-outline', activeIcon: 'scan-circle' },
    { key: 'violations', label: 'Flags', icon: 'warning-outline', activeIcon: 'warning' },
    { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

const MainTabScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('projects');

    const renderScreen = () => {
        switch (activeTab) {
            case 'projects':
                return <TaskScreen navigation={navigation} />;
            case 'docs':
                return <DocumentsScreen navigation={navigation} />;
            case 'checkin':
                return <DashboardScreen navigation={navigation} route={{}} />;
            case 'violations':
                return <ViolationsScreen navigation={navigation} />;
            case 'profile':
                return <ProfileScreen navigation={navigation} />;
            default:
                return <TaskScreen navigation={navigation} />;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {renderScreen()}
            </View>

            <View style={styles.tabBar}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const isCenter = tab.key === 'checkin';

                    if (isCenter) {
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={styles.centerTabWrap}
                                onPress={() => setActiveTab(tab.key)}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.centerBtn, isActive && styles.centerBtnActive]}>
                                    <Ionicons
                                        name={(isActive ? tab.activeIcon : tab.icon) as any}
                                        size={30}
                                        color="#fff"
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tab}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={(isActive ? tab.activeIcon : tab.icon) as any}
                                size={22}
                                color={isActive ? '#007bff' : '#adb5bd'}
                            />
                            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    content: { flex: 1 },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        paddingTop: 8,
        height: Platform.OS === 'ios' ? 80 : 65,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 12,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    tabLabel: {
        fontSize: 10,
        color: '#adb5bd',
        fontWeight: '600',
    },
    tabLabelActive: {
        color: '#007bff',
    },
    centerTabWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -20,
    },
    centerBtn: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#007bff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#007bff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    centerBtnActive: {
        backgroundColor: '#0056b3',
    },
});

export default MainTabScreen;