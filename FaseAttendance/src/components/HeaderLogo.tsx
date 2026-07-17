// HeaderLogo.tsx
// Small company logo shown in the top-right corner of every screen header.
// Absolutely positioned so it can be dropped into any existing header View
// without needing to rework that screen's layout.
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const HeaderLogo: React.FC = () => {
    return (
        <View style={styles.wrap} pointerEvents="none">
            <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 50,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    logo: {
        width: 56,
        height: 22,
    },
});

export default HeaderLogo;