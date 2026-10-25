import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Animated, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import ThemedView from '../../components/ThemedView';
import { useAuth } from '../../context/AuthContext';
import { certificateAPI } from '../../services/apiClient';
import MainLayout from '../../components/ui/MainLayout';
import AppHeader from '../../components/ui/AppHeader';
import { Helmet } from 'react-helmet-async';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';
const NAVY2  = '#16213E';


const CertificateVerificationScreen = ({ navigation, route }) => {
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const fromStudent = route?.params?.fromStudent === true;

  // React Navigation linking automatically parses query params as route.params.
  // /verify?cert=CERT-123  →  route.params.cert = 'CERT-123'
  // Also accept certificateNumber param for programmatic navigation.
  const paramCert = route?.params?.cert || route?.params?.certificateNumber || route?.params?.certId || '';

  const [certNumber, setCertNumber] = useState(paramCert);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null); // null | { valid, certificate }
  const [error, setError]           = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Auto-verify if a cert number arrived via route param (QR deep-link)
  useEffect(() => {
    if (paramCert) handleVerify(paramCert);
  }, []);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async (override) => {
    const num = (override ?? certNumber).trim().toUpperCase();
    if (!num) { setError('Please enter a certificate number.'); return; }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await certificateAPI.verify(num);
      setResult(res);
      animateIn();
    } catch (err) {
      setResult({ valid: false });
      animateIn();
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setCertNumber('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  // ─── Result card ────────────────────────────────────────────────────────────
  const renderResult = () => {
    if (!result) return null;
    const isValid = result.valid;
    const cert    = result.certificate || {};

    return (
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        width: '100%',
        maxWidth: 520,
        alignSelf: 'center',
        marginTop: 24,
      }}>
        {isValid ? (
          <View style={[s.resultCard, {
            backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF9',
            borderColor: '#10B981',
          }]}>
            {/* Header */}
            <View style={s.resultHeader}>
              <View style={[s.resultIconCircle, { backgroundColor: '#10B98120' }]}>
                <Icon name="shield-checkmark" size={30} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.resultStatus, { color: '#10B981' }]}>Certificate Verified</Text>
                <Text style={[s.resultSubStatus, { color: theme.colors.textSecondary }]}>
                  This is an authentic SkillSphere certificate
                </Text>
              </View>
            </View>

            <View style={[s.divider, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#D1FAE5' }]} />

            {/* Details */}
            {[
              { icon: 'person-outline',      label: 'Issued To',          value: cert.studentName },
              { icon: 'book-outline',         label: 'Course',             value: cert.courseName },
              { icon: 'ribbon-outline',        label: 'Grade',              value: cert.grade || 'Pass' },
              { icon: 'calendar-outline',      label: 'Issue Date',         value: formatDate(cert.issuedDate) },
              { icon: 'barcode-outline',       label: 'Certificate Number', value: cert.certificateNumber },
            ].map(row => (
              <View key={row.label} style={s.detailRow}>
                <View style={[s.detailIconBox, { backgroundColor: ORANGE + '15' }]}>
                  <Icon name={row.icon} size={16} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.detailLabel, { color: theme.colors.textSecondary }]}>{row.label}</Text>
                  <Text style={[s.detailValue, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                    {row.value || '—'}
                  </Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={[s.verifyAnotherBtn, { borderColor: '#10B981' }]} onPress={handleReset}>
              <Icon name="refresh-outline" size={15} color="#10B981" />
              <Text style={[s.verifyAnotherText, { color: '#10B981' }]}>Verify Another</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.resultCard, {
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FFF5F5',
            borderColor: '#EF4444',
          }]}>
            <View style={s.resultHeader}>
              <View style={[s.resultIconCircle, { backgroundColor: '#EF444420' }]}>
                <Icon name="close-circle" size={30} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.resultStatus, { color: '#EF4444' }]}>Certificate Not Found</Text>
                <Text style={[s.resultSubStatus, { color: theme.colors.textSecondary }]}>
                  No valid certificate matches this number
                </Text>
              </View>
            </View>
            <Text style={[s.invalidHint, { color: theme.colors.textSecondary }]}>
              Double-check the certificate number and try again. Certificate numbers are case-insensitive and follow the format CERT-XXX-XXX-XXXX.
            </Text>
            <TouchableOpacity style={[s.verifyAnotherBtn, { borderColor: '#EF4444' }]} onPress={handleReset}>
              <Icon name="refresh-outline" size={15} color="#EF4444" />
              <Text style={[s.verifyAnotherText, { color: '#EF4444' }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    );
  };

  // ─── Shared content ─────────────────────────────────────────────────────────
  const content = (
    <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: isMobile ? 16 : 24 }]}
      showsVerticalScrollIndicator={false}>

      {/* ── Page Banner (student only) ── */}
      {fromStudent && (
        <View style={s.pageBanner}>
          <View style={[s.pageBannerIconCircle, { backgroundColor: '#10B981' + '20' }]}>
            <Icon name="shield-checkmark" size={24} color="#10B981" />
          </View>
          <View>
            <Text style={[s.pageBannerTitle, { color: theme.colors.textPrimary }]}>Verify Certificate</Text>
            <Text style={[s.pageBannerSubtitle, { color: theme.colors.textSecondary }]}>
              Confirm the authenticity of any SkillSphere certificate
            </Text>
          </View>
        </View>
      )}

      {/* ── Hero (public only) ── */}
      {!fromStudent && (
        <View style={s.hero}>
          <View style={[s.heroBadge, { backgroundColor: ORANGE + '18' }]}>
            <Icon name="shield-checkmark-outline" size={13} color={ORANGE} />
            <Text style={s.heroBadgeText}>Instant Verification</Text>
          </View>
          <Text style={[s.heroTitle, { color: theme.colors.textPrimary, fontSize: isMobile ? 26 : 36 }]}>
            Verify a Certificate
          </Text>
          <Text style={[s.heroSub, { color: theme.colors.textSecondary, fontSize: isMobile ? 13 : 15 }]}>
            Enter the certificate number to confirm its authenticity. All SkillSphere certificates are permanently recorded and verifiable.
          </Text>
        </View>
      )}

      {/* ── Input card ── */}
      <View style={[s.inputCard, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(26,26,46,0.09)',
        width: '100%',
        maxWidth: 520,
        alignSelf: 'center',
        padding: isMobile ? 20 : 28,
        marginTop: fromStudent ? 0 : undefined,
      }]}>
        <Text style={[s.inputLabel, { color: theme.colors.textSecondary }]}>Certificate Number</Text>
        <View style={[s.inputRow, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8F9FF',
          borderColor: error
            ? '#EF4444'
            : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.14)',
        }]}>
          <Icon name="barcode-outline" size={20} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            style={[s.textInput, { color: theme.colors.textPrimary, flex: 1 }]}
            value={certNumber}
            onChangeText={v => { setCertNumber(v); setError(''); }}
            placeholder="e.g. CERT-1-2-1234567890-AB12"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(26,26,46,0.3)'}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => handleVerify()}
          />
          {certNumber.length > 0 && (
            <TouchableOpacity onPress={() => { setCertNumber(''); setError(''); setResult(null); }}>
              <Icon name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {!!error && (
          <Text style={s.errorText}>{error}</Text>
        )}

        <TouchableOpacity
          style={[s.verifyBtn, { opacity: loading ? 0.75 : 1 }]}
          onPress={() => handleVerify()}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={NAVY} />
            : <>
                <Icon name="shield-checkmark-outline" size={17} color={NAVY} />
                <Text style={s.verifyBtnText}>Verify Certificate</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Result ── */}
      {renderResult()}

      {/* ── Info strip ── */}
      {!result && (
        <View style={[s.infoStrip, { maxWidth: 520, alignSelf: 'center' }]}>
          {[
            { icon: 'lock-closed-outline', text: 'Secure & tamper-proof records' },
            { icon: 'time-outline',         text: 'Verification in under a second' },
            { icon: 'globe-outline',        text: 'Globally recognised credentials' },
          ].map(item => (
            <View key={item.text} style={s.infoItem}>
              <Icon name={item.icon} size={15} color={ORANGE} />
              <Text style={[s.infoText, { color: theme.colors.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Footer note ── */}
      <Text style={[s.footerNote, { color: theme.colors.textSecondary }]}>
        © {new Date().getFullYear()} SkillSphere · All certificates are cryptographically verified
      </Text>
    </ScrollView>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (fromStudent || user?.role === 'student' || user?.role === 'admin' || user?.role === 'instructor') {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={getSidebarItems(user?.role)}
        activeRoute="CertificateVerify"
        onNavigate={(route) => navigation.navigate(route, route === 'CertificateVerify' ? { fromStudent: true } : undefined)}
        userInfo={{ name: user?.name, role: user?.role || 'Student', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        {content}
      </MainLayout>
    );
  }

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      <Helmet>
        <title>Verify Certificate - SkillSphere</title>
        <meta name="description" content="Verify the authenticity of a SkillSphere certificate. Enter a certificate ID to confirm it is genuine and view the holder's details." />
        <link rel="canonical" href="https://skillsphere.com.pk/certificate-verify" />
      </Helmet>
      <AppHeader
        showBack={true}
        showDateTime={false}
        minimal={true}
        title="Verify Certificate"
        mobileDropdownFooter={(close) => (
          <>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4, marginHorizontal: 12 }} />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 6, marginVertical: 1, borderRadius: 12, gap: 12 }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('Login'), 100); }}
              activeOpacity={0.7}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,140,66,0.1)' }}>
                <Icon name="log-in-outline" size={18} color="#FF8C42" />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 6, marginVertical: 1, borderRadius: 12, gap: 12 }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('Signup'), 100); }}
              activeOpacity={0.7}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,140,66,0.1)' }}>
                <Icon name="rocket-outline" size={18} color="#FF8C42" />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Get Started</Text>
            </TouchableOpacity>
          </>
        )}
      />
      {content}
    </ThemedView>
  );
};

const s = StyleSheet.create({
  scroll: { paddingBottom: 48, alignItems: 'stretch' },

  pageBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 20, paddingHorizontal: 4, marginBottom: 20,
  },
  pageBannerIconCircle: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  pageBannerTitle: { fontSize: 22, fontWeight: '900' },
  pageBannerSubtitle: { fontSize: 13, marginTop: 2 },

  hero: { alignItems: 'center', paddingTop: 40, paddingBottom: 32, gap: 12 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  heroBadgeText: { color: ORANGE, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  heroTitle: { fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 44 },
  heroSub: { textAlign: 'center', lineHeight: 24, maxWidth: 480 },

  inputCard: { borderRadius: 18, borderWidth: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 4,
  },
  textInput: { fontSize: 14, letterSpacing: 0.5 },
  errorText: { color: '#EF4444', fontSize: 12, marginBottom: 4, marginTop: 2 },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ORANGE,
    paddingVertical: 14, borderRadius: 12,
    marginTop: 16,
    borderWidth: 1, borderColor: '#E77828',
    shadowColor: '#C96A24', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16, shadowRadius: 6, elevation: 3,
  },
  verifyBtnText: { color: NAVY, fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },

  resultCard: {
    borderRadius: 16, borderWidth: 1.5,
    padding: 20, gap: 12,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resultIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  resultStatus: { fontSize: 17, fontWeight: '800' },
  resultSubStatus: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginVertical: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIconBox: {
    width: 34, height: 34, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2,
  },
  detailLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '700' },
  invalidHint: { fontSize: 13, lineHeight: 21 },
  verifyAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  verifyAnotherText: { fontSize: 13, fontWeight: '700' },

  infoStrip: {
    marginTop: 28, gap: 10,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 13 },

  footerNote: { textAlign: 'center', fontSize: 11, marginTop: 36 },
});

export default CertificateVerificationScreen;
