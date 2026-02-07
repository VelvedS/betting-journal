import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export default function SignupScreen() {
  const { signUp, session, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/(tabs)');
    }
  }, [session, authLoading]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    setIsLoading(false);
    if (error) {
      setErrorMsg(error);
    }
    // On success, useEffect above handles navigation via session change
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to start tracking your bets</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="John Trader"
              placeholderTextColor="#B0B0B0"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#B0B0B0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#B0B0B0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color="#71717A"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#B0B0B0"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color="#71717A"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signUpButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <Link href="/" asChild>
            <TouchableOpacity>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Quote */}
        <View style={styles.quoteContainer}>
          <Text style={styles.quoteText}>
            "In trading and betting, discipline beats emotion every time."
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A4A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1A1A1A',
  },
  eyeButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  signUpButton: {
    backgroundColor: '#5A5A5A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  signInText: {
    fontSize: 15,
    color: '#71717A',
    fontWeight: '400',
  },
  signInLink: {
    fontSize: 15,
    color: '#18181B',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  quoteContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    marginTop: 'auto',
  },
  quoteText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
});
