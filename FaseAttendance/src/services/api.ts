import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://143.198.220.10';

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

export interface Project {
    id: number;
    projectname?: string;
    projectcode?: string;
    clientname?: string;
    description?: string;
    projectstartdate?: string;
    projectenddate?: string;
    shiftstarttime?: string;
    shiftendtime?: string;
    threshold?: number;
    site_latitude?: number;
    site_longitude?: number;
    siteaddress?: string;
}

export interface ProjectResponse {
    status: boolean;
    message?: string;
    data?: Project[];
    projects?: Project[];
}

export interface ProjectCheckInResponse {
    status: boolean;
    message: string;
    check_in_time?: string;
    project_id?: number;
    project_name?: string;
    check_in_id?: number;
}

export interface ProjectCheckInsResponse {
    status: boolean;
    checkins?: Array<{
        id: number;
        project_id: number;
        project_name: string;
        check_in_time: string;
        check_out_time?: string;
        latitude?: number;
        longitude?: number;
        notes?: string;
        check_in_place?: string;   // ADD
        checkin_place?: string;    // ADD (alternative naming)
        check_out_place?: string;  // ADD
        checkout_place?: string;   // ADD (alternative naming)

    }>;
}

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

let cancelTokenSource = axios.CancelToken.source();

// Request interceptor
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

// Response interceptor
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
    cancelRequests() {
        cancelTokenSource.cancel('Request canceled by user');
        cancelTokenSource = axios.CancelToken.source();
    },

    // Authentication endpoints
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const response = await api.post('/api/login/', {
            empid: credentials.empid,
            password: credentials.password
        });
        return response.data;
    },

    async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
        const response = await api.post('/api/register/', {
            empid: credentials.empid,
            username: credentials.username,
            password: credentials.password
        });
        return response.data;
    },

    // Face recognition endpoints
    async checkFaceEnrollment(empid: string): Promise<{ enrolled: boolean }> {
        try {
            const response = await api.get(`/api/face-enrollment-check/?empid=${empid}`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
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
            timeout: 20000,
            cancelToken: cancelTokenSource.token,
        });
        return response.data;
    },

    async faceCheckIn(formData: FormData): Promise<any> {
        const response = await api.post('/api/face-check-in/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            },
            timeout: 10000,
            cancelToken: cancelTokenSource.token,
        });
        return response.data;
    },

    async faceCheckOut(formData: FormData): Promise<any> {
        const response = await api.post('/api/face-check-out/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            },
            timeout: 10000,
            cancelToken: cancelTokenSource.token,
        });
        return response.data;
    },

    async getAttendanceStatus(empid: string): Promise<any> {
        const response = await api.get(`/api/attendance-status/?empid=${empid}`, {
            timeout: 10000,
            cancelToken: cancelTokenSource.token,
        });
        return response.data;
    },

    async getMyProfile(empid: string): Promise<any> {
        try {
            const response = await api.get(`/api/my-profile/?empid=${empid}`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Get my profile error:', error);
            return null;
        }
    },

    // Project endpoints
    async getProjects(empid?: string): Promise<ProjectResponse> {
        try {
            let url = '/api/projects/';
            if (empid) {
                url += `?empid=${empid}`;
            }
            const response = await api.get(url, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });

            // Handle different response formats
            let projectsData = response.data;

            // If the response has a data property that contains projects
            if (projectsData.data && Array.isArray(projectsData.data)) {
                return { status: true, data: projectsData.data };
            }
            // If the response has a projects property
            else if (projectsData.projects && Array.isArray(projectsData.projects)) {
                return { status: true, projects: projectsData.projects };
            }
            // If the response itself is an array
            else if (Array.isArray(projectsData)) {
                return { status: true, data: projectsData };
            }
            // If the response has a results property (common in DRF)
            else if (projectsData.results && Array.isArray(projectsData.results)) {
                return { status: true, data: projectsData.results };
            }

            return { status: false, message: 'Invalid response format', data: [] };
        } catch (error: any) {
            console.log('Get projects error:', error);
            throw error;
        }
    },

    async getProjectDetails(projectId: number): Promise<any> {
        try {
            const response = await api.get(`/api/projects/${projectId}/`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error: any) {
            console.log('Get project details error:', error);
            throw error;
        }
    },

    // api.ts - Add these methods to your existing apiService

    // Add to apiService object in api.ts:

    async getViolations(empid: string, projectId?: string): Promise<any> {
        try {
            let url = `/api/violations/?empid=${empid}`;
            if (projectId) {
                url += `&project_id=${projectId}`;
            }
            const response = await api.get(url, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Get violations error:', error);
            return { violations: [] };
        }
    },

    async getViolationTypes(): Promise<any> {
        try {
            const response = await api.get('/api/violation-types/', {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Get violation types error:', error);
            return { violation_types: [] };
        }
    },

    async submitViolation(formData: FormData): Promise<any> {
        try {
            const response = await api.post('/api/violations/submit/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                },
                timeout: 20000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Submit violation error:', error);
            throw error;
        }
    },

    async reviewViolation(violationId: number, data: any): Promise<any> {
        try {
            const response = await api.post(`/api/violations/${violationId}/review/`, data, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Review violation error:', error);
            throw error;
        }
    },

    async getDocuments(empid: string, projectId?: string): Promise<any> {
        try {
            let url = `/api/documents/?empid=${empid}`;
            if (projectId) {
                url += `&project_id=${projectId}`;
            }
            const response = await api.get(url, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Get documents error:', error);
            return { documents: [] };
        }
    },

    async sendDocument(formData: FormData): Promise<any> {
        try {
            const response = await api.post('/api/documents/send/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                },
                timeout: 30000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Send document error:', error);
            throw error;
        }
    },

    async acknowledgeDocument(documentId: number, empid: string): Promise<any> {
        try {
            const response = await api.post(`/api/documents/${documentId}/acknowledge/`, { empid }, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Acknowledge document error:', error);
            throw error;
        }
    },

    // api.ts - Update getMyProjects method

    // api.ts - Update getMyProjects method

    async getMyProjects(empid: string): Promise<any> {
        try {
            const response = await api.get(`/api/my-projects/?empid=${empid}`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            console.log('getMyProjects response:', response.data);
            return response.data;
        } catch (error) {
            console.log('Get my projects error:', error);
            // Return a consistent format even on error
            return { status: false, projects: [] };
        }
    },

    // api.ts - This should already exist, but make sure it's there
    async getMyProjectCheckIns(empid: string): Promise<ProjectCheckInsResponse> {
        try {
            const response = await api.get(`/api/my-project-checkins/?empid=${empid}`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error: any) {
            console.log('Get project check-ins error:', error);
            return { status: false, checkins: [] };
        }
    },

    // api.ts - Add this method

    async getProjectEmployees(projectId: number, empid: string): Promise<any> {
        try {
            const response = await api.get(`/api/projects/${projectId}/employees/?empid=${empid}`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error) {
            console.log('Get project employees error:', error);
            return { employees: [] };
        }
    },
    async checkInToProject(projectId: number, empid: string, location?: { latitude: number; longitude: number }, notes?: string): Promise<ProjectCheckInResponse> {
        try {
            const formData = new FormData();
            formData.append('project_id', projectId.toString());
            formData.append('empid', empid);
            if (location) {
                formData.append('latitude', location.latitude.toString());
                formData.append('longitude', location.longitude.toString());
            }
            if (notes) {
                formData.append('notes', notes);
            }

            const response = await api.post('/api/project-check-in/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                },
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error: any) {
            console.log('Project check-in error:', error);
            throw error;
        }
    },

    async checkOutFromProject(projectId: number, empid: string, checkInId?: number, location?: { latitude: number; longitude: number }): Promise<any> {
        try {
            const formData = new FormData();
            formData.append('project_id', projectId.toString());
            formData.append('empid', empid);
            if (checkInId) {
                formData.append('check_in_id', checkInId.toString());
            }
            if (location) {
                formData.append('latitude', location.latitude.toString());
                formData.append('longitude', location.longitude.toString());
            }

            const response = await api.post('/api/project-check-out/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                },
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error: any) {
            console.log('Project check-out error:', error);
            throw error;
        }
    },


    async getProjectCheckIns(projectId: number): Promise<any> {
        try {
            const response = await api.get(`/api/projects/${projectId}/checkins/`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error: any) {
            console.log('Get project check-ins error:', error);
            throw error;
        }
    },

    // Task endpoints (if needed)
    async getTodayTasks(empid: string): Promise<any> {
        try {
            const response = await api.get(`/api/tasks/today/?empid=${empid}`, {
                timeout: 10000,
                cancelToken: cancelTokenSource.token,
            });
            return response.data;
        } catch (error: any) {
            console.log('Get tasks error:', error);
            throw error;
        }
    },

    async updateTaskStatus(taskId: number, status: string): Promise<any> {
        try {
            const response = await api.patch(`/api/tasks/${taskId}/`,
                { status: status },
                {
                    timeout: 10000,
                    cancelToken: cancelTokenSource.token,
                }
            );
            return response.data;
        } catch (error: any) {
            console.log('Update task error:', error);
            throw error;
        }
    },

    // Auth token management
    setAuthToken(token: string) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    },

    async saveAuthData(userData: any) {
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        if (userData.user_id) {
            await AsyncStorage.setItem('userId', String(userData.user_id));
        }
        if (userData.token) {
            this.setAuthToken(userData.token);
            await AsyncStorage.setItem('authToken', userData.token);
        }
    },

    async getAuthData() {
        const userData = await AsyncStorage.getItem('userData');
        const userId = await AsyncStorage.getItem('userId');
        const token = await AsyncStorage.getItem('authToken');

        if (token) {
            this.setAuthToken(token);
        }

        return {
            user: userData ? JSON.parse(userData) : null,
            userId: userId,
            token: token,
        };
    },

    async clearAuthData() {
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('userId');
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('rememberMe');
        await AsyncStorage.removeItem('faceEnrolled');
        await AsyncStorage.removeItem('checkedInProjects');
        delete api.defaults.headers.common['Authorization'];
    },

    // Utility method to check server health
    async checkServerHealth(): Promise<boolean> {
        try {
            const response = await api.get('/api/health/', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            console.log('Server health check failed:', error);
            return false;
        }
    }
};