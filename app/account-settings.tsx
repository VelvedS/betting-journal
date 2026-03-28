/*
 * ─────────────────────────────────────────────────────────────────────────────
 * SQL MIGRATION — run in the Supabase SQL editor before testing:
 *
 *   CREATE TABLE public.profiles (
 *     id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *     full_name   TEXT,
 *     phone       TEXT,
 *     location    TEXT,
 *     avatar_url  TEXT,
 *     updated_at  TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 *
 *   CREATE POLICY "Users can view own profile"
 *     ON public.profiles FOR SELECT USING (auth.uid() = id);
 *   CREATE POLICY "Users can update own profile"
 *     ON public.profiles FOR UPDATE USING (auth.uid() = id);
 *   CREATE POLICY "Users can insert own profile"
 *     ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
 *
 * STORAGE BUCKET — create via Supabase Dashboard > Storage > New bucket:
 *   Name:   avatars
 *   Public: true   (required so getPublicUrl works without auth headers)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';

// ── Types ──

type ToastState = { message: string; type: 'success' | 'error' } | null;

type Profile = {
  full_name: string;
  phone: string;
  location: string;
  avatar_url: string;
};

const EMPTY_PROFILE: Profile = { full_name: '', phone: '', location: '', avatar_url: '' };

// ── Component ──

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<Profile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Toast ──

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setToast(null)
      );
    }, 3000);
  }, [toastOpacity]);

  // ── Fetch Profile ──

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, location, avatar_url')
        .eq('id', user.id)
        .single();

      const loaded: Profile = {
        full_name: data?.full_name || user.user_metadata?.full_name || '',
        phone: data?.phone || '',
        location: data?.location || '',
        avatar_url: data?.avatar_url || '',
      };
      setProfile(loaded);
      setOriginalProfile(loaded);
    } catch {
      // No profile row yet — seed from auth metadata
      const fallback: Profile = {
        full_name: user.user_metadata?.full_name || '',
        phone: '',
        location: '',
        avatar_url: '',
      };
      setProfile(fallback);
      setOriginalProfile(fallback);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  // ── Derived values ──

  const hasChanges = useMemo(
    () =>
      profile.full_name !== originalProfile.full_name ||
      profile.phone !== originalProfile.phone ||
      profile.location !== originalProfile.location,
    [profile, originalProfile]
  );

  const memberSince = useMemo(() => {
    if (!user?.created_at) return '';
    return new Date(user.created_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [user?.created_at]);

  // ── Save ──

  const handleSave = async () => {
    if (!user || !hasChanges || saving) return;
    setSaving(true);
    try {
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: profile.full_name,
        phone: profile.phone,
        location: profile.location,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;

      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: profile.full_name },
      });
      if (metaError) throw metaError;

      setOriginalProfile({ ...profile });
      showToast('Profile saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Photo Upload ──

  const handleUploadPhoto = async () => {
    if (!user || uploading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to upload a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;
      const formData = new FormData();
      formData.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, formData, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      // Bust the CDN cache so the new image loads immediately
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: saveError } = await supabase.from('profiles').upsert({
        id: user.id,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      setOriginalProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      showToast('Photo updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete Account ──

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This will permanently delete all your bets, stats, and account data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              const { data: bets } = await supabase
                .from('bets')
                .select('id')
                .eq('user_id', user.id);

              const betIds = (bets ?? []).map(b => b.id);
              if (betIds.length > 0) {
                await Promise.all([
                  supabase.from('parlay_legs').delete().in('bet_id', betIds),
                  supabase.from('bet_tags').delete().in('bet_id', betIds),
                ]);
              }

              await supabase.from('achievements').delete().eq('user_id', user.id);
              await supabase.from('bets').delete().eq('user_id', user.id);
              await supabase.from('profiles').delete().eq('id', user.id);

              // Step 4: call Edge Function to delete auth user
              const { data: { session } } = await supabase.auth.getSession()
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              )
              if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to delete account')
              }
              await signOut();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  // ── Render ──

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <AnimatedPressable style={styles.backButton} onPress={() => router.back()} scaleDown={0.9}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </AnimatedPressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Account Settings</Text>
              <Text style={styles.headerSubtitle}>Update your profile information</Text>
            </View>
          </View>
        </FadeInView>

        {/* Card 1 — Profile Photo */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Profile Photo</Text>
            <View style={styles.photoSection}>
              <View style={styles.avatarContainer}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person-outline" size={36} color={colors.iconSecondary} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  {uploading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Ionicons name="camera" size={12} color="#FFFFFF" />
                  }
                </View>
              </View>
              <AnimatedPressable
                style={styles.uploadButton}
                onPress={handleUploadPhoto}
                scaleDown={0.97}
                disabled={uploading}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? 'Uploading…' : 'Upload Photo'}
                </Text>
              </AnimatedPressable>
            </View>
            <Text style={styles.photoRecommendation}>
              Recommended: Square image, at least 400×400px
            </Text>
          </View>
        </FadeInView>

        {/* Card 2 — Personal Information */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Personal Information</Text>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={profile.full_name}
                  onChangeText={v => setProfile(p => ({ ...p, full_name: v }))}
                  placeholder="Your full name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[styles.inputContainer, styles.inputReadOnly]}>
                <Ionicons name="mail-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputTextReadOnly]}
                  value={user?.email ?? ''}
                  editable={false}
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={profile.phone}
                  onChangeText={v => setProfile(p => ({ ...p, phone: v }))}
                  placeholder="Your phone number"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Location</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={profile.location}
                  onChangeText={v => setProfile(p => ({ ...p, location: v }))}
                  placeholder="City, State"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Member Since</Text>
              <View style={[styles.inputContainer, styles.inputReadOnly]}>
                <Ionicons name="calendar-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputTextReadOnly]}
                  value={memberSince}
                  editable={false}
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Save Changes Button */}
        <FadeInView delay={240} direction="bottom">
          <AnimatedPressable
            style={[styles.saveButton, (!hasChanges || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            scaleDown={0.97}
            disabled={!hasChanges || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFFFFF" style={styles.saveIcon} />
              : <Ionicons name="save-outline" size={20} color="#FFFFFF" style={styles.saveIcon} />
            }
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </AnimatedPressable>
        </FadeInView>

        {/* Danger Zone */}
        <FadeInView delay={320} direction="bottom">
          <View style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerDescription}>
              Once you delete your account, there is no going back. Please be certain.
            </Text>
            <AnimatedPressable style={styles.deleteButton} onPress={handleDeleteAccount} scaleDown={0.97}>
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </AnimatedPressable>
          </View>
        </FadeInView>

      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.type === 'error' ? styles.toastError : styles.toastSuccess,
            { opacity: toastOpacity },
          ]}
        >
          <Ionicons
            name={toast.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },

    // Header
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
    backButton: {
      width: 40, height: 40, borderRadius: 20, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.surface,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTextContainer: { flex: 1, paddingTop: 4 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 4 },
    headerSubtitle: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },

    // Card
    card: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },

    // Photo
    photoSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarContainer: { position: 'relative', marginRight: 20 },
    avatarCircle: {
      width: 86, height: 86, borderRadius: 43,
      backgroundColor: colors.iconCircleBg, alignItems: 'center', justifyContent: 'center',
    },
    avatarImage: { width: 86, height: 86, borderRadius: 43 },
    cameraBadge: {
      position: 'absolute', bottom: 2, right: 2, width: 26, height: 26,
      borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center',
      justifyContent: 'center', borderWidth: 2, borderColor: colors.surface,
    },
    uploadButton: {
      backgroundColor: colors.iconCircleBg, borderRadius: 10,
      paddingVertical: 12, paddingHorizontal: 28, height: 44, justifyContent: 'center',
    },
    uploadButtonText: { fontSize: 14, fontWeight: '600', color: colors.text },
    photoRecommendation: { fontSize: 12, fontWeight: '400', color: colors.textTertiary, marginTop: 4 },

    // Form
    formField: { marginBottom: 18 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
      borderRadius: 10, paddingHorizontal: 14, height: 50,
      borderWidth: 1, borderColor: colors.inputBorder,
    },
    inputReadOnly: { opacity: 0.6 },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 14, fontWeight: '400', color: colors.inputText },
    inputTextReadOnly: { color: colors.textSecondary },

    // Save button
    saveButton: {
      backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginBottom: 22, height: 54,
    },
    saveButtonDisabled: { opacity: 0.4 },
    saveIcon: { marginRight: 8 },
    saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

    // Danger zone
    dangerCard: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: '#FFCCCC', padding: 20, marginBottom: 20,
    },
    dangerTitle: { fontSize: 16, fontWeight: '700', color: colors.loss, marginBottom: 8 },
    dangerDescription: {
      fontSize: 13, fontWeight: '400', color: colors.text,
      lineHeight: 19, marginBottom: 16,
    },
    deleteButton: {
      backgroundColor: 'transparent', borderRadius: 10, borderWidth: 1,
      borderColor: colors.loss, paddingVertical: 12,
      alignItems: 'center', justifyContent: 'center', height: 46,
    },
    deleteButtonText: { fontSize: 15, fontWeight: '700', color: colors.loss },

    // Toast
    toast: {
      position: 'absolute', bottom: 40, left: 20, right: 20,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
    },
    toastSuccess: { backgroundColor: colors.accent },
    toastError: { backgroundColor: colors.loss },
    toastText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  });
}
