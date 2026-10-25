import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Image, ActivityIndicator,
  useWindowDimensions, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import ThemeToggle from '../../components/ThemeToggle';
import { signInWithGoogle, configureGoogleSignIn } from '../../services/googleAuthService';
import { SplitAuthCard, MobileAuthCard } from './SplitAuthCard';

const LOGO   = require('../../assets/images/skillsphere-logo.png');
const ORANGE = '#FF8C42';
const NAVY   = '#1A1A2E';

const getColors = (isDark) => ({
  bg:              isDark ? '#0F0F1E'                      : '#EEF0FF',
  webBg:           isDark
    ? 'linear-gradient(135deg,#0F0F1E 0%,#1A1A2E 50%,#0F1628 100%)'
    : 'linear-gradient(135deg,#EEF0FF 0%,#F0F2FF 50%,#E8EEFF 100%)',
  cardBg:          isDark ? 'rgba(255,255,255,0.06)'       : '#FFFFFF',
  cardBorder:      isDark ? 'rgba(255,255,255,0.1)'        : 'rgba(26,26,46,0.08)',
  textPrimary:     isDark ? '#FFFFFF'                      : NAVY,
  textSecondary:   isDark ? 'rgba(255,255,255,0.55)'       : 'rgba(26,26,46,0.55)',
  inputBg:         isDark ? 'rgba(255,255,255,0.06)'       : 'rgba(26,26,46,0.04)',
  inputBorder:     isDark ? 'rgba(255,255,255,0.12)'       : 'rgba(26,26,46,0.1)',
  inputText:       isDark ? '#FFFFFF'                      : NAVY,
  inputPlaceholder:isDark ? 'rgba(255,255,255,0.3)'        : 'rgba(26,26,46,0.3)',
  inputIcon:       isDark ? 'rgba(255,255,255,0.4)'        : 'rgba(26,26,46,0.4)',
  divider:         isDark ? 'rgba(255,255,255,0.1)'        : 'rgba(26,26,46,0.1)',
  dividerText:     isDark ? 'rgba(255,255,255,0.4)'        : 'rgba(26,26,46,0.4)',
  googleBg:        isDark ? 'rgba(255,255,255,0.07)'       : 'rgba(26,26,46,0.04)',
  googleBorder:    isDark ? 'rgba(255,255,255,0.12)'       : 'rgba(26,26,46,0.1)',
  googleText:      isDark ? 'rgba(255,255,255,0.85)'       : 'rgba(26,26,46,0.85)',
  footerText:      isDark ? 'rgba(255,255,255,0.5)'        : 'rgba(26,26,46,0.5)',
  terms:           isDark ? 'rgba(255,255,255,0.35)'       : 'rgba(26,26,46,0.35)',
  errorBg:         isDark ? 'rgba(255,107,107,0.12)'       : 'rgba(239,68,68,0.08)',
  errorBorder:     isDark ? 'rgba(255,107,107,0.25)'       : 'rgba(239,68,68,0.2)',
  tabsBg:          isDark ? 'rgba(0,0,0,0.3)'             : 'rgba(26,26,46,0.07)',
  tabInactive:     isDark ? 'rgba(255,255,255,0.5)'        : 'rgba(26,26,46,0.45)',
  otpHint:         isDark ? 'rgba(255,255,255,0.5)'        : 'rgba(26,26,46,0.5)',
  backBtn:         isDark ? 'rgba(255,255,255,0.1)'        : 'rgba(26,26,46,0.1)',
  logoText:        isDark ? '#FFFFFF'                      : NAVY,
});

const AuthInput = ({ icon, placeholder, value, onChangeText, secureTextEntry,
  keyboardType = 'default', autoCapitalize = 'none', right, C, onSubmit }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.inputWrap, {
      backgroundColor: C.inputBg,
      borderColor: focused ? ORANGE : C.inputBorder,
    }]}>
      <Icon name={icon} size={18} color={focused ? ORANGE : C.inputIcon} />
      <TextInput
        style={[s.inputField, { color: C.inputText }]}
        placeholder={placeholder}
        placeholderTextColor={C.inputPlaceholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        returnKeyType={onSubmit ? 'go' : 'done'}
        onKeyPress={(e) => {
          if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
            e.preventDefault?.();
            onSubmit?.();
          }
        }}
      />
      {right}
    </View>
  );
};

const LoginScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const C = getColors(isDark);
  const { width } = useWindowDimensions();
  const { login, sendLoginOTP, googleSignIn, isLoading } = useAuth();
  const toast = useToast();

  const [mode, setMode]             = useState('password');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isWeb   = Platform.OS === 'web';
  const isSplit = isWeb && width >= 720;

  useEffect(() => { configureGoogleSignIn(); }, []);

  const handlePasswordLogin = async () => {
    setError('');
    if (!email.trim()) return setError('Please enter your email address');
    if (!password)     return setError('Please enter your password');
    const result = await login(email.trim().toLowerCase(), password);
    if (!result.success) {
      if (result.error?.toLowerCase().includes('locked')) {
        toast.error('Account Locked', 'Too many failed attempts. Try again in 15 minutes.');
      } else {
        setError(result.error || 'Login failed. Please check your credentials.');
      }
    }
  };

  const handleSendOTP = async () => {
    setError('');
    if (!email.trim()) return setError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address');
    setSendingOTP(true);
    try {
      const result = await sendLoginOTP(email.trim().toLowerCase());
      setSendingOTP(false);
      if (result.success) {
        navigation.navigate('LoginOTP', { email: email.trim().toLowerCase() });
      } else {
        setError(result.error?.includes('not found')
          ? 'No account found with this email. Please sign up first.'
          : result.error || 'Failed to send verification code');
      }
    } catch (err) { setSendingOTP(false); setError(err.message || 'Failed to send verification code'); }
  };

  const handleGoogle = async () => {
    setError(''); setGoogleLoading(true);
    try {
      const gr = await signInWithGoogle();
      if (!gr.success) { setGoogleLoading(false); if (gr.error !== 'Sign in was cancelled') setError(gr.error); return; }
      const result = await googleSignIn(gr.idToken);
      setGoogleLoading(false);
      if (!result.success) { setError(result.error || 'Google sign in failed'); return; }
      if (result.isNewUser) navigation.navigate('GoogleProfileCompletion', { user: result.user });
    } catch (err) { setGoogleLoading(false); setError('Google sign in failed. Please try again.'); }
  };

  // ─── Split layout: delegate to animated SplitAuthCard ──────────────────────
  if (isSplit) {
    return (
      <View style={[s.container, { background: C.webBg }]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Landing')} style={[s.backBtn, { backgroundColor: C.backBtn }]}>
            <Icon name="arrow-back" size={18} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={LOGO} style={s.logoImg} resizeMode="cover" />
            <Text style={[s.logoText, { color: C.logoText }]}>SKILL<Text style={{ color: ORANGE }}>SPHERE</Text></Text>
          </View>
          <ThemeToggle iconColor={C.textPrimary} />
        </View>
        <View style={s.splitOuter}>
          <SplitAuthCard navigation={navigation} initialMode="login" isDark={isDark} />
        </View>
      </View>
    );
  }

  // ─── Mobile layout ──────────────────────────────────────────────────────────
  return <MobileAuthCard navigation={navigation} initialMode="login" isDark={isDark} />;
};

const s = StyleSheet.create({
  container:   { flex: 1 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, zIndex: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  logoImg:     { width: 28, height: 28, borderRadius: 7 },
  logoText:    { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  splitOuter:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 32 },
  // Mobile
  scroll:      { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  brandHeader: { alignItems: 'center', paddingVertical: 32 },
  iconCircle:  { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  title:       { fontSize: 28, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
  subtitle:    { fontSize: 14, textAlign: 'center' },
  card:        { borderRadius: 24, borderWidth: 1, padding: 24 },
  tabs:        { flexDirection: 'row', borderRadius: 9999, padding: 4, marginBottom: 16, gap: 4 },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9999 },
  tabText:     { fontSize: 13, fontWeight: '700' },
  errorBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  errorText:   { flex: 1, color: '#EF4444', fontSize: 13 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  inputField:  { flex: 1, fontSize: 14, outlineStyle: 'none' },
  otpHint:     { fontSize: 13, textAlign: 'center', marginTop: -4, marginBottom: 16, lineHeight: 20 },
  primaryBtn:  { borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E07028', alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10, shadowColor: '#C96A24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  divLine:     { flex: 1, height: 1 },
  divText:     { fontSize: 12 },
  googleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  googleText:  { fontSize: 13, fontWeight: '700' },
  footer:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText:  { fontSize: 14 },
  footerLink:  { color: '#F68B3C', fontSize: 14, fontWeight: '700' },
  terms:       { fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 16 },
});

export default LoginScreen;
