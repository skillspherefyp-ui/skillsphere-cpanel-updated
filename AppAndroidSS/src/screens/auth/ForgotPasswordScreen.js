import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput,
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
  bg:               isDark ? '#0F0F1E'                : '#EEF0FF',
  webBg:            isDark ? 'linear-gradient(135deg,#0F0F1E 0%,#1A1A2E 50%,#0F1628 100%)' : 'linear-gradient(135deg,#EEF0FF 0%,#F0F2FF 50%,#E8EEFF 100%)',
  cardBg:           isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
  cardBorder:       isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(26,26,46,0.08)',
  textPrimary:      isDark ? '#FFFFFF'                : '#1A1A2E',
  textSecondary:    isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)',
  label:            isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(26,26,46,0.7)',
  inputBg:          isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
  inputBorder:      isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
  inputText:        isDark ? '#FFFFFF'                : '#1A1A2E',
  inputPlaceholder: isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(26,26,46,0.3)',
  inputIcon:        isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(26,26,46,0.4)',
  footerText:       isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(26,26,46,0.5)',
  errorBg:          isDark ? 'rgba(255,107,107,0.12)' : 'rgba(239,68,68,0.08)',
  errorBorder:      isDark ? 'rgba(255,107,107,0.25)' : 'rgba(239,68,68,0.2)',
  infoBg:           isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,26,46,0.04)',
  infoText:         isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26,26,46,0.45)',
  infoIcon:         isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(26,26,46,0.5)',
});

const AuthInput = ({ icon, placeholder, value, onChangeText, keyboardType = 'default', autoCapitalize = 'none', C, onSubmit }) => {
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
    </View>
  );
};
const inp = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  field: { flex: 1, fontSize: 14, outlineStyle: 'none' },
});

const ForgotPasswordScreen = ({ navigation, route }) => {
  const { forgotPassword, isLoading, user } = useAuth();
  const { isDark } = useTheme();
  const C = getColors(isDark);

  const isFromSettings = route?.params?.fromSettings || false;
  const userEmail = user?.email || route?.params?.email || '';

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (isFromSettings && userEmail) setEmail(userEmail);
  }, [isFromSettings, userEmail]);

  const handleSend = async () => {
    setError('');
    if (!email.trim()) return setError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address');
    const result = await forgotPassword(email.trim().toLowerCase());
    if (result.success) {
      navigation.navigate('OTPVerification', { email: email.trim().toLowerCase(), isPasswordReset: true, fromSettings: isFromSettings });
    } else {
      setError(result.error || 'Failed to send reset code. Please try again.');
    }
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
          <View style={s.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)' }]}>
              <Icon name="arrow-back" size={18} color={C.textPrimary} />
            </TouchableOpacity>
            <ThemeToggle iconColor={C.textPrimary} />
          </View>

          <View style={s.body}>
            <View style={s.brandRow}>
              <Image source={LOGO} style={s.brandLogo} resizeMode="cover" />
              <Text style={[s.brandWordmark, { color: C.textPrimary }]}>SKILL<Text style={{ color: ORANGE }}>SPHERE</Text></Text>
            </View>

            <View style={[s.iconCircle, { backgroundColor: ORANGE + '28', borderColor: ORANGE + '50' }]}>
              <Icon name="lock-open-outline" size={30} color={ORANGE} />
            </View>
            <Text style={[s.title, { color: C.textPrimary }]}>
              {isFromSettings ? 'Reset Password' : 'Forgot Password?'}
            </Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              {isFromSettings
                ? 'Enter your email to receive\na password reset code'
                : "Enter your email and we'll send\nyou a reset code"}
            </Text>

            <View style={[s.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
              {!!error && (
                <View style={[s.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                  <Icon name="alert-circle" size={16} color="#EF4444" />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}
              <Text style={[s.label, { color: C.label }]}>Email Address</Text>
              <AuthInput C={C} icon="mail-outline" placeholder="Enter your email" value={email}
                onChangeText={t => { setEmail(t); setError(''); }} keyboardType="email-address" onSubmit={handleSend} />
              <TouchableOpacity style={s.primaryBtn} onPress={handleSend} disabled={isLoading} activeOpacity={0.85}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="send-outline" size={16} color="#FFFFFF" />
                    <Text style={s.primaryBtnText}>Send Reset Code</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={[s.infoBox, { backgroundColor: C.infoBg }]}>
                <Icon name="information-circle-outline" size={16} color={C.infoIcon} />
                <Text style={[s.infoText, { color: C.infoText }]}>
                  A 6-digit verification code will be sent to your email. Check your spam folder if you don't see it.
                </Text>
              </View>
              {isFromSettings ? (
                <TouchableOpacity style={s.footer} onPress={() => navigation.goBack()}>
                  <Icon name="arrow-back" size={14} color={ORANGE} />
                  <Text style={[s.footerLink, { marginLeft: 4 }]}>Back to Settings</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.footer}>
                  <Text style={[s.footerText, { color: C.footerText }]}>Remember your password? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={s.footerLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  label:        { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  errorText:    { flex: 1, color: '#EF4444', fontSize: 13 },
  primaryBtn:   { paddingVertical: 13, paddingHorizontal: 28, borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.12 },
  infoBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 12, marginTop: 16 },
  infoText:     { flex: 1, fontSize: 12, lineHeight: 18 },
  footer:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  footerText:   { fontSize: 14 },
  footerLink:   { color: ORANGE, fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
});

export default ForgotPasswordScreen;
