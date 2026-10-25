import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import MainLayout from '../../components/ui/MainLayout';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import UserAvatar from '../../components/ui/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';

const SettingsScreen = () => {
  const { logout, user, updateProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const fileInputRef = useRef(null);

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;
  const maxWidth = isWeb && width > 1200 ? 1200 : '100%';

  // Profile edit state
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAge, setEditAge] = useState(user?.age ? String(user.age) : '');
  const [editQualification, setEditQualification] = useState(user?.qualification || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const isStudent = user?.role === 'student';
  const [uploadingPhoto, setUploadingPhoto] = useState(false);


  const sidebarItems = getSidebarItems(user?.role);
  const isAdmin = user?.role === 'admin';

  const handleNavigate = (route) => {
    if (isAdmin) {
      if (route === 'ManageInstructors') navigation.navigate('ManageUsers', { userType: 'instructor' });
      else if (route === 'Categories') navigation.navigate('CategoryManagement');
      else navigation.navigate(route);
    } else {
      navigation.navigate(route);
    }
  };

  const getRoleLabel = () => {
    if (user?.role === 'admin') return 'Admin';
    if (user?.role === 'instructor') return 'Instructor';
    if (user?.role === 'expert') return 'Expert';
    return 'Student';
  };

  // ── Photo upload ────────────────────────────────────────────────────────────

  const handlePickPhoto = () => {
    if (isWeb && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      Toast.show({ type: 'info', text1: 'Web Only', text2: 'Photo upload is available in the web app.' });
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.show({ type: 'error', text1: 'Invalid File', text2: 'Please select an image file.' });
      return;
    }

    setUploadingPhoto(true);
    try {
      // Resize to max 256×256 and convert to base64 JPEG in the browser
      const base64 = await new Promise((resolve, reject) => {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 256;
          const scale = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')); };
        img.src = objectUrl;
      });

      const result = await updateProfile({ profilePicture: base64 });
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Photo Updated', text2: 'Your profile picture has been saved.' });
      } else {
        throw new Error(result.error || 'Failed to save photo');
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message || 'Could not upload photo.' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Save profile ─────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Name cannot be empty.' });
      return;
    }
    setSavingProfile(true);
    try {
      const result = await updateProfile({
        name: editName.trim(),
        phone: editPhone.trim() || null,
        ...(isStudent && {
          age: editAge.trim() ? parseInt(editAge.trim(), 10) : null,
          qualification: editQualification.trim() || null,
        }),
      });
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Profile Saved', text2: 'Your profile has been updated.' });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to update profile.' });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword', { email: user?.email, fromSettings: true });
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Settings"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: getRoleLabel(), avatar: user?.profilePicture }}
      onLogout={logout}
      onSettings={() => {}}
    >
      {/* Hidden web file input */}
      {isWeb && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { maxWidth, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header Banner */}
        <View style={[styles.pageHeaderBanner, { backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)', borderColor: 'rgba(255,140,66,0.15)' }]}>
          <View style={styles.bannerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.bannerIconCircle}>
              <Icon name="settings" size={22} color={ORANGE} />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>Account Settings</Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>Manage your profile and security</Text>
            </View>
          </View>
        </View>

        {/* ── Profile Card ── */}
        <View style={[styles.profileCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)' }]}>
          {/* Avatar + upload button */}
          <View style={styles.avatarWrapper}>
            <UserAvatar user={user} size={80} borderColor={ORANGE + '50'} />
            <TouchableOpacity
              style={[styles.cameraBtn, { backgroundColor: ORANGE }]}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="camera" size={14} color="#fff" />
              }
            </TouchableOpacity>
          </View>

          <View style={[styles.profileTextBlock, { alignItems: isTablet ? 'flex-start' : 'center' }]}>
            <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>{user?.name || 'User'}</Text>
            {user?.email ? <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>{user.email}</Text> : null}
            {user?.phone ? <Text style={[styles.profilePhone, { color: theme.colors.textTertiary }]}>{user.phone}</Text> : null}
          </View>

          <View style={[styles.roleBadge, { backgroundColor: ORANGE + '18', borderColor: ORANGE + '35' }]}>
            <Text style={[styles.roleBadgeText, { color: ORANGE }]}>{getRoleLabel()}</Text>
          </View>
        </View>

        {/* ── Edit Profile Card ── */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)' }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.05)' }]}>
              <Icon name="person" size={18} color={theme.colors.textSecondary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Edit Profile</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Update your name and phone number</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)' }]} />

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Icon name="person-outline" size={14} color={theme.colors.textTertiary} />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Full Name</Text>
            </View>
            <AppInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Icon name="call-outline" size={14} color={theme.colors.textTertiary} />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Phone Number <Text style={{ color: theme.colors.textTertiary }}>(optional)</Text></Text>
            </View>
            <AppInput
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. +1 234 567 8900"
              keyboardType="phone-pad"
            />
          </View>

          {isStudent && (
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Icon name="calendar-outline" size={14} color={theme.colors.textTertiary} />
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Age <Text style={{ color: theme.colors.textTertiary }}>(optional)</Text></Text>
              </View>
              <AppInput
                value={editAge}
                onChangeText={setEditAge}
                placeholder="e.g. 22"
                keyboardType="numeric"
              />
            </View>
          )}

          {isStudent && (
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Icon name="school-outline" size={14} color={theme.colors.textTertiary} />
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Qualification <Text style={{ color: theme.colors.textTertiary }}>(optional)</Text></Text>
              </View>
              <AppInput
                value={editQualification}
                onChangeText={setEditQualification}
                placeholder="e.g. Bachelor's in Computer Science"
              />
            </View>
          )}

          <AppButton
            title={savingProfile ? 'Saving…' : 'Save Profile'}
            onPress={handleSaveProfile}
            variant="primary"
            style={styles.actionButton}
            disabled={savingProfile}
            icon={<Icon name="checkmark" size={14} color="#fff" />}
            iconPosition="left"
          />
        </View>

        {/* ── Change Password Card ── */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)' }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.05)' }]}>
              <Icon name="lock-closed" size={18} color={theme.colors.textSecondary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Change Password</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Keep your account secure</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)' }]} />

          <Text style={[styles.passwordDescription, { color: theme.colors.textSecondary }]}>
            We'll send a verification code to your email address to confirm it's you before setting a new password.
          </Text>

          <AppButton
            title="Change Password"
            onPress={handleForgotPassword}
            variant="primary"
            style={styles.actionButton}
            icon={<Icon name="key" size={14} color="#fff" />}
            iconPosition="left"
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', borderColor: isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)' }]}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Icon name="log-out" size={20} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isLargeScreen, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { padding: isMobile ? 16 : 24, paddingBottom: 48 },

    pageHeaderBanner: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isTablet ? 'center' : 'flex-start',
      padding: isMobile ? 16 : 20,
      marginBottom: 24,
      borderRadius: 16,
      borderWidth: 1,
      gap: 12,
    },
    bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: isTablet ? 1 : undefined },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    bannerIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,140,66,0.15)', justifyContent: 'center', alignItems: 'center' },
    bannerTextGroup: { flex: 1 },
    pageTitle: { fontSize: isMobile ? 18 : 22, fontWeight: '700', marginBottom: 2 },
    pageSubtitle: { fontSize: 13 },

    profileCard: {
      flexDirection: isTablet ? 'row' : 'column',
      alignItems: 'center',
      gap: 16,
      padding: isMobile ? 20 : 24,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 20,
      ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
    },
    avatarWrapper: { position: 'relative' },
    cameraBtn: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    profileTextBlock: { flex: isTablet ? 1 : undefined },
    profileName: { fontSize: isMobile ? 18 : 20, fontWeight: '700', marginBottom: 3 },
    profileEmail: { fontSize: 14, marginBottom: 2 },
    profilePhone: { fontSize: 13 },
    roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    roleBadgeText: { fontSize: 13, fontWeight: '600' },

    sectionCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: isMobile ? 18 : 24,
      marginBottom: 20,
      ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    sectionIconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    sectionSubtitle: { fontSize: 12 },
    divider: { height: 1, marginBottom: 20 },

    inputGroup: { marginBottom: 4 },
    inputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    inputLabel: { fontSize: 13, fontWeight: '500' },

    actionButton: { marginTop: 8, marginBottom: 4 },
    passwordDescription: { fontSize: 13, lineHeight: 20, marginBottom: 16 },

    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
    logoutButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
  });

export default SettingsScreen;
