// InactiveProjectsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const InactiveProjectsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
    const projects = route.params?.projects || [];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Completed Projects</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {projects.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="archive-outline" size={60} color="#adb5bd" />
                        <Text style={styles.emptyText}>No completed projects yet.</Text>
                    </View>
                ) : (
                    projects.map((project: any) => (
                        <TouchableOpacity
                            key={project.id}
                            style={styles.projectCard}
                            onPress={() =>
                                navigation.navigate('ProjectDetail', {
                                    projectId: project.id,
                                    projectName: project.projectname,
                                    userRole: project.role,
                                    project: project,
                                })
                            }
                        >
                            <View style={styles.cardTop}>
                                <Text style={styles.projectTitle}>{project.projectname}</Text>
                                <View style={styles.endedBadge}>
                                    <Text style={styles.endedBadgeText}>Ended</Text>
                                </View>
                            </View>
                            {project.site_address && (
                                <Text style={styles.projectAddress} numberOfLines={1}>
                                    📍 {project.site_address}
                                </Text>
                            )}
                            <Text style={styles.viewHint}>View attendance history →</Text>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: {
        backgroundColor: '#212c6b',
        paddingTop: 55,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: { padding: 4 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    content: { padding: 16 },
    emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { color: '#6c757d', fontSize: 14 },
    projectCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    projectTitle: { fontSize: 15, fontWeight: '700', color: '#212529' },
    endedBadge: { backgroundColor: '#f1c0c0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    endedBadgeText: { color: '#dc3545', fontSize: 11, fontWeight: '700' },
    projectAddress: { color: '#6c757d', fontSize: 12, marginTop: 6 },
    viewHint: { color: '#212c6b', fontSize: 12, fontWeight: '600', marginTop: 10 },
});

export default InactiveProjectsScreen;