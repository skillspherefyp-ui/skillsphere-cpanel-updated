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

const TermsScreen = ({ navigation }) => {
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
        <title>Terms of Service - SkillSphere</title>
        <meta name="description" content="Read SkillSphere's terms of service governing your use of our online learning platform, courses, and AI-powered features." />
        <link rel="canonical" href="https://skillsphere.com.pk/terms" />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="Terms of Service" />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        <View style={[s.lastUpdated, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
        }]}>
          <Icon name="calendar-outline" size={14} color={ORANGE} />
          <Text style={[{ color: c.textSecondary, fontSize: 13, marginLeft: 8 }]}>
            Last updated: April 2026
          </Text>
        </View>

        {para('By creating an account or using SkillSphere, you agree to be bound by these Terms of Service. Please read them carefully.')}

        <Section title="1. Account Registration">
          {para('To use most features of SkillSphere, you must create an account. You agree to:')}
          {bullet('Provide accurate and complete information during registration')}
          {bullet('Keep your password secure and not share it with anyone')}
          {bullet('Notify us immediately if you suspect unauthorised access to your account')}
          {bullet('Be responsible for all activity that occurs under your account')}
        </Section>

        <Section title="2. Use of the Platform">
          {para('SkillSphere grants you a limited, non-exclusive, non-transferable licence to access and use the platform for personal, non-commercial learning purposes.')}
          {para('You may not:')}
          {bullet('Copy, distribute, or resell any course content')}
          {bullet('Use automated tools to access or scrape the platform')}
          {bullet('Attempt to gain unauthorised access to any part of the system')}
          {bullet('Impersonate another user or misrepresent your identity')}
        </Section>

        <Section title="3. Course Enrolment">
          {para('Enrolment in a course is subject to any prerequisites set by the instructor. Once enrolled, you have access to all materials for that course. Course access may be revoked if you violate these Terms.')}
        </Section>

        <Section title="4. Certificates">
          {para('Completion certificates are automatically issued when you complete all course materials. Certificates are for personal use and are publicly verifiable through our verification system. We do not guarantee that any certificate will be recognised by any external institution or employer.')}
        </Section>

        <Section title="5. User Content">
          {para('You may post content in discussion forums. By doing so, you grant SkillSphere a licence to display and moderate that content. You must not post:')}
          {bullet('Offensive, abusive, or profane language')}
          {bullet('Spam or promotional content')}
          {bullet('Content that violates any third party\'s rights')}
          {bullet('Personal information of others without their consent')}
          {para('Violations may result in immediate account suspension.')}
        </Section>

        <Section title="6. Intellectual Property">
          {para('All course content, platform code, design, and branding are the intellectual property of SkillSphere or its content creators. You may not reproduce, distribute, or create derivative works without written permission.')}
        </Section>

        <Section title="7. AI Features">
          {para('Our AI tutoring and chat features are provided "as is". AI-generated content may not always be accurate. Do not rely solely on AI responses for critical decisions. We are not responsible for inaccuracies in AI-generated content.')}
        </Section>

        <Section title="8. Disclaimers">
          {para('SkillSphere is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access to the platform or that it will be error-free. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.')}
        </Section>

        <Section title="9. Termination">
          {para('We reserve the right to suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time. Termination does not affect any obligations you had before termination.')}
        </Section>

        <Section title="10. Changes to Terms">
          {para('We may update these Terms from time to time. We will notify you of significant changes by email or through a notice on the platform. Continued use after changes constitutes acceptance of the updated Terms.')}
        </Section>

        <Section title="11. Contact">
          {para('Questions about these Terms? Contact us:')}
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

export default TermsScreen;
