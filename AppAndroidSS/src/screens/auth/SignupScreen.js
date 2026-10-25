import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Image, ActivityIndicator,
  useWindowDimensions, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import { signInWithGoogle, configureGoogleSignIn } from '../../services/googleAuthService';
import { SplitAuthCard, MobileAuthCard } from './SplitAuthCard';

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
  divider:          isDark ? 'rgba(255,255,255,0.1)'    : 'rgba(26,26,46,0.1)',
  dividerText:      isDark ? 'rgba(255,255,255,0.4)'    : 'rgba(26,26,46,0.4)',
  googleBg:         isDark ? 'rgba(255,255,255,0.07)'   : 'rgba(26,26,46,0.04)',
  googleBorder:     isDark ? 'rgba(255,255,255,0.12)'   : 'rgba(26,26,46,0.1)',
  googleText:       isDark ? 'rgba(255,255,255,0.85)'   : 'rgba(26,26,46,0.85)',
  footerText:       isDark ? 'rgba(255,255,255,0.5)'    : 'rgba(26,26,46,0.5)',
  terms:            isDark ? 'rgba(255,255,255,0.35)'   : 'rgba(26,26,46,0.35)',
  errorBg:          isDark ? 'rgba(255,107,107,0.12)'   : 'rgba(239,68,68,0.08)',
  errorBorder:      isDark ? 'rgba(255,107,107,0.25)'   : 'rgba(239,68,68,0.2)',
  backBtn:          isDark ? 'rgba(255,255,255,0.1)'    : 'rgba(26,26,46,0.1)',
  logoText:         isDark ? '#FFFFFF'                  : '#1A1A2E',
});

const AuthInput = ({ icon, placeholder, value, onChangeText, keyboardType = 'default', autoCapitalize = 'none', right, C, onSubmit }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[inp.wrap, { backgroundColor: C.inputBg, borderColor: focused ? ORANGE : C.inputBorder }]}>
      <Icon name={icon} size={18} color={focused ? ORANGE : C.inputIcon} />
      <TextInput
        style={[inp.field, { color: C.inputText }]}
        placeholder={placeholder}
        placeholderTextColor={C.inputPlaceholder}
        value={value}
        onChangeText={onChangeText}
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
const inp = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  field: { flex: 1, fontSize: 14, outlineStyle: 'none' },
});

const SignupScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const { sendOTP, googleSignIn, isLoading } = useAuth();
  const { isDark } = useTheme();
  const C = getColors(isDark);

  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [error, setError]           = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isWeb   = Platform.OS === 'web';
  const isSplit = isWeb && width >= 720;

  useEffect(() => { configureGoogleSignIn(); }, []);

  const handleSendOTP = async () => {
    setError('');
    if (!name.trim())  return setError('Please enter your full name');
    if (!email.trim()) return setError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address');
    setSendingOTP(true);
    try {
      const result = await sendOTP(email.trim().toLowerCase(), name.trim());
      setSendingOTP(false);
      if (result.success) {
        navigation.navigate('SignupOTP', { email: email.trim().toLowerCase(), name: name.trim() });
      } else {
        setError(result.error || 'Failed to send verification code');
      }
    } catch (err) {
      setSendingOTP(false);
      setError(err.message || 'Failed to send verification code');
    }
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
          <SplitAuthCard navigation={navigation} initialMode="signup" isDark={isDark} />
        </View>
      </View>
    );
  }

  // ─── Mobile layout ──────────────────────────────────────────────────────────
  return <MobileAuthCard navigation={navigation} initialMode="signup" isDark={isDark} />;
};

const s = StyleSheet.create({
  container:   { flex: 1 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, zIndex: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  logoImg:     { width: 42, height: 42, borderRadius: 12 },
  logoText:    { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontWeight: '700', fontSize: 16, letterSpacing: 1 },
  splitOuter:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 32 },
  // Mobile
  scroll:      { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  brandHeader: { alignItems: 'center', paddingVertical: 32 },
  iconCircle:  { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  title:       { fontSize: 28, fontWeight: '900', marginBottom: 8 },
  subtitle:    { fontSize: 14 },
  card:        { borderRadius: 24, borderWidth: 1, padding: 24 },
  errorBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  errorText:   { flex: 1, color: '#EF4444', fontSize: 13 },
  primaryBtn:  { borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E07028', alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10, shadowColor: '#C96A24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  divLine:     { flex: 1, height: 1 },
  divText:     { fontSize: 12 },
  googleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  googleText:  { fontSize: 13, fontWeight: '700' },
  footer:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText:  { fontSize: 14 },
  footerLink:  { color: ORANGE, fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  terms:       { fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 16 },
});

export default SignupScreen;
