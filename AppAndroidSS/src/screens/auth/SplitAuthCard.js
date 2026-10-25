import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Easing,
  Image, Platform, KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/ThemeToggle';
import { signInWithGoogle, configureGoogleSignIn } from '../../services/googleAuthService';

const LOGO   = require('../../assets/images/skillsphere-logo.png');
const ORANGE = '#F68B3C';

const getColors = (isDark) => ({
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
  tabsBg:           isDark ? 'rgba(0,0,0,0.3)'          : 'rgba(26,26,46,0.07)',
  tabInactive:      isDark ? 'rgba(255,255,255,0.5)'    : 'rgba(26,26,46,0.45)',
  otpHint:          isDark ? 'rgba(255,255,255,0.5)'    : 'rgba(26,26,46,0.5)',
  heroPanelBg:      isDark ? '#1A1A38'                  : '#F5F0FF',
  heroNavBtnBg:     isDark ? 'rgba(255,140,66,0.12)'    : 'rgba(255,140,66,0.08)',
});

// ─── Pulsing Blob (same as LandingScreen) ─────────────────────────────────────
export const PulsingBlob = ({ style, duration = 3400, delay = 0 }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const easing = Easing.inOut(Easing.sin);
    const startAnim = () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration, easing, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration, easing, useNativeDriver: true }),
        ])
      ).start();
    const timer = delay > 0 ? setTimeout(startAnim, delay) : null;
    if (!timer) startAnim();
    return () => { if (timer) clearTimeout(timer); };
  }, [pulse, duration, delay]);
  return (
    <Animated.View style={[style, {
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
      opacity:    pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    }]} />
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
const AuthInput = ({ icon, placeholder, value, onChangeText, secureTextEntry,
  keyboardType = 'default', autoCapitalize = 'none', right, C, onSubmit }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[sac.inputWrap, { backgroundColor: C.inputBg, borderColor: focused ? ORANGE : C.inputBorder }]}>
      <Icon name={icon} size={18} color={focused ? ORANGE : C.inputIcon} />
      <TextInput
        style={[sac.inputField, { color: C.inputText }]}
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

// ─── Main component ───────────────────────────────────────────────────────────
export const SplitAuthCard = ({ navigation, initialMode = 'login', isDark }) => {
  const C = getColors(isDark);
  const { login, sendLoginOTP, googleSignIn, sendOTP, isLoading } = useAuth();

  const [authMode, setAuthMode]   = useState(initialMode);
  const [cardWidth, setCardWidth] = useState(0);
  const slideAnim                  = useRef(new Animated.Value(initialMode === 'signup' ? 1 : 0)).current;

  // Login state
  const [loginSubMode, setLoginSubMode]     = useState('password');
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPassword, setLoginPassword]   = useState('');
  const [showPw, setShowPw]                 = useState(false);
  const [loginError, setLoginError]         = useState('');
  const [sendingLoginOTP, setSendingLoginOTP] = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);

  // Signup state
  const [signupName, setSignupName]         = useState('');
  const [signupEmail, setSignupEmail]       = useState('');
  const [signupError, setSignupError]       = useState('');
  const [sendingSignupOTP, setSendingSignupOTP] = useState(false);

  useEffect(() => { configureGoogleSignIn(); }, []);

  // Reset to initial mode when screen regains focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      slideAnim.setValue(initialMode === 'signup' ? 1 : 0);
      setAuthMode(initialMode);
    });
    return unsub;
  }, [navigation, initialMode, slideAnim]);

  // ─── Card layout measurement ────────────────────────────────────────────────
  const onCardLayout = (e) => setCardWidth(e.nativeEvent.layout.width);
  const halfWidth = cardWidth / 2;

  // ─── Mode switch ────────────────────────────────────────────────────────────
  // useNativeDriver: false is required because outputRange depends on measured cardWidth.
  // This is web-only (isSplit), so the performance difference is negligible.
  const switchMode = (newMode) => {
    if (newMode === authMode) return;
    setAuthMode(newMode);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', newMode === 'signup' ? '/signup' : '/login');
    }
    Animated.timing(slideAnim, {
      toValue: newMode === 'signup' ? 1 : 0,
      duration: 560,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  };

  // ─── Login handlers ─────────────────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    setLoginError('');
    if (!loginEmail.trim()) return setLoginError('Please enter your email address');
    if (!loginPassword)     return setLoginError('Please enter your password');
    const result = await login(loginEmail.trim().toLowerCase(), loginPassword);
    if (!result.success) setLoginError(result.error || 'Login failed. Please check your credentials.');
  };

  const handleSendLoginOTP = async () => {
    setLoginError('');
    if (!loginEmail.trim()) return setLoginError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) return setLoginError('Please enter a valid email address');
    setSendingLoginOTP(true);
    try {
      const result = await sendLoginOTP(loginEmail.trim().toLowerCase());
      setSendingLoginOTP(false);
      if (result.success) {
        navigation.navigate('LoginOTP', { email: loginEmail.trim().toLowerCase() });
      } else {
        setLoginError(result.error?.includes('not found')
          ? 'No account found with this email. Please sign up first.'
          : result.error || 'Failed to send verification code');
      }
    } catch (err) { setSendingLoginOTP(false); setLoginError(err.message || 'Failed to send verification code'); }
  };

  const handleGoogle = async () => {
    setLoginError(''); setSignupError(''); setGoogleLoading(true);
    try {
      const gr = await signInWithGoogle();
      if (!gr.success) {
        setGoogleLoading(false);
        if (gr.error !== 'Sign in was cancelled') {
          authMode === 'login' ? setLoginError(gr.error) : setSignupError(gr.error);
        }
        return;
      }
      const result = await googleSignIn(gr.idToken);
      setGoogleLoading(false);
      if (!result.success) {
        authMode === 'login' ? setLoginError(result.error || 'Google sign in failed') : setSignupError(result.error || 'Google sign in failed');
        return;
      }
      if (result.isNewUser) navigation.navigate('GoogleProfileCompletion', { user: result.user });
    } catch (err) {
      setGoogleLoading(false);
      authMode === 'login' ? setLoginError('Google sign in failed. Please try again.') : setSignupError('Google sign in failed. Please try again.');
    }
  };

  // ─── Signup handler ─────────────────────────────────────────────────────────
  const handleSignupSendOTP = async () => {
    setSignupError('');
    if (!signupName.trim())  return setSignupError('Please enter your full name');
    if (!signupEmail.trim()) return setSignupError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) return setSignupError('Please enter a valid email address');
    setSendingSignupOTP(true);
    try {
      const result = await sendOTP(signupEmail.trim().toLowerCase(), signupName.trim());
      setSendingSignupOTP(false);
      if (result.success) {
        navigation.navigate('SignupOTP', { email: signupEmail.trim().toLowerCase(), name: signupName.trim() });
      } else {
        setSignupError(result.error || 'Failed to send verification code');
      }
    } catch (err) {
      setSendingSignupOTP(false);
      setSignupError(err.message || 'Failed to send verification code');
    }
  };

  // ─── Slide interpolations ───────────────────────────────────────────────────
  //
  //  DRAGNEEL LAYOUT:
  //    login mode:  [form LEFT]  [hero RIGHT]
  //    signup mode: [hero LEFT]  [form RIGHT]
  //
  //  The hero panel sweeps from RIGHT → LEFT (like a curtain) on login→signup.
  //  The old form fades right, the new form slides in from the right edge.
  //
  //  All panels: position absolute, left:0, width:halfWidth.
  //  Positioned purely via translateX.

  // Hero: right half in login, left half in signup
  const heroTranslateX = halfWidth
    ? slideAnim.interpolate({ inputRange: [0, 1], outputRange: [halfWidth, 0] })
    : slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });

  // Login form: left half in login, fades+moves right on signup
  const loginFormTranslateX = halfWidth
    ? slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, halfWidth] })
    : slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const loginFormOpacity = slideAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] });

  // Signup form: slides in from the right edge to the right half on signup
  const signupFormTranslateX = halfWidth
    ? slideAnim.interpolate({ inputRange: [0, 1], outputRange: [cardWidth, halfWidth] })
    : slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const signupFormOpacity = slideAnim.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 0, 1] });

  // Hero text cross-fade (inside the hero panel)
  const loginHeroOpacity  = slideAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const signupHeroOpacity = slideAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[sac.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}
      onLayout={onCardLayout}>

      {cardWidth > 0 && (
        <>
          {/* ── Login form (left in login, slides right on signup) ── */}
          <Animated.View
            pointerEvents={authMode === 'login' ? 'auto' : 'none'}
            style={[sac.panel, {
              width: halfWidth,
              opacity: loginFormOpacity,
              transform: [{ translateX: loginFormTranslateX }],
              backgroundColor: C.cardBg,
            }]}>
            <View style={sac.formContent}>

              <View style={[sac.tabs, { backgroundColor: C.tabsBg }]}>
                {[{ id: 'password', label: 'Password', icon: 'lock-closed-outline' },
                  { id: 'otp',      label: 'Email Code', icon: 'mail-outline' }].map(t => (
                  <TouchableOpacity key={t.id}
                    style={[sac.tab, loginSubMode === t.id && { backgroundColor: ORANGE }]}
                    onPress={() => { setLoginSubMode(t.id); setLoginError(''); }} activeOpacity={0.8}>
                    <Icon name={t.icon} size={15} color={loginSubMode === t.id ? '#FFFFFF' : C.tabInactive} />
                    <Text style={[sac.tabText, { color: loginSubMode === t.id ? '#FFFFFF' : C.tabInactive }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!!loginError && (
                <View style={[sac.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                  <Icon name="alert-circle" size={16} color="#EF4444" />
                  <Text style={sac.errorText}>{loginError}</Text>
                </View>
              )}

              {loginSubMode === 'password' && (
                <>
                  <AuthInput C={C} icon="mail-outline" placeholder="Email address" value={loginEmail}
                    onChangeText={t => { setLoginEmail(t); setLoginError(''); }} keyboardType="email-address" />
                  <AuthInput C={C} icon="lock-closed-outline" placeholder="Password" value={loginPassword}
                    onChangeText={t => { setLoginPassword(t); setLoginError(''); }} secureTextEntry={!showPw}
                    onSubmit={handlePasswordLogin}
                    right={<TouchableOpacity onPress={() => setShowPw(!showPw)}>
                      <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.inputIcon} />
                    </TouchableOpacity>} />
                  <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', marginTop: -6, marginBottom: 18 }}>
                    <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '600' }}>Forgot Password?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={sac.primaryBtn} onPress={handlePasswordLogin} disabled={isLoading} activeOpacity={0.85}>
                    {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={sac.primaryBtnText}>Sign In</Text>}
                  </TouchableOpacity>
                </>
              )}

              {loginSubMode === 'otp' && (
                <>
                  <AuthInput C={C} icon="mail-outline" placeholder="Email address" value={loginEmail}
                    onChangeText={t => { setLoginEmail(t); setLoginError(''); }} keyboardType="email-address" onSubmit={handleSendLoginOTP} />
                  <Text style={[sac.otpHint, { color: C.otpHint }]}>We'll send a 6-digit code to your email</Text>
                  <TouchableOpacity style={sac.primaryBtn} onPress={handleSendLoginOTP} disabled={sendingLoginOTP} activeOpacity={0.85}>
                    {sendingLoginOTP ? <ActivityIndicator color="#FFFFFF" /> : <Text style={sac.primaryBtnText}>Send Verification Code</Text>}
                  </TouchableOpacity>
                </>
              )}

              {loginSubMode === 'password' && (
                <>
                  <View style={sac.divider}>
                    <View style={[sac.divLine, { backgroundColor: C.divider }]} />
                    <Text style={[sac.divText, { color: C.dividerText }]}>or continue with</Text>
                    <View style={[sac.divLine, { backgroundColor: C.divider }]} />
                  </View>
                  <TouchableOpacity style={[sac.googleBtn, { backgroundColor: C.googleBg, borderColor: C.googleBorder }]}
                    onPress={handleGoogle} disabled={googleLoading || isLoading} activeOpacity={0.8}>
                    {googleLoading ? <ActivityIndicator color="#DB4437" size="small" /> : (
                      <>
                        <View style={sac.googleIconWrap}>
                          <Icon name="logo-google" size={16} color="#DB4437" />
                        </View>
                        <Text style={[sac.googleText, { color: C.googleText }]}>Google</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <Text style={[sac.terms, { color: C.terms }]}>
                By signing in, you agree to our{' '}
                <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
              </Text>
            </View>
          </Animated.View>

          {/* ── Signup form (slides in from right on signup) ── */}
          <Animated.View
            pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
            style={[sac.panel, {
              width: halfWidth,
              opacity: signupFormOpacity,
              transform: [{ translateX: signupFormTranslateX }],
              backgroundColor: C.cardBg,
            }]}>
            <View style={sac.formContent}>

              {!!signupError && (
                <View style={[sac.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                  <Icon name="alert-circle" size={16} color="#EF4444" />
                  <Text style={sac.errorText}>{signupError}</Text>
                </View>
              )}

              <AuthInput C={C} icon="person-outline" placeholder="Full name" value={signupName}
                onChangeText={t => { setSignupName(t); setSignupError(''); }} autoCapitalize="words" />
              <AuthInput C={C} icon="mail-outline" placeholder="Email address" value={signupEmail}
                onChangeText={t => { setSignupEmail(t); setSignupError(''); }} keyboardType="email-address" onSubmit={handleSignupSendOTP} />

              <TouchableOpacity style={sac.primaryBtn} onPress={handleSignupSendOTP} disabled={sendingSignupOTP} activeOpacity={0.85}>
                {sendingSignupOTP ? <ActivityIndicator color="#FFFFFF" /> : <Text style={sac.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>

              <View style={sac.divider}>
                <View style={[sac.divLine, { backgroundColor: C.divider }]} />
                <Text style={[sac.divText, { color: C.dividerText }]}>or continue with</Text>
                <View style={[sac.divLine, { backgroundColor: C.divider }]} />
              </View>

              <TouchableOpacity style={[sac.googleBtn, { backgroundColor: C.googleBg, borderColor: C.googleBorder }]}
                onPress={handleGoogle} disabled={googleLoading || isLoading} activeOpacity={0.8}>
                {googleLoading ? <ActivityIndicator color="#DB4437" size="small" /> : (
                  <>
                    <View style={sac.googleIconWrap}>
                      <Icon name="logo-google" size={16} color="#DB4437" />
                    </View>
                    <Text style={[sac.googleText, { color: C.googleText }]}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={sac.socialProof}>
                <Text style={sac.socialStars}>{'★★★★★'}</Text>
                <Text style={[sac.socialStat, { color: C.textSecondary }]}>4.8</Text>
                <View style={sac.socialDot} />
                <Text style={[sac.socialStat, { color: C.textSecondary }]}>10K+ students</Text>
                <View style={sac.socialDot} />
                <Text style={[sac.socialStat, { color: C.textSecondary }]}>200+ courses</Text>
              </View>
              <Text style={[sac.terms, { color: C.terms }]}>
                {'By creating an account you agree to our '}
                <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
                {' and '}
                <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
                {". You will also receive our newsletter with learning tips and course updates. You can unsubscribe at any time from your account settings."}
              </Text>
            </View>
          </Animated.View>

          {/* ── Hero panel: sweeps right→left on signup (rendered last = highest z-index) ── */}
          <Animated.View
            style={[sac.panel, sac.heroPanel, {
              width: halfWidth,
              transform: [{ translateX: heroTranslateX }],
              backgroundColor: C.heroPanelBg,
            }]}>
            {/* Pulsing blobs — always present */}
            <PulsingBlob style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: ORANGE + '20', top: -70, left: -70 }} duration={3800} />
            <PulsingBlob style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#6366F1' + '18', bottom: -50, right: -50 }} duration={4400} delay={800} />
            <PulsingBlob style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: ORANGE + '12', top: 180, right: 60 }} duration={3200} delay={1600} />

            {/* Login hero text */}
            <Animated.View
              pointerEvents={authMode === 'login' ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, sac.heroContent, { opacity: loginHeroOpacity }]}>
              <View style={{ alignItems: 'center' }}>
                <View style={[sac.iconCircle, { backgroundColor: ORANGE + '20', borderColor: ORANGE + '40' }]}>
                  <Icon name="school" size={34} color={ORANGE} />
                </View>
                <Text style={[sac.heroTitle, { color: C.textPrimary }]}>Welcome Back</Text>
                <Text style={[sac.heroSubtitle, { color: C.textSecondary }]}>
                  Sign in to continue{'\n'}your learning journey
                </Text>
              </View>
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: C.footerText, fontSize: 13, marginBottom: 14 }}>Don't have an account?</Text>
                <TouchableOpacity
                  onPress={() => switchMode('signup')}
                  style={[sac.heroNavBtn, { borderColor: ORANGE, backgroundColor: C.heroNavBtnBg }]}
                  activeOpacity={0.8}>
                  <Text style={{ color: ORANGE, fontSize: 14, fontWeight: '700' }}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Signup hero text */}
            <Animated.View
              pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, sac.heroContent, { opacity: signupHeroOpacity }]}>
              <View style={{ alignItems: 'center' }}>
                <View style={[sac.iconCircle, { backgroundColor: ORANGE + '20', borderColor: ORANGE + '40' }]}>
                  <Icon name="person-add" size={32} color={ORANGE} />
                </View>
                <Text style={[sac.heroTitle, { color: C.textPrimary }]}>Create Account</Text>
                <Text style={[sac.heroSubtitle, { color: C.textSecondary }]}>
                  Start your learning{'\n'}journey today
                </Text>
              </View>
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: C.footerText, fontSize: 13, marginBottom: 14 }}>Already have an account?</Text>
                <TouchableOpacity
                  onPress={() => switchMode('login')}
                  style={[sac.heroNavBtn, { borderColor: ORANGE, backgroundColor: C.heroNavBtnBg }]}
                  activeOpacity={0.8}>
                  <Text style={{ color: ORANGE, fontSize: 14, fontWeight: '700' }}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </>
      )}
    </View>
  );
};

const sac = StyleSheet.create({
  card:         { borderRadius: 24, borderWidth: 1, overflow: 'hidden', width: '100%', maxWidth: 860, minHeight: 520 },
  // All panels are absolutely positioned within the card
  panel:        { position: 'absolute', top: 0, bottom: 0, left: 0 },
  heroPanel:    { overflow: 'hidden' },
  heroContent:  { padding: 36, justifyContent: 'center', alignItems: 'center' },
  iconCircle:   { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  heroTitle:    { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10, letterSpacing: 0.3 },
  heroSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 21 },
  heroNavBtn:   { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 32, paddingVertical: 13 },
  // Form content
  formContent:  { paddingHorizontal: 36, paddingTop: 24, paddingBottom: 28, justifyContent: 'center', flex: 1 },
  tabs:         { flexDirection: 'row', borderRadius: 9999, padding: 4, marginBottom: 16, gap: 4 },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9999 },
  tabText:      { fontSize: 13, fontWeight: '700' },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  errorText:    { flex: 1, color: '#EF4444', fontSize: 13 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  inputField:   { flex: 1, fontSize: 15, outlineStyle: 'none' },
  otpHint:      { fontSize: 13, textAlign: 'center', marginTop: -4, marginBottom: 16, lineHeight: 20 },
  primaryBtn:   { borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E07028', alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 13, shadowColor: '#C96A24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  divider:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  divLine:      { flex: 1, height: 1 },
  divText:      { fontSize: 12 },
  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 9999, borderWidth: 1.5 },
  googleIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(219,68,55,0.08)', justifyContent: 'center', alignItems: 'center' },
  googleText:   { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  terms:        { fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 8 },
  socialProof:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 2 },
  socialStars:  { color: '#F5C842', fontSize: 11, letterSpacing: 1 },
  socialStat:   { fontSize: 11, fontWeight: '600' },
  socialDot:    { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MobileAuthCard — vertical hero-top + form-bottom layout with mode animation
// ─────────────────────────────────────────────────────────────────────────────
export const MobileAuthCard = ({ navigation, initialMode = 'login', isDark }) => {
  const C = getColors(isDark);
  const { login, sendLoginOTP, googleSignIn, sendOTP, isLoading } = useAuth();

  const [authMode, setAuthMode]             = useState(initialMode);
  const [loginSubMode, setLoginSubMode]     = useState('password');
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPassword, setLoginPassword]   = useState('');
  const [showPw, setShowPw]                 = useState(false);
  const [loginError, setLoginError]         = useState('');
  const [sendingLoginOTP, setSendingLoginOTP] = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);
  const [signupName, setSignupName]         = useState('');
  const [signupEmail, setSignupEmail]       = useState('');
  const [signupError, setSignupError]       = useState('');
  const [sendingSignupOTP, setSendingSignupOTP] = useState(false);

  const heroFade  = useRef(new Animated.Value(initialMode === 'signup' ? 1 : 0)).current;
  const formFade  = useRef(new Animated.Value(1)).current;
  const formSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => { configureGoogleSignIn(); }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      heroFade.setValue(initialMode === 'signup' ? 1 : 0);
      setAuthMode(initialMode);
    });
    return unsub;
  }, [navigation, initialMode, heroFade]);

  const switchMode = (newMode) => {
    if (newMode === authMode) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', newMode === 'signup' ? '/signup' : '/login');
    }
    Animated.timing(formFade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setAuthMode(newMode);
      formSlide.setValue(18);
      Animated.parallel([
        Animated.timing(heroFade,  { toValue: newMode === 'signup' ? 1 : 0, duration: 460, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(formFade,  { toValue: 1, duration: 330, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 330, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    setLoginError('');
    if (!loginEmail.trim()) return setLoginError('Please enter your email address');
    if (!loginPassword)     return setLoginError('Please enter your password');
    const result = await login(loginEmail.trim().toLowerCase(), loginPassword);
    if (!result.success) setLoginError(result.error || 'Login failed. Please check your credentials.');
  };

  const handleSendLoginOTP = async () => {
    setLoginError('');
    if (!loginEmail.trim()) return setLoginError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) return setLoginError('Please enter a valid email address');
    setSendingLoginOTP(true);
    try {
      const result = await sendLoginOTP(loginEmail.trim().toLowerCase());
      setSendingLoginOTP(false);
      if (result.success) {
        navigation.navigate('LoginOTP', { email: loginEmail.trim().toLowerCase() });
      } else {
        setLoginError(result.error?.includes('not found')
          ? 'No account found with this email. Please sign up first.'
          : result.error || 'Failed to send verification code');
      }
    } catch (err) { setSendingLoginOTP(false); setLoginError(err.message || 'Failed to send verification code'); }
  };

  const handleGoogle = async () => {
    setLoginError(''); setSignupError(''); setGoogleLoading(true);
    try {
      const gr = await signInWithGoogle();
      if (!gr.success) {
        setGoogleLoading(false);
        if (gr.error !== 'Sign in was cancelled')
          authMode === 'login' ? setLoginError(gr.error) : setSignupError(gr.error);
        return;
      }
      const result = await googleSignIn(gr.idToken);
      setGoogleLoading(false);
      if (!result.success) {
        authMode === 'login' ? setLoginError(result.error || 'Google sign in failed') : setSignupError(result.error || 'Google sign in failed');
        return;
      }
      if (result.isNewUser) navigation.navigate('GoogleProfileCompletion', { user: result.user });
    } catch (err) {
      setGoogleLoading(false);
      authMode === 'login' ? setLoginError('Google sign in failed. Please try again.') : setSignupError('Google sign in failed. Please try again.');
    }
  };

  const handleSignupSendOTP = async () => {
    setSignupError('');
    if (!signupName.trim())  return setSignupError('Please enter your full name');
    if (!signupEmail.trim()) return setSignupError('Please enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) return setSignupError('Please enter a valid email address');
    setSendingSignupOTP(true);
    try {
      const result = await sendOTP(signupEmail.trim().toLowerCase(), signupName.trim());
      setSendingSignupOTP(false);
      if (result.success) {
        navigation.navigate('SignupOTP', { email: signupEmail.trim().toLowerCase(), name: signupName.trim() });
      } else {
        setSignupError(result.error || 'Failed to send verification code');
      }
    } catch (err) { setSendingSignupOTP(false); setSignupError(err.message || 'Failed to send verification code'); }
  };

  const loginHeroOp  = heroFade.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const signupHeroOp = heroFade.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  const heroBtnBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.08)';
  const textPri   = isDark ? '#FFFFFF' : '#1A1A2E';
  const textSec   = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(26,26,46,0.58)';

  // ── Render ──────────────────────────────────────────────────────────────────
  const isWeb = Platform.OS === 'web';
  return (
    <View style={[{ flex: 1 }, isWeb ? { background: C.webBg } : { backgroundColor: C.bg }]}>

      {/* Background blobs — full screen, visible against C.bg */}
      <PulsingBlob style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: ORANGE + '1E', top: -90, right: -90 }} duration={3600} />
      <PulsingBlob style={{ position: 'absolute', width: 270, height: 270, borderRadius: 135, backgroundColor: '#6366F1' + '18', bottom: -70, left: -90 }} duration={4400} delay={900} />
      <PulsingBlob style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: ORANGE + '13', top: '44%', left: -55 }} duration={3100} delay={1700} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Top bar */}
          <View style={[m.topBar, { paddingTop: Platform.OS === 'ios' ? 54 : 36 }]}>
            <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Landing')} style={[m.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)' }]}>
              <Icon name="arrow-back" size={18} color={textPri} />
            </TouchableOpacity>
            <ThemeToggle iconColor={textPri} />
          </View>

          {/* Branding + animated title */}
          <View style={m.brandSection}>
            <View style={m.brandRow}>
              <Image source={LOGO} style={m.brandLogo} resizeMode="cover" />
              <Text style={[m.brandWordmark, { color: textPri }]}>SKILL<Text style={{ color: ORANGE }}>SPHERE</Text></Text>
            </View>
            <View style={m.titleArea}>
              <Animated.View
                pointerEvents={authMode === 'login' ? 'auto' : 'none'}
                style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: loginHeroOp }]}>
                <Text style={[m.brandTitle, { color: textPri }]}>Welcome Back</Text>
                <Text style={[m.brandSubtitle, { color: textSec }]}>{'Sign in to continue your\nlearning journey'}</Text>
              </Animated.View>
              <Animated.View
                pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
                style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: signupHeroOp }]}>
                <Text style={[m.brandTitle, { color: textPri }]}>Create Account</Text>
                <Text style={[m.brandSubtitle, { color: textSec }]}>{'Start your learning\njourney today'}</Text>
              </Animated.View>
            </View>
          </View>

          {/* Form card */}
          <Animated.View style={[m.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder, opacity: formFade, transform: [{ translateY: formSlide }] }]}>

            {authMode === 'login' ? (
              <>
                {/* Login sub-mode tabs */}
                <View style={[m.tabs, { backgroundColor: C.tabsBg }]}>
                  {[{ id: 'password', label: 'Password', icon: 'lock-closed-outline' },
                    { id: 'otp',      label: 'Email Code', icon: 'mail-outline' }].map(t => (
                    <TouchableOpacity key={t.id}
                      style={[m.tab, loginSubMode === t.id && { backgroundColor: ORANGE }]}
                      onPress={() => { setLoginSubMode(t.id); setLoginError(''); }} activeOpacity={0.8}>
                      <Icon name={t.icon} size={15} color={loginSubMode === t.id ? '#FFFFFF' : C.tabInactive} />
                      <Text style={[m.tabText, { color: loginSubMode === t.id ? '#FFFFFF' : C.tabInactive }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!!loginError && (
                  <View style={[m.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                    <Icon name="alert-circle" size={16} color="#EF4444" />
                    <Text style={m.errorText}>{loginError}</Text>
                  </View>
                )}

                <AuthInput C={C} icon="mail-outline" placeholder="Email address" value={loginEmail}
                  onChangeText={t => { setLoginEmail(t); setLoginError(''); }} keyboardType="email-address" />

                {loginSubMode === 'password' ? (
                  <>
                    <AuthInput C={C} icon="lock-closed-outline" placeholder="Password" value={loginPassword}
                      onChangeText={t => { setLoginPassword(t); setLoginError(''); }} secureTextEntry={!showPw}
                      onSubmit={handlePasswordLogin}
                      right={<TouchableOpacity onPress={() => setShowPw(v => !v)}>
                        <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.inputIcon} />
                      </TouchableOpacity>} />
                    <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={m.forgotPw}>
                      <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '600' }}>Forgot Password?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={m.primaryBtn} onPress={handlePasswordLogin} disabled={isLoading} activeOpacity={0.85}>
                      {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={m.primaryBtnText}>Sign In</Text>}
                    </TouchableOpacity>
                    <View style={m.divider}>
                      <View style={[m.divLine, { backgroundColor: C.divider }]} />
                      <Text style={[m.divText, { color: C.dividerText }]}>or continue with</Text>
                      <View style={[m.divLine, { backgroundColor: C.divider }]} />
                    </View>
                    <TouchableOpacity style={[m.googleBtn, { backgroundColor: C.googleBg, borderColor: C.googleBorder }]}
                      onPress={handleGoogle} disabled={googleLoading || isLoading} activeOpacity={0.8}>
                      {googleLoading ? <ActivityIndicator color="#DB4437" size="small" /> : (
                        <>
                          <View style={sac.googleIconWrap}>
                            <Icon name="logo-google" size={16} color="#DB4437" />
                          </View>
                          <Text style={[m.googleText, { color: C.googleText }]}>Google</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[m.otpHint, { color: C.otpHint }]}>We'll send a 6-digit code to your email</Text>
                    <TouchableOpacity style={m.primaryBtn} onPress={handleSendLoginOTP} disabled={sendingLoginOTP} activeOpacity={0.85}>
                      {sendingLoginOTP ? <ActivityIndicator color="#FFFFFF" /> : <Text style={m.primaryBtnText}>Send Verification Code</Text>}
                    </TouchableOpacity>
                  </>
                )}

                <View style={m.footer}>
                  <Text style={[m.footerTxt, { color: C.footerText }]}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => switchMode('signup')}>
                    <Text style={m.footerLink}>Create Account</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[m.terms, { color: C.terms }]}>
                  {'By creating an account you agree to our '}
                  <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
                  {' and '}
                  <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
                  {". You will also receive our newsletter with learning tips and course updates. You can unsubscribe at any time from your account settings."}
                </Text>
              </>
            ) : (
              <>
                {!!signupError && (
                  <View style={[m.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                    <Icon name="alert-circle" size={16} color="#EF4444" />
                    <Text style={m.errorText}>{signupError}</Text>
                  </View>
                )}

                <AuthInput C={C} icon="person-outline" placeholder="Full name" value={signupName}
                  onChangeText={t => { setSignupName(t); setSignupError(''); }} autoCapitalize="words" />
                <AuthInput C={C} icon="mail-outline" placeholder="Email address" value={signupEmail}
                  onChangeText={t => { setSignupEmail(t); setSignupError(''); }} keyboardType="email-address" onSubmit={handleSignupSendOTP} />

                <TouchableOpacity style={m.primaryBtn} onPress={handleSignupSendOTP} disabled={sendingSignupOTP} activeOpacity={0.85}>
                  {sendingSignupOTP ? <ActivityIndicator color="#FFFFFF" /> : <Text style={m.primaryBtnText}>Continue</Text>}
                </TouchableOpacity>

                <View style={m.divider}>
                  <View style={[m.divLine, { backgroundColor: C.divider }]} />
                  <Text style={[m.divText, { color: C.dividerText }]}>or continue with</Text>
                  <View style={[m.divLine, { backgroundColor: C.divider }]} />
                </View>

                <TouchableOpacity style={[m.googleBtn, { backgroundColor: C.googleBg, borderColor: C.googleBorder }]}
                  onPress={handleGoogle} disabled={googleLoading || isLoading} activeOpacity={0.8}>
                  {googleLoading ? <ActivityIndicator color="#DB4437" size="small" /> : (
                    <>
                      <View style={sac.googleIconWrap}>
                        <Icon name="logo-google" size={16} color="#DB4437" />
                      </View>
                      <Text style={[m.googleText, { color: C.googleText }]}>Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={m.footer}>
                  <Text style={[m.footerTxt, { color: C.footerText }]}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => switchMode('login')}>
                    <Text style={m.footerLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[m.terms, { color: C.terms }]}>
                  {'By creating an account you agree to our '}
                  <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
                  {' and '}
                  <Text style={{ color: ORANGE }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
                  {". You will also receive our newsletter with learning tips and course updates. You can unsubscribe at any time from your account settings."}
                </Text>
              </>
            )}
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const m = StyleSheet.create({
  // Top bar
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 4 },
  backBtn:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  // Branding
  brandSection:  { alignItems: 'center', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 28 },
  brandRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandLogo:     { width: 36, height: 36, borderRadius: 10 },
  brandWordmark: { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontWeight: '700', fontSize: 16, letterSpacing: 1.2 },
  titleArea:     { height: 96, alignSelf: 'stretch' },
  brandTitle:    { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 10, letterSpacing: 0.2 },
  brandSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  // Form card
  card:          { marginHorizontal: 20, borderRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  // Form elements
  tabs:          { flexDirection: 'row', borderRadius: 9999, padding: 4, marginBottom: 16, gap: 4 },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9999 },
  tabText:       { fontSize: 13, fontWeight: '700' },
  errorBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  errorText:     { flex: 1, color: '#EF4444', fontSize: 13 },
  otpHint:       { fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  forgotPw:      { alignSelf: 'flex-end', marginTop: -6, marginBottom: 18 },
  primaryBtn:    { borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E07028', alignSelf: 'center', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 13, shadowColor: '#C96A24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 5 },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  divider:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  divLine:       { flex: 1, height: 1 },
  divText:       { fontSize: 12 },
  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 9999, borderWidth: 1.5 },
  googleText:    { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  footer:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  footerTxt:     { fontSize: 14 },
  footerLink:    { color: ORANGE, fontSize: 14, fontWeight: '700' },
  terms:         { fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 10 },
});
