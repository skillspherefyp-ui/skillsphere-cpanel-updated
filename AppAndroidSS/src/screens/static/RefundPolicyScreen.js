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

const RefundPolicyScreen = ({ navigation }) => {
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
        <title>Refund Policy - SkillSphere</title>
        <meta name="description" content="Read SkillSphere's refund policy for certificate purchases processed via Safepay. Understand our no-refund policy for digitally delivered certificates." />
        <link rel="canonical" href="https://skillsphere.com.pk/refund-policy" />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="Refund Policy" />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        <View style={[s.lastUpdated, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
        }]}>
          <Icon name="calendar-outline" size={14} color={ORANGE} />
          <Text style={[{ color: c.textSecondary, fontSize: 13, marginLeft: 8 }]}>
            Last updated: July 2026
          </Text>
        </View>

        {para('This Refund Policy explains the terms under which payments made on the SkillSphere platform are handled. Please read this carefully before making any purchase.')}

        <Section title="1. Our No-Refund Policy">
          {para('All certificate purchases on SkillSphere are final and non-refundable. Once a payment is successfully processed through Safepay and your digital certificate has been generated and delivered to your email, the transaction is considered complete.')}
          {para('This policy exists because:')}
          {bullet('Digital certificates are generated and delivered instantly upon payment confirmation')}
          {bullet('Once issued, a certificate cannot be recalled, revoked, or reissued to another party')}
          {bullet('The certificate is uniquely tied to your name, course, and verification ID')}
          {bullet('The digital nature of the product means there is no physical item to return')}
        </Section>

        <Section title="2. What You Are Paying For">
          {para('When you purchase a certificate on SkillSphere, you are paying for:')}
          {bullet('A verified digital completion certificate (PDF format) for the completed course')}
          {bullet('A unique certificate ID permanently registered in our verification system')}
          {bullet('Public verifiability — employers and institutions can verify your certificate at any time via our verification portal')}
          {para('Certificate price: Rs. 2,000 (PKR) per course, processed via Safepay Secure Checkout.')}
        </Section>

        <Section title="3. Payment Gateway">
          {para('All payments are processed by Safepay, an SBP-regulated, PCI-DSS compliant Payment Service Provider. SkillSphere does not store your card details.')}
          {bullet('Payment gateway: Safepay — getsafepay.pk')}
          {bullet('Regulatory body: State Bank of Pakistan (SBP)')}
          {bullet('Billing administrator: Talha Rizwan')}
          <View style={s.bulletRow}>
            <View style={s.bulletDot} />
            <Text style={[s.bulletText, { color: c.textSecondary }]}>
              Billing contact: <Text style={{ fontWeight: '700' }}>talharizwan178@gmail.com</Text>
            </Text>
          </View>
        </Section>

        <Section title="4. Exceptions">
          {para('A refund or certificate re-delivery may be considered only in the following circumstances:')}
          {bullet('You were charged but did not receive your certificate email after 24 hours (check spam first)')}
          {bullet('A technical error on our platform caused your payment to be processed but the certificate was not generated')}
          {bullet('You were charged more than once for the same certificate due to a system error')}
          {para('In these cases, contact us immediately with proof of payment and we will investigate and resolve the issue within 3–5 business days.')}
        </Section>

        <Section title="5. Failed Payments">
          {para('If your payment fails or is cancelled during checkout:')}
          {bullet('You will not be charged — Safepay only completes a charge on successful transactions')}
          {bullet('If your bank shows a temporary hold, it will be released automatically within 3–5 business days')}
          {bullet('You may retry the payment at any time from your course page')}
        </Section>

        <Section title="6. Before You Purchase">
          {para('To avoid any issues, please ensure the following before completing payment:')}
          {bullet('You have fully completed all course materials (100% progress required)')}
          {bullet('Your registered email address is correct and active — the certificate is delivered there')}
          {bullet('You understand that the certificate is for personal use and tied to your account')}
        </Section>

        <Section title="7. Contact Us">
          {para('If you have a payment or certificate issue, contact us and we will respond within 1–2 business days:')}
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

export default RefundPolicyScreen;
