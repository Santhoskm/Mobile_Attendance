import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://143.198.220.10'; // Your backend server IP

export interface LoginCredentials {
    empid: string;
    password: string;
}

export interface RegisterCredentials {
    empid: string;
    username: string;
    password: string;
}

export interface LoginResponse {
    status: boolean;
    message: string;
    user_id?: number;
    username?: string;
    empid?: string;
}

export interface RegisterResponse {
    status: boolean;
    message: string;
    data?: {
        empid: string;
        username: string;
    };
    errors?: any;
}

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request interceptor for logging
api.interceptors.request.use(
    (config) => {
        console.log(`Making ${config.method?.toUpperCase()} request to: ${config.baseURL}${config.url}`);
        console.log('Request data:', config.data);
        return config;
    },
    (error) => {
        console.log('Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for logging
api.interceptors.response.use(
    (response) => {
        console.log('Response status:', response.status);
        console.log('Response data:', response.data);
        return response;
    },
    (error) => {
        console.log('Response error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
    }
);

export const apiService = {
    // Login function
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const response = await api.post('/api/login/', {
            empid: credentials.empid,
            password: credentials.password
        });
        return response.data;
    },

    // Register function - New
    async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
        const response = await api.post('/api/register/', {
            empid: credentials.empid,
            username: credentials.username,
            password: credentials.password
        });
        return response.data;
    },

    // In api.ts, add this inside apiService
    async checkFaceEnrollment(empid: string): Promise<{ enrolled: boolean }> {
        try {
            const response = await api.get(`/api/face-enrollment-check/?empid=${empid}`);
            return response.data;
        } catch (error: any) {
            console.log('Check face enrollment error:', error);
            return { enrolled: false };
        }
    },

    async enrollFace(formData: FormData): Promise<any> {
        const response = await api.post('/api/face-enroll/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            },
        });
        return response.data;
    },

    async faceCheckIn(formData: FormData): Promise<any> {
        const response = await api.post('/api/face-check-in/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            },
        });
        return response.data;
    },

    // Face Check-out
    async faceCheckOut(formData: FormData): Promise<any> {
        const response = await api.post('/api/face-check-out/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            },
        });
        return response.data;
    },

    // Set auth token for subsequent requests
    setAuthToken(token: string) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    },

    // Save auth data to local storage
    async saveAuthData(userData: any) {
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        if (userData.user_id) {
            await AsyncStorage.setItem('userId', String(userData.user_id));
        }
    },

    // Get saved auth data
    async getAuthData() {
        const userData = await AsyncStorage.getItem('userData');
        const userId = await AsyncStorage.getItem('userId');
        return {
            user: userData ? JSON.parse(userData) : null,
            userId: userId,
        };
    },

    // Clear auth data on logout
    async clearAuthData() {
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('userId');
        delete api.defaults.headers.common['Authorization'];
    },
};