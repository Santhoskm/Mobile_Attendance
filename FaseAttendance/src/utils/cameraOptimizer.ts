import { Camera } from 'expo-camera';
import { Platform } from 'react-native';

export const optimizeCameraForSpeed = async () => {
    if (Platform.OS === 'android') {
        try {
            await Camera.requestCameraPermissionsAsync();
        } catch (error) {
            console.log('Camera optimization error:', error);
        }
    }
};

export const getOptimalPictureSize = (sizes: string[]): string => {
    const preferredSizes = ['640x480', '1280x720', '1920x1080'];
    for (const prefSize of preferredSizes) {
        if (sizes.includes(prefSize)) {
            return prefSize;
        }
    }
    return sizes.sort((a, b) => {
        const aPixels = parseInt(a.split('x')[0]) * parseInt(a.split('x')[1]);
        const bPixels = parseInt(b.split('x')[0]) * parseInt(b.split('x')[1]);
        return aPixels - bPixels;
    })[0] || '640x480';
};

export const muteCameraSound = async () => {
    if (Platform.OS === 'android') {
        try {
            const { Audio } = require('expo-av');
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: false,
                playsInSilentModeIOS: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });
        } catch (error) {
            console.log('Audio mode setting error:', error);
        }
    }
};