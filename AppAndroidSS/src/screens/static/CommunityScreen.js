import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import AppHeader from '../../components/ui/AppHeader';
import ThemedView from '../../components/ThemedView';
import { Helmet } from 'react-helmet-async';

const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';

const FEATURES = [
  {
    icon: 'chatbubbles-outline',
    title: 'Course Discussion Forums',
    desc: 'Every course has a dedicated forum. Ask questions, share answers, and learn from fellow students and instructors.',
    color: '#6366F1',
  },
  {
    icon: 'flame-outline',
    title: 'Learning Streaks',
    desc: 'Stay consistent with daily learning streaks. Compete with yourself and build lasting study habits.',
    color: ORANGE,
  },
  {
    icon: 'ribbon-outline',
    title: 'Certificates & Recognition',
    desc: 'Share your verified certificates with the community and on your professional profiles to showcase your skills.',
    color: '#10B981',
  },
  {
    icon: 'people-outline',
    title: 'Peer Support',
    desc: 'Connect with students across the same courses. Help others and reinforce your own understanding through teaching.',
    color: '#EC4899',
  },
  {
    icon: 'bulb-outline',
    title: 'AI-Assisted Q&A',
    desc: 'Stuck on something? Use the AI tutor or post in the forum — someone in the community always has the answer.',
    color: '#F59E0B',
  },
  {
    icon: 'trophy-outline',
    title: 'Leaderboards (Coming Soon)',
    desc: 'Weekly and monthly leaderboards based on courses completed, streaks maintained, and community contributions.',
    color: '#7C6FCD',
  },
];

const GUIDELINES = [
  { icon: 'checkmark-circle-outline', text: 'Be respectful and supportive of fellow learners', color: '#10B981' },
  { icon: 'checkmark-circle-outline', text: 'Stay on topic in course discussion forums', color: '#10B981' },
  { icon: 'checkmark-circle-outline', text: 'Share knowledge freely — teaching reinforces learning', color: '#10B981' },
  { icon: 'close-circle-outline', text: 'No spam, self-promotion, or off-topic content', color: '#EF4444' },
  { icon: 'close-circle-outline', text: 'No offensive, abusive, or discriminatory language', color: '#EF4444' },
  { icon: 'close-circle-outline', text: 'Do not share course materials outside the platform', color: '#EF4444' },
];

const CommunityScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const cardBg     = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)';

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      <Helmet>
        <title>Community - SkillSphere Learners</title>
        <meta name="description" content="Join the SkillSphere learning community. Connect with fellow students, join course discussions, and grow together on Pakistan's top learning platform." />
        <link rel="canonical" href="https://skillsphere.com.pk/community" />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="Community" />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        {/* Hero */}
        <View style={[s.hero, { backgroundColor: NAVY, borderColor: ORANGE + '30' }]}>
          <Icon name="earth-outline" size={36} color={ORANGE} style={{ marginBottom: 12 }} />
          <Text style={s.heroTitle}>Learn Together,{'\n'}Grow Together</Text>
          <Text style={s.heroSub}>
            Join thousands of learners collaborating, supporting each other, and building skills on SkillSphere.
          </Text>
          <View style={s.statsRow}>
            {[
              { value: '10K+', label: 'Members' },
              { value: '500+', label: 'Discussions' },
              { value: '95%', label: 'Help Rate' },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <View style={s.statDivider} />}
                <View style={s.statItem}>
                  <Text style={s.statValue}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Features */}
        <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Community Features</Text>
        <View style={s.featuresGrid}>
          {FEATURES.map(f => (
            <View key={f.title} style={[s.featureCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[s.featureIcon, { backgroundColor: f.color + '18' }]}>
                <Icon name={f.icon} size={20} color={f.color} />
              </View>
              <Text style={[s.featureTitle, { color: c.textPrimary }]}>{f.title}</Text>
              <Text style={[s.featureDesc, { color: c.textSecondary }]}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Guidelines */}
        <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Community Guidelines</Text>
        <View style={[s.guidelinesCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {GUIDELINES.map((g, i) => (
            <View key={i} style={[s.guidelineRow,
              i < GUIDELINES.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)',
              }]}>
              <Icon name={g.icon} size={18} color={g.color} />
              <Text style={[s.guidelineText, { color: c.textSecondary }]}>{g.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => navigation.navigate('Signup')}
          activeOpacity={0.9}>
          <Icon name="rocket-outline" size={18} color={NAVY} />
          <Text style={s.ctaBtnText}>Join the Community</Text>
        </TouchableOpacity>

        <Text style={[s.note, { color: c.textSecondary }]}>
          Already have an account?{' '}
          <Text style={{ color: ORANGE, fontWeight: '700' }}
            onPress={() => navigation.navigate('Login')}>Sign in</Text>
          {' '}to access course forums.
        </Text>

      </ScrollView>
    </ThemedView>
  );
};

const s = StyleSheet.create({
  hero: {
    borderRadius: 18, borderWidth: 1, padding: 24,
    alignItems: 'center', marginBottom: 24,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 30, marginBottom: 10 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 20 },
  statItem: { alignItems: 'center' },
  statValue: { color: ORANGE, fontSize: 20, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14, marginTop: 4 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  featureCard: {
    width: '47%', borderRadius: 14, borderWidth: 1, padding: 14,
  },
  featureIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 13, fontWeight: '700', marginBottom: 5 },
  featureDesc: { fontSize: 12, lineHeight: 18 },
  guidelinesCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  guidelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  guidelineText: { flex: 1, fontSize: 13, lineHeight: 19 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E77828', marginBottom: 14,
  },
  ctaBtnText: { color: NAVY, fontSize: 15, fontWeight: '800' },
  note: { fontSize: 13, textAlign: 'center' },
});

export default CommunityScreen;
