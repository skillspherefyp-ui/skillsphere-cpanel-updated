import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import UserAvatar from '../../components/ui/UserAvatar';
import PasswordStrengthChecker from '../../components/ui/PasswordStrengthChecker';

const LOGO   = require('../../assets/images/skillsphere-logo.png');
const ORANGE = '#F68B3C';

const getColors = (isDark) => ({
  bg:               isDark ? '#0F0F1E'                                                          : '#EEF0FF',
  webBg:            isDark ? 'linear-gradient(135deg,#0F0F1E 0%,#1A1A2E 50%,#0F1628 100%)'    : 'linear-gradient(135deg,#EEF0FF 0%,#F0F2FF 50%,#E8EEFF 100%)',
  cardBg:           isDark ? 'rgba(255,255,255,0.06)'   : '#FFFFFF',
  cardBorder:       isDark ? 'rgba(255,255,255,0.1)'    : 'rgba(26,26,46,0.08)',
  textPrimary:      isDark ? '#FFFFFF'                  : '#1A1A2E',
  textSecondary:    isDark ? 'rgba(255,255,255,0.55)'   : 'rgba(26,26,46,0.55)',
  inputBg:          isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(26,26,46,0.04)',
  inputBorder:      isDark ? 'rgba(255,255,255,0.12)'   : 'rgba(26,26,46,0.1)',
  inputText:        isDark ? '#FFFFFF'                  : '#1A1A2E',
  inputPlaceholder: isDark ? 'rgba(255,255,255,0.3)'    : 'rgba(26,26,46,0.3)',
  inputIcon:        isDark ? 'rgba(255,255,255,0.4)'    : 'rgba(26,26,46,0.4)',
  successBg:        isDark ? 'rgba(16,185,129,0.12)'    : 'rgba(16,185,129,0.08)',
  successBorder:    isDark ? 'rgba(16,185,129,0.25)'    : 'rgba(16,185,129,0.2)',
  errorBg:          isDark ? 'rgba(255,107,107,0.12)'   : 'rgba(239,68,68,0.08)',
  errorBorder:      isDark ? 'rgba(255,107,107,0.25)'   : 'rgba(239,68,68,0.2)',
  terms:            isDark ? 'rgba(255,255,255,0.35)'   : 'rgba(26,26,46,0.35)',
  backBtn:          isDark ? 'rgba(255,255,255,0.1)'    : 'rgba(26,26,46,0.1)',
  logoText:         isDark ? '#FFFFFF'                  : '#1A1A2E',
});

const AuthInput = ({ icon, placeholder, value, onChangeText, secureTextEntry,
  keyboardType = 'default', autoCapitalize = 'none', right, C }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[inp.wrap, {
      backgroundColor: C.inputBg,
      borderColor: focused ? ORANGE : C.inputBorder,
    }]}>
      <Icon name={icon} size={18} color={focused ? ORANGE : C.inputIcon} />
      <TextInput
        style={[inp.field, { color: C.inputText }]}
        placeholder={placeholder}
        placeholderTextColor={C.inputPlaceholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {right}
    </View>
  );
};
const inp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  field: { flex: 1, fontSize: 14, outlineStyle: 'none' },
});

const SignupDetailsScreen = ({ route, navigation }) => {
  const params = route?.params || {};
  const email  = params.email || '';
  const name   = params.name  || '';
  const { completeRegistration, isLoading } = useAuth();
  const { isDark } = useTheme();
  const C = getColors(isDark);
  const { width } = useWindowDimensions();

  const [password, setPassword]         = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [phone, setPhone]               = useState('');
  const [age, setAge]                   = useState('');
  const [qualification, setQualification] = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [error, setError]               = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const isWeb = Platform.OS === 'web';

  const handlePickPhoto = () => {
    if (isWeb && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setUploadingPhoto(true);
    try {
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
      setProfilePicture(base64);
    } catch {}
    finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pwChecks = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    number:  /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const pwStrong = Object.values(pwChecks).every(Boolean);

  const handleComplete = async () => {
    setError('');
    if (!password)              return setError('Please enter a password');
    if (!pwChecks.length)       return setError('Password must be at least 8 characters');
    if (!pwChecks.upper)        return setError('Password must contain at least one uppercase letter');
    if (!pwChecks.lower)        return setError('Password must contain at least one lowercase letter');
    if (!pwChecks.number)       return setError('Password must contain at least one number');
    if (!pwChecks.special)      return setError('Password must contain at least one special character');
    if (password !== confirmPw) return setError('Passwords do not match');
    try {
      const result = await completeRegistration(email, password, name, phone || null, age ? parseInt(age, 10) : null, qualification || null, profilePicture || null);
      if (!result.success) setError(result.error || 'Registration failed');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  const bg = isWeb ? { background: C.webBg } : { backgroundColor: C.bg };

  return (
    <View style={[s.container, bg]}>
      <View style={[s.glow1, { backgroundColor: ORANGE + '0C' }]} />
      <View style={[s.glow2, { backgroundColor: '#10B981' + (isDark ? '0A' : '08') }]} />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: C.backBtn }]}>
          <Icon name="arrow-back" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={LOGO} style={s.logoImg} resizeMode="cover" />
          <Text style={[s.logoText, { color: C.logoText }]}>SKILL<Text style={{ color: ORANGE }}>SPHERE</Text></Text>
        </View>
        <ThemeToggle iconColor={C.textPrimary} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={s.brandHeader}>
            <View style={[s.iconCircle, { backgroundColor: '#10B981' + '20', borderColor: '#10B981' + '50' }]}>
              <Icon name="checkmark-circle" size={36} color="#10B981" />
            </View>
            <Text style={[s.title, { color: C.textPrimary }]}>Almost Done!</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Email verified for{' '}
              <Text style={{ color: ORANGE, fontWeight: '700' }}>{name}</Text>
              {'\n'}Set a password to complete your account
            </Text>
          </View>

          <View style={[s.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder, maxWidth: 440, alignSelf: 'center', width: '100%' }]}>

            {/* Photo picker */}
            {isWeb && (
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />
            )}
            <TouchableOpacity style={s.avatarPicker} onPress={handlePickPhoto} activeOpacity={0.8}>
              {uploadingPhoto ? (
                <View style={[s.avatarPlaceholder, { borderColor: C.inputBorder }]}>
                  <ActivityIndicator color={ORANGE} />
                </View>
              ) : profilePicture ? (
                <View style={{ position: 'relative' }}>
                  <UserAvatar user={{ name, profilePicture }} size={72} borderColor={ORANGE} />
                  <View style={s.avatarEditBadge}>
                    <Icon name="camera" size={12} color="#FFF" />
                  </View>
                </View>
              ) : (
                <View style={[s.avatarPlaceholder, { borderColor: C.inputBorder, backgroundColor: C.inputBg }]}>
                  <Icon name="camera-outline" size={22} color={C.inputIcon} />
                  <Text style={[s.avatarLabel, { color: C.textSecondary }]}>Add Photo{'\n'}(optional)</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Success banner */}
            <View style={[s.successBanner, { backgroundColor: C.successBg, borderColor: C.successBorder }]}>
              <Icon name="checkmark-circle" size={18} color="#10B981" />
              <Text style={s.successText}>Email verified successfully!</Text>
            </View>

            {!!error && (
              <View style={[s.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                <Icon name="alert-circle" size={16} color="#EF4444" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <AuthInput C={C} icon="call-outline" placeholder="Phone number (optional)" value={phone}
              onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" />

            <AuthInput C={C} icon="calendar-outline" placeholder="Age (optional)" value={age}
              onChangeText={setAge} keyboardType="numeric" autoCapitalize="none" />

            <AuthInput C={C} icon="school-outline" placeholder="Qualification (optional)" value={qualification}
              onChangeText={setQualification} autoCapitalize="words" />

            <AuthInput C={C} icon="lock-closed-outline" placeholder="Create password" value={password}
              onChangeText={t => { setPassword(t); setError(''); }} secureTextEntry={!showPw}
              right={
                <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                  <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.inputIcon} />
                </TouchableOpacity>
              } />

            {password.length > 0 && (
              <PasswordStrengthChecker pwChecks={pwChecks} isDark={isDark} />
            )}

            <AuthInput C={C} icon="lock-closed-outline" placeholder="Confirm password" value={confirmPw}
              onChangeText={t => { setConfirmPw(t); setError(''); }} secureTextEntry={!showPw} />

            <TouchableOpacity style={s.primaryBtn} onPress={handleComplete} disabled={isLoading} activeOpacity={0.85}>
              {isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="rocket-outline" size={16} color="#FFFFFF" />
                    <Text style={s.primaryBtnText}>Create Account</Text>
                  </View>
                )}
            </TouchableOpacity>

            <Text style={[s.terms, { color: C.terms }]}>
              By creating an account, you agree to our{' '}
              <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
              {'. '}You will also be subscribed to the SkillSphere newsletter for updates, new courses, and learning tips. You can unsubscribe at any time.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  glow1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -60, right: -50, zIndex: 0 },
  glow2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, bottom: 60, left: -70, zIndex: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, zIndex: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  logoImg: { width: 28, height: 28, borderRadius: 7 },
  logoText: { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  brandHeader: { alignItems: 'center', paddingVertical: 32 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 10 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 24, borderWidth: 1, padding: 24 },
  successBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 20 },
  successText: { color: '#10B981', fontSize: 13, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: '#EF4444', fontSize: 13 },
  primaryBtn: { paddingVertical: 13, paddingHorizontal: 28, borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.12 },
  terms:           { fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 18 },
  avatarPicker:    { alignItems: 'center', marginBottom: 20 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 },
  avatarLabel:     { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: ORANGE, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
});

export default SignupDetailsScreen;
