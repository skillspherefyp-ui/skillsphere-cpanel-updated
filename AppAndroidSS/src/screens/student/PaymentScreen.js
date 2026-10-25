import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, Platform, Linking, Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import MainLayout from '../../components/ui/MainLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { paymentAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

const CERT_PRICE = 2000;
const LS_KEY = 'safepay_pending';

const SAFEPAY_LOGO_BLUE  = require('../../assets/images/safepay-logo-blue.png');
const SAFEPAY_LOGO_WHITE = require('../../assets/images/safepay-logo-white.png');

const PaymentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  // action='complete' is injected by Safepay redirect; courseId/courseName from nav params
  const { courseId, courseName, action } = route.params || {};

  // 'idle' | 'creating' | 'waiting' | 'auto-verifying' | 'done'
  const [phase, setPhase]             = useState('idle');
  const [tracker, setTracker]         = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [error, setError]             = useState('');
  const pollRef                       = useRef(null);
  const navigatedRef                  = useRef(false);

  const maxWidth = width > 680 ? 520 : '100%';
  const surface  = isDark ? theme.colors.surface : '#fff';

  // ── Auto-verify when Safepay redirects back with ?action=complete ──────────
  useEffect(() => {
    if (action !== 'complete' || Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    let pending = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch (_) {}

    if (!pending?.tracker || String(pending.courseId) !== String(courseId)) return;

    localStorage.removeItem(LS_KEY);
    setPhase('auto-verifying');

    paymentAPI.verifyPayment({ tracker: pending.tracker, courseId })
      .then(res => {
        if (!res.success) throw new Error(res.error || 'Payment not confirmed');
        Toast.show({
          type: 'success',
          text1: 'Payment Successful!',
          text2: 'Your certificate has been sent to your email',
          visibilityTime: 3000,
        });
        setPhase('done');
        setTimeout(() => {
          navigation.navigate('CertificatePreview', {
            courseId,
            courseName: pending.courseName || courseName,
          });
        }, 1200);
      })
      .catch(err => {
        setError(err.message || 'Could not verify payment. Please try again.');
        setPhase('idle');
      });
  }, []); // run only on mount — action comes from initial params

  // ── Immediately verify when user returns to this tab (closes Safepay tab) ──
  useEffect(() => {
    if (phase !== 'waiting' || !tracker || Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !navigatedRef.current) {
        paymentAPI.verifyPayment({ tracker, courseId })
          .then(res => {
            if (res.success && !navigatedRef.current) {
              navigatedRef.current = true;
              clearInterval(pollRef.current);
              if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
              setPhase('done');
              Toast.show({ type: 'success', text1: 'Payment Successful!', text2: 'Your certificate has been sent to your email', visibilityTime: 3000 });
              setTimeout(() => navigation.navigate('CertificatePreview', { courseId, courseName }), 1200);
            }
          })
          .catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, tracker]);

  // ── Auto-poll every 3 s while waiting (original tab stays polling) ─────────
  useEffect(() => {
    if (phase !== 'waiting' || !tracker) return;

    const poll = async () => {
      try {
        const res = await paymentAPI.verifyPayment({ tracker, courseId });
        if (res.success && !navigatedRef.current) {
          navigatedRef.current = true;
          clearInterval(pollRef.current);
          if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
          setPhase('done');
          Toast.show({
            type: 'success',
            text1: 'Payment Successful!',
            text2: 'Your certificate has been sent to your email',
            visibilityTime: 3000,
          });
          setTimeout(() => {
            navigation.navigate('CertificatePreview', { courseId, courseName });
          }, 1800);
        }
      } catch (_) {
        // not paid yet — keep polling silently
      }
    };

    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [phase, tracker]);

  // ── Step 1: create order, save tracker to localStorage, open Safepay ───────
  const handleOpenSafepay = async () => {
    setError('');
    setPhase('creating');
    try {
      const res = await paymentAPI.createOrder({ courseId, courseName });
      if (!res.success) throw new Error(res.error || 'Could not create payment session');

      // Persist tracker so the redirect tab can auto-verify without state
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, JSON.stringify({
          tracker: res.tracker,
          courseId,
          courseName,
        }));
      }

      setTracker(res.tracker);
      setCheckoutUrl(res.checkoutUrl);
      setPhase('waiting');

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(res.checkoutUrl, '_blank');
      } else {
        await Linking.openURL(res.checkoutUrl);
      }
    } catch (err) {
      setError(err.message || 'Failed to start payment');
      setPhase('idle');
    }
  };

  const handleReOpen = () => {
    if (!checkoutUrl) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(checkoutUrl, '_blank');
    } else {
      Linking.openURL(checkoutUrl);
    }
  };

  const handleCancel = () => {
    clearInterval(pollRef.current);
    navigatedRef.current = false;
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
    setPhase('idle');
    setTracker(null);
    setCheckoutUrl(null);
    setError('');
  };

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={getSidebarItems(user?.role)}
      activeRoute="Certificates"
      onNavigate={r => navigation.navigate(r)}
      userInfo={{ name: user?.name, role: user?.role || 'Student', avatar: user?.avatar }}
      onLogout={logout}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { maxWidth, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Header */}
        <View style={[styles.banner, {
          backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.05)',
          borderColor: 'rgba(16,185,129,0.15)',
        }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
            onPress={() => navigation.navigate('CourseFeedback', { courseId, courseName })}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.bannerIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Icon name="card" size={22} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: theme.colors.textPrimary }]}>Secure Payment</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <Text style={[styles.bannerSub, { color: theme.colors.textSecondary }]}>Powered by</Text>
              <Image
                source={isDark ? SAFEPAY_LOGO_WHITE : SAFEPAY_LOGO_BLUE}
                style={{ width: 72, height: 16 }}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* Order Summary */}
        <View style={[styles.summaryCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
          <View style={styles.summaryLeft}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <Icon name="ribbon" size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textTertiary }]}>Certificate for</Text>
              <Text style={[styles.summaryName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                {courseName}
              </Text>
            </View>
          </View>
          <View style={[styles.pricePill, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.pricePillText}>PKR {CERT_PRICE}</Text>
          </View>
        </View>

        {/* What you get */}
        <View style={[styles.benefitsCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.benefitsTitle, { color: theme.colors.textPrimary }]}>What you'll receive</Text>
          {[
            { icon: 'document-text',    text: 'Official signed PDF certificate' },
            { icon: 'mail',             text: 'Delivered instantly to your email' },
            { icon: 'shield-checkmark', text: 'Verifiable certificate with unique ID' },
            { icon: 'logo-linkedin',    text: 'Add directly to your LinkedIn profile' },
          ].map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <Icon name={item.icon} size={16} color="#10B981" />
              <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Payment methods badge */}
        <View style={[styles.methodsBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderColor: theme.colors.border }]}>
          <Icon name="lock-closed" size={13} color="#10B981" />
          <Text style={[styles.methodsText, { color: theme.colors.textTertiary }]}>
            Accepts: EasyPaisa · JazzCash · Visa · Mastercard · Local &amp; International Cards
          </Text>
        </View>

        {/* Error */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', borderColor: '#fca5a5' }]}>
            <Icon name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── How it works — always visible ── */}
        {(phase === 'idle' || phase === 'waiting') && (
          <View style={[styles.stepsBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={[styles.stepsTitle, { color: theme.colors.textPrimary }]}>How it works</Text>
            {[
              { n: '1', text: 'Click the button below — Safepay opens in a new tab.' },
              { n: '2', text: 'Complete your payment — you\'ll be redirected back automatically.' },
              { n: '3', text: 'Your certificate is prepared and sent to your email instantly.' },
            ].map(step => (
              <View key={step.n} style={styles.stepRow}>
                <View style={[styles.stepBadge, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.stepNum}>{step.n}</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.colors.textSecondary }]}>{step.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Phase: idle ── */}
        {phase === 'idle' && (
          <TouchableOpacity style={styles.payBtn} onPress={handleOpenSafepay} activeOpacity={0.85}>
            <MaterialIcon name="credit-card-check" size={20} color="#fff" />
            <Text style={styles.payBtnText}>Pay PKR {CERT_PRICE} with Safepay</Text>
          </TouchableOpacity>
        )}

        {/* ── Phase: auto-verifying (redirect tab) ── */}
        {phase === 'auto-verifying' && (
          <View style={[styles.waitCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={[styles.waitTitle, { color: theme.colors.textPrimary }]}>Confirming your payment…</Text>
            <Text style={[styles.waitSub, { color: theme.colors.textSecondary }]}>
              You'll be taken to your certificate in a moment.
            </Text>
          </View>
        )}

        {/* ── Phase: creating order ── */}
        {phase === 'creating' && (
          <View style={[styles.waitCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.waitTitle, { color: theme.colors.textPrimary }]}>Creating payment session…</Text>
          </View>
        )}

        {/* ── Phase: waiting — auto-polls every 3 s ── */}
        {phase === 'waiting' && (
          <View style={[styles.waitCard, { backgroundColor: surface, borderColor: '#bbf7d0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={[styles.waitTitle, { color: '#10B981', fontSize: 14 }]}>Waiting for payment confirmation…</Text>
            </View>
            <TouchableOpacity
              style={[styles.reOpenBtn, { borderColor: theme.colors.primary }]}
              onPress={handleReOpen}
              activeOpacity={0.8}
            >
              <Icon name="refresh" size={16} color={theme.colors.primary} />
              <Text style={[styles.reOpenText, { color: theme.colors.primary }]}>Re-open Safepay tab</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={[styles.cancelText, { color: theme.colors.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && (
          <View style={[styles.waitCard, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5', borderColor: '#6ee7b7' }]}>
            <Icon name="checkmark-circle" size={48} color="#10B981" />
            <Text style={[styles.waitTitle, { color: isDark ? '#6ee7b7' : '#065f46' }]}>Payment Successful!</Text>
            <Text style={[styles.waitSub, { color: isDark ? '#a7f3d0' : '#047857' }]}>
              Your certificate is being prepared and will be sent to your email shortly.
            </Text>
          </View>
        )}

        <Text style={[styles.secureNote, { color: theme.colors.textTertiary }]}>
          🔒 Payments are processed securely by Safepay. SkillSphere does not store your card details.
        </Text>

      </ScrollView>

    </MainLayout>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 16 },

  banner: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, borderWidth: 1, gap: 12,
  },
  backBtn:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  bannerTitle:  { fontSize: 18, fontWeight: '700' },
  bannerSub:    { fontSize: 12, marginTop: 2 },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
    borderTopWidth: 3, borderTopColor: '#10B981',
  },
  summaryLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  summaryIcon:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 2 },
  summaryName:  { fontSize: 14, fontWeight: '600' },
  pricePill:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  pricePillText:{ color: '#fff', fontSize: 14, fontWeight: '700' },

  benefitsCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 10,
    borderTopWidth: 3, borderTopColor: '#10B981',
  },
  benefitsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  benefitRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText:   { fontSize: 13, flex: 1 },

  methodsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  methodsText: { fontSize: 11, flex: 1, lineHeight: 17 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { flex: 1, color: '#ef4444', fontSize: 13 },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 14,
    backgroundColor: '#10B981',
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  waitCard: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    alignItems: 'center', gap: 12,
  },
  waitIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  waitTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  waitSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  reOpenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1.5,
  },
  reOpenText: { fontSize: 14, fontWeight: '600' },

  stepsBox: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 10,
  },
  stepsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  stepRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  stepNum:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepText:  { flex: 1, fontSize: 13, lineHeight: 19 },

  cancelText: { fontSize: 13, textAlign: 'center' },

  secureNote: { fontSize: 11, textAlign: 'center' },
});

export default PaymentScreen;
