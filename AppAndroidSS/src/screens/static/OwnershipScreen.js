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

const OwnershipScreen = ({ navigation }) => {
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
        <title>Platform Ownership - SkillSphere</title>
        <meta name="description" content="Legal ownership, operational details, and educational disclaimer for the SkillSphere online learning platform." />
        <link rel="canonical" href="https://skillsphere.com.pk/ownership" />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="Platform Ownership" />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        <View style={[s.lastUpdated, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
        }]}>
          <Icon name="calendar-outline" size={14} color={ORANGE} />
          <Text style={[{ color: c.textSecondary, fontSize: 13, marginLeft: 8 }]}>
            Last updated: October 2026
          </Text>
        </View>

        {para('This page sets out the operational ownership, development team, and educational disclaimer for the SkillSphere platform.')}

        <Section title="1. Platform Ownership & Educational Disclaimer">
          {para('SkillSphere is an online e-learning application built and managed collaboratively by Muhammad Danish and Talha Rizwan as an academic group project initiative.')}
          {para('For the administrative purpose of deploying online checkout routing and securing live payment gateway clearance, Talha Rizwan operates as the primary account holder, billing administrator, and designated individual sole proprietor for this domain.')}
          {para('All platform intellectual property, code bases, and structural project data remain collectively owned by the development team.')}
        </Section>

        <Section title="2. Development Team">
          {bullet('Muhammad Danish — Co-developer & project contributor')}
{bullet('Talha Rizwan — Co-developer, billing administrator & domain account holder')}
        </Section>

        <Section title="3. Payment Gateway Administration">
          {para('For the purpose of live payment processing, Talha Rizwan serves as the designated sole proprietor and account holder for Safepay (SBP-regulated Payment Service Provider) integration. This administrative arrangement exists solely to fulfil gateway onboarding requirements and does not affect the collective ownership of the platform.')}
          <View style={s.bulletRow}>
            <View style={s.bulletDot} />
            <Text style={[s.bulletText, { color: c.textSecondary }]}>
              Payment gateway: Safepay — <Text style={{ fontWeight: '700' }}>getsafepay.pk</Text>
            </Text>
          </View>
          {bullet('Regulatory body: State Bank of Pakistan (SBP)')}
          <View style={s.bulletRow}>
            <View style={s.bulletDot} />
            <Text style={[s.bulletText, { color: c.textSecondary }]}>
              Billing contact: <Text style={{ fontWeight: '700' }}>talharizwan178@gmail.com</Text>
            </Text>
          </View>
        </Section>

        <Section title="4. Academic Context">
          {para('SkillSphere was developed as a Final Year Project (FYP) academic initiative. While it operates as a live platform with real users and payment processing, its origins and ongoing development remain rooted in a collaborative academic effort. The educational purpose of the platform is to provide accessible, AI-assisted online learning to students across Pakistan.')}
        </Section>

        <Section title="5. Liability">
          {para('Both members of the development team share equal responsibility for the platform\'s content, functionality, and operation, except where administrative roles are specifically assigned for regulatory compliance as noted in Sections 1 and 3 above.')}
        </Section>

        <Section title="Contact">
          {para('For any queries regarding platform ownership or administration:')}
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

export default OwnershipScreen;
