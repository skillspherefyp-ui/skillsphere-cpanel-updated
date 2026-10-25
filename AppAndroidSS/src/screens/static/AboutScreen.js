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

const Section = ({ title, children, c }) => (
  <View style={{ marginBottom: 28 }}>
    <View style={s.sectionHeader}>
      <View style={s.sectionDot} />
      <Text style={[s.sectionTitle, { color: ORANGE }]}>{title}</Text>
    </View>
    {children}
  </View>
);

const Para = ({ text, c }) => (
  <Text style={[s.para, { color: c.textSecondary }]}>{text}</Text>
);

const ValueCard = ({ icon, title, desc, c, isDark }) => (
  <View style={[s.valueCard, {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
  }]}>
    <View style={s.valueIcon}>
      <Icon name={icon} size={22} color={ORANGE} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[s.valueTitle, { color: c.textPrimary }]}>{title}</Text>
      <Text style={[s.valueDesc, { color: c.textSecondary }]}>{desc}</Text>
    </View>
  </View>
);

const AboutScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      <Helmet>
        <title>About SkillSphere - Pakistan's AI-Powered Learning Platform</title>
        <meta name="description" content="Learn about SkillSphere, Pakistan's leading AI-powered online learning platform offering expert-led courses, verified certificates, and personalised AI tutors." />
        <link rel="canonical" href="https://skillsphere.com.pk/about" />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="About Us" />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        {/* Hero card */}
        <View style={[s.heroCard, {
          backgroundColor: isDark ? 'rgba(246,139,60,0.08)' : 'rgba(246,139,60,0.06)',
          borderColor: ORANGE + '30',
        }]}>
          <Text style={[s.heroTitle, { color: c.textPrimary }]}>
            Empower Your Skills,{'\n'}
            <Text style={{ color: ORANGE }}>Expand Your Sphere</Text>
          </Text>
          <Text style={[s.heroSub, { color: c.textSecondary }]}>
            SkillSphere is an AI-powered learning management system built to make high-quality education accessible to everyone, everywhere.
          </Text>
        </View>

        <Section title="Our Mission" c={c}>
          <Para c={c} text="Our mission is to bridge the gap between learners and industry expertise. We believe that quality education should not be limited by geography, time, or resources. SkillSphere connects students with certified professionals and equips them with the practical skills employers actually want." />
        </Section>

        <Section title="What We Offer" c={c}>
          <Para c={c} text="SkillSphere is more than an online course platform. We combine structured expert-led courses with AI-powered tutoring, real-time Q&A, hands-on projects, and industry-recognised certificates — all in one place." />
          <Para c={c} text="Whether you're a student starting your career, a professional upskilling, or an expert sharing your knowledge, SkillSphere has a place for you." />
        </Section>

        <Section title="Our Values" c={c}>
          <ValueCard c={c} isDark={isDark}
            icon="sparkles-outline"
            title="AI-Powered Learning"
            desc="Every student gets a personal AI tutor that adapts to their learning pace and style — available 24/7." />
          <ValueCard c={c} isDark={isDark}
            icon="people-outline"
            title="Expert-Led Content"
            desc="Courses are created by verified industry professionals with real-world experience in their fields." />
          <ValueCard c={c} isDark={isDark}
            icon="globe-outline"
            title="Accessible Education"
            desc="We design for all devices — web, Android, and iOS — so you can learn anywhere, anytime." />
          <ValueCard c={c} isDark={isDark}
            icon="ribbon-outline"
            title="Recognised Certificates"
            desc="Our completion certificates are generated automatically and can be publicly verified by employers." />
        </Section>

        <Section title="The Platform" c={c}>
          <Para c={c} text="SkillSphere supports four user roles — Students, Instructors, Admins, and SuperAdmins — each with tailored dashboards and tools." />
          <Para c={c} text="Students can track their progress, chat with an AI assistant, earn certificates, and participate in course discussion forums. Instructors create and publish courses, manage materials, and monitor student progress. Admins oversee platform operations, manage users, and configure certificates." />
        </Section>

        <Section title="Contact Us" c={c}>
          <Para c={c} text="Have questions, feedback, or partnership inquiries? We'd love to hear from you." />
          <View style={[s.contactRow, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
          }]}>
            <Icon name="mail-outline" size={18} color={ORANGE} />
            <Text style={[{ color: c.textSecondary, fontSize: 14, marginLeft: 10 }]}>
              skillspherefyp@gmail.com
            </Text>
          </View>
        </Section>

      </ScrollView>
    </ThemedView>
  );
};

const s = StyleSheet.create({
  headerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(246,139,60,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroCard: {
    borderRadius: 18, borderWidth: 1, padding: 22, marginBottom: 28,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', lineHeight: 30, marginBottom: 12 },
  heroSub: { fontSize: 14, lineHeight: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionDot: { width: 4, height: 18, borderRadius: 2, backgroundColor: ORANGE, marginRight: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  para: { fontSize: 14, lineHeight: 23, marginBottom: 10 },
  valueCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10,
  },
  valueIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: ORANGE + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  valueTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  valueDesc: { fontSize: 13, lineHeight: 20 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 6,
  },
});

export default AboutScreen;
