import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: object) {
    if (navigationRef.isReady()) {
        // @ts-ignore - screen names are dynamic here
        navigationRef.navigate(name, params);
    }
}