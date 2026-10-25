import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import AppHeader from '../../components/ui/AppHeader';
import ThemedView from '../../components/ThemedView';
import { Helmet } from 'react-helmet-async';

const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';

const Section = ({ title, children }) => (
  <View style={{ marginBottom: 26 }}>
    <View style={s.sectionHeader}>
      <View style={s.sectionDot} />
      <Text style={[s.sectionTitle, { color: ORANGE }]}>{title}</Text>
    </View>
    {children}
  </View>
);

const PrivacyPolicyScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const para = (text) => (
    <Text style={[s.para, { color: c.textSecondary }]}>{text}</Text>
  );

  const bullet = (text) => (
    <View style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={[s.bulletText, { color: c.textSecondary }]}>{text}</Text>
    </View>
  );

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      <Helmet>
        <title>Privacy Policy - SkillSphere</title>
        <meta name="description" content="Read SkillSphere's privacy policy to understand how we collect, use, and protect your personal data on our online learning platform." />
        <link rel="canonical" href="https://skillsphere.com.pk/privacy" />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="Privacy Policy" />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        <View style={[s.lastUpdated, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
        }]}>
          <Icon name="calendar-outline" size={14} color={ORANGE} />
          <Text style={[{ color: c.textSecondary, fontSize: 13, marginLeft: 8 }]}>
            Last updated: May 2026
          </Text>
        </View>

        {para('This Privacy Policy explains how SkillSphere ("we", "us", or "our") collects, uses, and protects your personal information when you use our platform.')}

        <Section title="Information We Collect">
          {para('We collect information you provide directly:')}
          {bullet('Account details — name, email address, password (hashed)')}
          {bullet('Profile information — profile photo, bio')}
          {bullet('Course activity — enrollments, progress, quiz results')}
          {bullet('Communications — messages sent through our contact form or discussion forums')}
          {para('We also collect data automatically when you use the platform:')}
          {bullet('Device and browser information')}
          {bullet('IP address and approximate location')}
          {bullet('Usage data — pages visited, features used, time spent')}
        </Section>

        <Section title="How We Use Your Information">
          {bullet('To provide and maintain your account')}
          {bullet('To personalise your learning experience')}
          {bullet('To generate and deliver your completion certificates')}
          {bullet('To send important service emails (OTP codes, certificate delivery)')}
          {bullet('To improve the platform through analytics')}
          {bullet('To moderate content and enforce our Terms of Service')}
        </Section>

        <Section title="AI Features">
          {para('Our AI tutor and chat features send your messages to OpenAI to generate responses. These messages may be used by OpenAI in accordance with their privacy policy. We do not use your conversation data to train our own models.')}
        </Section>

        <Section title="Data Sharing">
          {para('We do not sell your personal data. We share data only with:')}
          {bullet('Service providers — cloud storage (Cloudinary), email delivery (Brevo), AI services (OpenAI)')}
          {bullet('Legal authorities — when required by law or to protect the safety of users')}
          {para('All third-party providers are bound by data processing agreements.')}
        </Section>

        <Section title="Payment Processing & Financial Data Security">
          {para('All financial transactions on SkillSphere are executed securely via our integrated third-party payment partner, Safepay, an SBP-regulated Payment Service Provider. When purchasing a certificate, you interact directly with Safepay\'s PCI-DSS compliant payment window.')}
          {bullet('SkillSphere does not capture, store, or process your credit card numbers, bank account logins, or digital wallet pins on our local servers')}
          {bullet('All billing communication is managed using cryptographic tokens transmitted via secure HTTPS protocol')}
          {bullet('Payment data is handled exclusively by Safepay in accordance with PCI-DSS compliance standards')}
          {bullet('Certificate purchases are final and non-refundable once the digital certificate has been generated and delivered')}
          <View style={s.bulletRow}>
            <View style={s.bulletDot} />
            <Text style={[s.bulletText, { color: c.textSecondary }]}>
              For payment-related queries, visit <Text style={{ fontWeight: '700' }}>getsafepay.pk</Text> or contact our support team at <Text style={{ fontWeight: '700' }}>support@skillsphere.com.pk</Text>, <Text style={{ fontWeight: '700' }}>skillspherefyp@gmail.com</Text>, or <Text style={{ fontWeight: '700' }}>talharizwan178@gmail.com</Text>
            </Text>
          </View>
        </Section>

        <Section title="Cookies">
          {para('We use cookies and similar technologies to keep you logged in, remember your preferences, and understand how you use the platform. You can disable cookies in your browser settings, but some features may not work correctly.')}
        </Section>

        <Section title="Data Retention">
          {para('We retain your account data for as long as your account is active. If you delete your account, your personal data is removed within 30 days. Course completion records and certificates may be retained for up to 7 years for verification purposes.')}
        </Section>

        <Section title="Your Rights">
          {bullet('Access — request a copy of your personal data')}
          {bullet('Correction — update inaccurate information via your profile settings')}
          {bullet('Deletion — request deletion of your account and data')}
          {bullet('Opt-out — unsubscribe from non-essential emails at any time')}
          <Text style={[s.para, { color: c.textSecondary }]}>
            To exercise any of these rights, contact us at{' '}
            <Text style={{ fontWeight: '700', color: c.textSecondary }}>support@skillsphere.com.pk</Text>
            {', '}
            <Text style={{ fontWeight: '700', color: c.textSecondary }}>skillspherefyp@gmail.com</Text>
            {', or '}
            <Text style={{ fontWeight: '700', color: c.textSecondary }}>talharizwan178@gmail.com</Text>
            {'.'}
          </Text>
        </Section>

        <Section title="Security">
          {para('We use industry-standard security measures including encrypted data transmission (HTTPS), bcrypt password hashing, and JWT-based authentication. No system is 100% secure; we encourage you to use a strong password and never share your credentials.')}
        </Section>

        <Section title="Children's Privacy">
          {para('SkillSphere is not intended for children under 13. We do not knowingly collect personal information from children. If you believe a child has created an account, please contact us immediately.')}
        </Section>

        <Section title="Contact">
          {para('If you have any questions about this Privacy Policy, please contact us:')}
          <View style={[s.contactRow, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
          }]}>
            <Icon name="mail-outline" size={16} color={ORANGE} />
            <Text style={[{ color: c.textSecondary, fontSize: 14, marginLeft: 10, fontWeight: '700' }]}>
              support@skillsphere.com.pk
            </Text>
          </View>
          <View style={[s.contactRow, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
            marginTop: 8,
          }]}>
            <Icon name="mail-outline" size={16} color={ORANGE} />
            <Text style={[{ color: c.textSecondary, fontSize: 14, marginLeft: 10, fontWeight: '700' }]}>
              skillspherefyp@gmail.com
            </Text>
          </View>
          <View style={[s.contactRow, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
            marginTop: 8,
          }]}>
            <Icon name="mail-outline" size={16} color={ORANGE} />
            <Text style={[{ color: c.textSecondary, fontSize: 14, marginLeft: 10, fontWeight: '700' }]}>
              talharizwan178@gmail.com
            </Text>
          </View>
        </Section>

      </ScrollView>
    </ThemedView>
  );
};

const s = StyleSheet.create({
  lastUpdated: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionDot: { width: 4, height: 16, borderRadius: 2, backgroundColor: ORANGE, marginRight: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  para: { fontSize: 14, lineHeight: 22, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginTop: 8, marginRight: 10 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 6,
  },
});

export default PrivacyPolicyScreen;
