import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService, LoginCredentials } from '../services/api';
import { getExpoPushToken } from '../hooks/usePushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [empid, setEmpid] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleLogin = async () => {
        if (!empid.trim()) {
            Alert.alert('Error', 'Please enter your Employee ID');
            return;
        }
        if (!password.trim()) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        setIsLoading(true);

        try {
            // Changed from empno to empid to match your Django API
            const credentials: LoginCredentials = {
                empid: empid.trim(),
                password: password.trim(),
            };

            console.log('Attempting login with:', { empid: credentials.empid, password: '***' });

            const response = await apiService.login(credentials);

            if (__DEV__) {
                console.log('Full response from server:', response);
            }

            // Check if login was successful based on your API response structure

            if (response.status === true) {
                // ALWAYS save user data (remove the if rememberMe condition)
                await apiService.saveAuthData({
                    user_id: response.user_id,
                    username: response.username,
                    empid: response.empid,
                    access: response.access,
                    refresh: response.refresh,
                });

                // Register this device for push notifications now that we're authenticated.
                getExpoPushToken()
                    .then((token) => {
                        if (token) apiService.registerPushToken(token);
                    })
                    .catch(() => { });



                // Optional: Save remember me preference separately if needed
                if (rememberMe) {
                    await AsyncStorage.setItem('rememberMe', 'true');
                } else {
                    await AsyncStorage.setItem('rememberMe', 'false');
                }

                Alert.alert('Success', response.message || 'Login successful!');

                // Navigate to Dashboard on success
                // navigation.replace('Task');
                navigation.replace('Main');
            } else {
                // Login failed
                Alert.alert('Login Failed', response.message || 'Invalid credentials');
            }
        } catch (error: any) {
            console.log("LOGIN ERROR:", error);

            let errorMessage = 'Connection failed. Please check:\n\n';

            if (error.response?.data) {
                // Server responded with error
                const serverError = error.response.data;
                errorMessage = serverError.message || JSON.stringify(serverError);
            } else if (error.message === 'Network Error') {
                errorMessage += `Cannot reach server\n\nMake sure:\n`;
                errorMessage += `• Server is running\n`;
                errorMessage += `• Device can access the IP address\n`;
                errorMessage += `• No firewall blocking the connection\n`;
                errorMessage += `• You're on the correct network`;
            } else if (error.code === 'ECONNABORTED') {
                errorMessage += 'Request timeout - Server is taking too long to respond';
            } else {
                errorMessage += error.message;
            }

            Alert.alert('Login Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Logo Section */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/images/IET.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.welcomeText}>Welcome Back!</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>
                </View>

                {/* Form Section */}
                <View style={styles.formContainer}>
                    {/* Employee ID Input */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={24} color="#000000" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Employee ID"
                            placeholderTextColor="#000000"
                            value={empid}
                            onChangeText={setEmpid}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                            returnKeyType="next"
                        />
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={24} color="#000000" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#000000"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            editable={!isLoading}
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={24} color="#000000" />
                        </TouchableOpacity>
                    </View>

                    {/* Remember Me & Forgot Password Row */}
                    <View style={styles.optionsContainer}>
                        <TouchableOpacity
                            style={styles.rememberMeCheckbox}
                            onPress={() => setRememberMe(!rememberMe)}
                            disabled={isLoading}
                        >
                            <Ionicons
                                name={rememberMe ? 'checkbox' : 'square-outline'}
                                size={20}
                                color="#212c6b"
                            />
                            <Text style={styles.rememberMeText}>Remember Me</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.forgotPassword}
                            onPress={() => Alert.alert('Forgot Password', 'Please contact your system administrator.')}
                            disabled={isLoading}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.loginButton, (isLoading || !empid || !password) && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading || !empid || !password}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.loginButtonText}>  Signing In...</Text>
                            </View>
                        ) : (
                            <View style={styles.buttonContent}>
                                <Text style={styles.loginButtonText}>Sign In</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                            </View>
                        )}
                    </TouchableOpacity>
                    {/* Register Link */}
                    {/* <View style={styles.registerContainer}>
                        <Text style={styles.registerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={isLoading}>
                            <Text style={styles.registerLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View> */}

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>© 2026 IET Workforce Management System</Text>
                        <Text style={styles.versionText}>Version 3.1.0</Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    registerText: {
        color: '#000000',
        fontSize: 14,
    },
    registerLink: {
        color: '#212c6b',
        fontSize: 14,
        fontWeight: 'bold',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingVertical: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    logo: {
        width: 150,
        height: 150,
        marginBottom: 20,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212c6b',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#000000',
    },
    formContainer: {
        paddingHorizontal: 30,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 55,
        fontSize: 16,
        color: '#343a40',
    },
    eyeIcon: {
        padding: 5,
        marginLeft: 10,
    },
    optionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    rememberMeCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rememberMeText: {
        marginLeft: 8,
        color: '#495057',
        fontSize: 14,
    },
    forgotPassword: {
        paddingVertical: 5,
    },
    forgotPasswordText: {
        color: '#212c6b',
        fontSize: 14,
        fontWeight: '500',
    },
    loginButton: {
        backgroundColor: '#212c6b',
        height: 55,
        borderRadius: 10,
        marginBottom: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#212c6b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    loginButtonDisabled: {
        backgroundColor: '#6c757d',
        shadowColor: '#6c757d',
        shadowOpacity: 0.2,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    footerText: {
        color: '#000000',
        fontSize: 12,
        marginBottom: 5,
    },
    versionText: {
        color: '#000000',
        fontSize: 12,
    },
});

export default LoginScreen;