import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Image, ActivityIndicator,
  TextInput, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import { PulsingBlob } from './SplitAuthCard';

const LOGO      = require('../../assets/images/skillsphere-logo.png');
const ORANGE    = '#F68B3C';
const FREDOKA = Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold';

const getColors = (isDark) => ({
  bg:             isDark ? '#0F0F1E'                : '#EEF0FF',
  webBg:          isDark ? 'linear-gradient(135deg,#0F0F1E 0%,#1A1A2E 50%,#0F1628 100%)' : 'linear-gradient(135deg,#EEF0FF 0%,#F0F2FF 50%,#E8EEFF 100%)',
  cardBg:         isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
  cardBorder:     isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(26,26,46,0.08)',
  textPrimary:    isDark ? '#FFFFFF'                : '#1A1A2E',
  textSecondary:  isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)',
  otpBg:          isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.04)',
  otpBorder:      isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.15)',
  otpText:        isDark ? '#FFFFFF'                : '#1A1A2E',
  resendText:     isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(26,26,46,0.5)',
  resendDisabled: isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(26,26,46,0.3)',
  errorBg:        isDark ? 'rgba(255,107,107,0.12)' : 'rgba(239,68,68,0.08)',
  errorBorder:    isDark ? 'rgba(255,107,107,0.25)' : 'rgba(239,68,68,0.2)',
});

const LoginOTPScreen = ({ route, navigation }) => {
  const params = route?.params || {};
  const email  = params.email || '';
  const { loginWithOTP, sendLoginOTP, isLoading } = useAuth();
  const { isDark } = useTheme();
  const C = getColors(isDark);

  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [error, setError]       = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending]   = useState(false);
  const refs = useRef([]);

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setInterval(() => setResendCooldown(p => p <= 1 ? 0 : p - 1), 1000);
      return () => clearInterval(t);
    }
  }, [resendCooldown]);

  const handleChange = (val, i) => {
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKey = (key, i) => {
    if (key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
    if (key === 'Enter') handleVerify();
  };

  const handleVerify = async () => {
    setError('');
    const code = otp.join('');
    if (code.length !== 6) return setError('Please enter the complete 6-digit code');
    setVerifying(true);
    try {
      const result = await loginWithOTP(email, code);
      setVerifying(false);
      if (!result.success) setError(result.error || 'Invalid verification code');
    } catch (err) { setVerifying(false); setError(err.message || 'Login failed'); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(''); setSending(true);
    try {
      const result = await sendLoginOTP(email);
      setSending(false);
      if (result.success) {
        setResendCooldown(60);
        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      } else { setError(result.error || 'Failed to resend code'); }
    } catch (err) { setSending(false); setError(err.message || 'Failed to resend code'); }
  };

  return (
    <View style={[s.root, isWeb ? { background: C.webBg, overflow: 'hidden', height: '100vh' } : { backgroundColor: C.bg }]}>
      <PulsingBlob style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: ORANGE + '1E', top: -80, right: -80 }} duration={3600} />
      <PulsingBlob style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#6366F118', bottom: -60, left: -80 }} duration={4400} delay={900} />
      <PulsingBlob style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70,  backgroundColor: ORANGE + '13', top: '44%', left: -50 }} duration={3100} delay={1700} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
        >
          {/* Top bar */}
          <View style={s.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)' }]}>
              <Icon name="arrow-back" size={18} color={C.textPrimary} />
            </TouchableOpacity>
            <ThemeToggle iconColor={C.textPrimary} />
          </View>

          {/* Centred body */}
          <View style={s.body}>
            <View style={s.brandRow}>
              <Image source={LOGO} style={s.brandLogo} resizeMode="cover" />
              <Text style={[s.brandWordmark, { color: C.textPrimary }]}>SKILL<Text style={{ color: ORANGE }}>SPHERE</Text></Text>
            </View>

            <View style={[s.iconCircle, { backgroundColor: ORANGE + '28', borderColor: ORANGE + '50' }]}>
              <Icon name="mail-unread-outline" size={30} color={ORANGE} />
            </View>
            <Text style={[s.title, { color: C.textPrimary }]}>Check Your Email</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              We sent a 6-digit sign-in code to{'\n'}
              <Text style={{ color: ORANGE, fontWeight: '700' }}>{email}</Text>
            </Text>

            <View style={[s.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
              {!!error && (
                <View style={[s.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                  <Icon name="alert-circle" size={16} color="#EF4444" />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}
              <View style={s.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={r => refs.current[i] = r}
                    style={[s.otpBox, { color: C.otpText, borderColor: digit ? ORANGE : C.otpBorder, backgroundColor: digit ? ORANGE + '15' : C.otpBg }]}
                    value={digit}
                    onChangeText={v => handleChange(v.replace(/[^0-9]/g, ''), i)}
                    onKeyPress={({ nativeEvent }) => handleKey(nativeEvent.key, i)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={handleVerify} disabled={verifying || isLoading} activeOpacity={0.85}>
                {verifying || isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="log-in-outline" size={16} color="#FFFFFF" />
                    <Text style={s.primaryBtnText}>Sign In</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={s.resendRow}>
                <Text style={[s.resendText, { color: C.resendText }]}>Didn't receive the code? </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0 || sending}>
                  <Text style={[s.resendLink, { color: resendCooldown > 0 ? C.resendDisabled : ORANGE }]}>
                    {sending ? 'Sending...' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.changeRow} onPress={() => navigation.goBack()}>
                <Icon name="arrow-back" size={14} color={ORANGE} />
                <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '600' }}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1 },
  kav:          { flex: 1 },
  scroll:       { flexGrow: 1, justifyContent: 'center' },
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 20, paddingBottom: 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  body:         { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 60 },
  brandRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  brandLogo:    { width: 34, height: 34, borderRadius: 10 },
  brandWordmark:{ fontFamily: FREDOKA, fontWeight: '700', fontSize: 16, letterSpacing: 1.2 },
  iconCircle:   { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  title:        { fontSize: 24, fontWeight: '900', marginBottom: 8, textAlign: 'center', letterSpacing: 0.2 },
  subtitle:     { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  card:         { width: '100%', maxWidth: 440, borderRadius: 24, borderWidth: 1, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  errorText:    { flex: 1, color: '#EF4444', fontSize: 13 },
  otpRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox:       { width: 46, height: 56, borderRadius: 12, borderWidth: 2, textAlign: 'center', fontSize: 24, fontWeight: '800' },
  primaryBtn:   { paddingVertical: 13, paddingHorizontal: 28, borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.12 },
  resendRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  resendText:   { fontSize: 13 },
  resendLink:   { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  changeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
});

export default LoginOTPScreen;
