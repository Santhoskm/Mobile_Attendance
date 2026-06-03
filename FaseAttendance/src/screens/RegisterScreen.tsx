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
import { apiService, RegisterCredentials } from '../services/api';

const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [empid, setEmpid] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);

    const handleRegister = async () => {
        // Validation
        if (!empid.trim()) {
            Alert.alert('Error', 'Please enter your Employee ID');
            return;
        }
        if (!username.trim()) {
            Alert.alert('Error', 'Please enter a username');
            return;
        }
        if (!password.trim()) {
            Alert.alert('Error', 'Please enter a password');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long');
            return;
        }
        if (!agreeToTerms) {
            Alert.alert('Error', 'Please agree to the terms and conditions');
            return;
        }

        setIsLoading(true);

        try {
            const credentials: RegisterCredentials = {
                empid: empid.trim(),
                username: username.trim(),
                password: password.trim(),
            };

            console.log('Attempting registration with:', { empid: credentials.empid, username: credentials.username });

            const response = await apiService.register(credentials);

            console.log('Registration response:', response);

            if (response.status === true) {
                Alert.alert(
                    'Success',
                    response.message || 'Registration successful! Please login.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.replace('Login')
                        }
                    ]
                );
            } else {
                Alert.alert('Registration Failed', response.message || 'Registration failed. Please try again.');
            }
        } catch (error: any) {
            console.log("REGISTRATION ERROR:", error);

            let errorMessage = 'Registration failed:\n\n';

            if (error.response?.data) {
                const serverError = error.response.data;
                if (serverError.errors) {
                    // Handle validation errors
                    const errors = Object.values(serverError.errors).flat();
                    errorMessage = errors.join('\n');
                } else if (serverError.message) {
                    errorMessage = serverError.message;
                } else {
                    errorMessage = JSON.stringify(serverError);
                }
            } else if (error.message === 'Network Error') {
                errorMessage = 'Cannot connect to server.\n\nPlease check:\n• Server is running\n• Device can access the IP address\n• You are on the correct network';
            } else {
                errorMessage += error.message;
            }

            Alert.alert('Registration Error', errorMessage);
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
                    <Text style={styles.welcomeText}>Create Account</Text>
                    <Text style={styles.subtitle}>Register to get started</Text>
                </View>

                {/* Form Section */}
                <View style={styles.formContainer}>
                    {/* Employee ID Input */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={24} color="#6c757d" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Employee ID"
                            placeholderTextColor="#6c757d"
                            value={empid}
                            onChangeText={setEmpid}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                            returnKeyType="next"
                        />
                    </View>

                    {/* Username Input */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-add-outline" size={24} color="#6c757d" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#6c757d"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                            returnKeyType="next"
                        />
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={24} color="#6c757d" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#6c757d"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            editable={!isLoading}
                            returnKeyType="next"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={24} color="#6c757d" />
                        </TouchableOpacity>
                    </View>

                    {/* Confirm Password Input */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={24} color="#6c757d" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            placeholderTextColor="#6c757d"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            editable={!isLoading}
                            returnKeyType="done"
                            onSubmitEditing={handleRegister}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                            <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={24} color="#6c757d" />
                        </TouchableOpacity>
                    </View>

                    {/* Terms and Conditions */}
                    <TouchableOpacity
                        style={styles.termsContainer}
                        onPress={() => setAgreeToTerms(!agreeToTerms)}
                        disabled={isLoading}
                    >
                        <Ionicons
                            name={agreeToTerms ? 'checkbox-outline' : 'square-outline'}
                            size={20}
                            color="#007bff"
                        />
                        <Text style={styles.termsText}>
                            I agree to the <Text style={styles.termsLink}>Terms and Conditions</Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Register Button */}
                    <TouchableOpacity
                        style={[
                            styles.registerButton,
                            (isLoading || !empid || !username || !password || !confirmPassword || !agreeToTerms) &&
                            styles.registerButtonDisabled
                        ]}
                        onPress={handleRegister}
                        disabled={isLoading || !empid || !username || !password || !confirmPassword || !agreeToTerms}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.registerButtonText}>  Creating Account...</Text>
                            </View>
                        ) : (
                            <View style={styles.buttonContent}>
                                <Text style={styles.registerButtonText}>Register</Text>
                                <Ionicons name="arrow-forward-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Login Link */}
                    <View style={styles.loginContainer}>
                        <Text style={styles.loginText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
                            <Text style={styles.loginLink}>Sign In</Text>
                        </TouchableOpacity>
                    </View>

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
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 15,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#007bff',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#6c757d',
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
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
        marginTop: 5,
    },
    termsText: {
        marginLeft: 10,
        color: '#495057',
        fontSize: 14,
    },
    termsLink: {
        color: '#007bff',
        fontWeight: 'bold',
    },
    registerButton: {
        backgroundColor: '#28a745',
        height: 55,
        borderRadius: 10,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#28a745',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    registerButtonDisabled: {
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
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    loginText: {
        color: '#6c757d',
        fontSize: 14,
    },
    loginLink: {
        color: '#007bff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    footerText: {
        color: '#6c757d',
        fontSize: 12,
        marginBottom: 5,
    },
    versionText: {
        color: '#6c757d',
        fontSize: 12,
    },
});

export default RegisterScreen;