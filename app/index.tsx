import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';

export default function LoginScreen() {
  const { signIn, session, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Redirect to onboarding if not completed, or to tabs if authenticated
  useEffect(() => {
    if (authLoading) return;
    if (session) {
      router.replace('/(tabs)');
      return;
    }
    AsyncStorage.getItem('@onboarding_complete').then((val) => {
      if (val !== 'true') {
        router.replace('/onboarding');
      } else {
        setOnboardingChecked(true);
      }
    }).catch(err => console.warn('[Root] AsyncStorage error:', err));
  }, [session, authLoading]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      setErrorMsg(error);
    }
    // On success, useEffect above handles navigation via session change
  };

  const handleSocialLogin = (provider: string) => {
    // Social login to be implemented later
    console.log(`Login with ${provider}`);
  };

  // Don't render login UI until we've confirmed onboarding is complete
  if (!onboardingChecked) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Enter your credentials to continue</Text>
          </View>
        </FadeInView>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <FadeInView delay={100} direction="bottom">
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
          </FadeInView>

          {/* Password Input */}
          <FadeInView delay={200} direction="bottom">
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
                <AnimatedPressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  scaleDown={0.88}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={24}
                    color="#71717A"
                  />
                </AnimatedPressable>
              </View>
            </View>
          </FadeInView>

          {/* Forgot Password */}
          <FadeInView delay={280} direction="none">
            <AnimatedPressable style={styles.forgotPassword} scaleDown={0.94}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </AnimatedPressable>
          </FadeInView>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Sign In Button */}
          <FadeInView delay={320} direction="bottom">
            <AnimatedPressable
              style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              scaleDown={0.97}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </AnimatedPressable>
          </FadeInView>
        </View>

        {/* Divider */}
        <FadeInView delay={380} direction="none">
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>
        </FadeInView>

        {/* Social Login Buttons */}
        <FadeInView delay={420} direction="bottom">
          <View style={styles.socialButtons}>
            <AnimatedPressable
              style={styles.socialButton}
              onPress={() => handleSocialLogin('Apple')}
              scaleDown={0.97}
            >
              <View style={styles.appleIcon}>
                <Ionicons name="logo-apple" size={20} color="#18181B" />
              </View>
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.socialButton}
              onPress={() => handleSocialLogin('Google')}
              scaleDown={0.97}
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.socialButton}
              onPress={() => handleSocialLogin('Facebook')}
              scaleDown={0.97}
            >
              <View style={styles.facebookIconContainer}>
                <Ionicons name="logo-facebook" size={20} color="#1877F2" />
              </View>
              <Text style={styles.socialButtonText}>Continue with Facebook</Text>
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* OR Divider */}
        <FadeInView delay={460} direction="none">
          <Text style={styles.orText}>OR</Text>
        </FadeInView>

        {/* Sign Up Link */}
        <FadeInView delay={500} direction="bottom">
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <Link href="/signup" asChild>
              <AnimatedPressable scaleDown={0.94}>
                <Text style={styles.signUpLink}>Sign up</Text>
              </AnimatedPressable>
            </Link>
          </View>
        </FadeInView>

        {/* Quote */}
        <FadeInView delay={560} direction="bottom">
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>
              "In trading and betting, discipline beats emotion every time."
            </Text>
          </View>
        </FadeInView>
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
    marginBottom: 60,
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
    marginBottom: 24,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 32,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
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
  signInButton: {
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
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginHorizontal: 16,
    letterSpacing: 0.5,
  },
  socialButtons: {
    gap: 16,
    marginBottom: 20,
  },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  appleIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  facebookIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  orText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 20,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  signUpText: {
    fontSize: 15,
    color: '#71717A',
    fontWeight: '400',
  },
  signUpLink: {
    fontSize: 15,
    color: '#18181B',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  quoteContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
  },
  quoteText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
});
