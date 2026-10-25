import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, useWindowDimensions, ActivityIndicator, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import ThemedView from '../../components/ThemedView';
import AppHeader from '../../components/ui/AppHeader';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { courseAPI } from '../../services/apiClient';
import { resolveFileUrl } from '../../utils/urlHelpers';
import ShareCourseModal from '../../components/ui/ShareCourseModal';

const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';
const NAVY2  = '#16213E';

const CAT_COLORS = {
  Programming: '#6366F1', Technology: '#6366F1', Design: '#EC4899',
  Business: '#10B981', 'Data Science': '#3B82F6', Data: '#3B82F6',
  Marketing: '#F59E0B', General: ORANGE,
};

const ecNavHeader = (navigation, onBack, isMobile) => (
  <AppHeader
    showBack={true}
    forceShowBack={true}
    onBack={onBack}
    showDateTime={false}
    minimal={true}
    title="Course Details"
    rightActions={!isMobile ? (
      <>
        <TouchableOpacity style={nb.signInBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={nb.signInText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={nb.getStartedBtn} onPress={() => navigation.navigate('Signup')}>
          <Text style={nb.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </>
    ) : null}
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
);

const nb = StyleSheet.create({
  signInBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  signInText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  getStartedBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828' },
  getStartedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

// ─── Inline markdown parser ──────────────────────────────────────────────────
function parseInline(text, baseStyle, boldColor) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), bold: false, italic: false });
    if (match[0].startsWith('**')) parts.push({ text: match[2], bold: true, italic: false });
    else parts.push({ text: match[3], bold: false, italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false, italic: false });
  if (parts.length === 0) return null;
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => (
        <Text key={i} style={[p.bold && { fontWeight: '800', color: boldColor }, p.italic && { fontStyle: 'italic' }]}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

// ─── Block-level markdown renderer ──────────────────────────────────────────
const MarkdownContent = ({ content, c, isDark: dark }) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line.trim()) { elements.push(<View key={`g${i}`} style={{ height: 8 }} />); i++; continue; }
    if (line.startsWith('## ')) {
      elements.push(<Text key={i} style={[mdS.mdH2, { color: c.textPrimary }]}>{line.slice(3).trim()}</Text>); i++; continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<Text key={i} style={[mdS.mdH3, { color: c.textPrimary }]}>{line.slice(4).trim()}</Text>); i++; continue;
    }
    if (line.trim() === '---') {
      elements.push(<View key={i} style={[mdS.mdHr, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.1)' }]} />); i++; continue;
    }
    if (line.startsWith('> ')) {
      const t = line.slice(2).trim();
      elements.push(<View key={i} style={[mdS.mdQuote, { borderLeftColor: ORANGE, backgroundColor: ORANGE + '12' }]}>
        {parseInline(t, [mdS.mdQuoteText, { color: c.textSecondary }], c.textPrimary) || <Text style={[mdS.mdQuoteText, { color: c.textSecondary }]}>{t}</Text>}
      </View>); i++; continue;
    }
    if (line.startsWith('• ') || line.startsWith('- ')) {
      const t = line.slice(2).trim();
      elements.push(<View key={i} style={mdS.mdBulletRow}>
        <View style={[mdS.mdBulletDot, { backgroundColor: ORANGE }]} />
        {parseInline(t, [mdS.mdBulletText, { color: c.textPrimary }], c.textPrimary) || <Text style={[mdS.mdBulletText, { color: c.textPrimary }]}>{t}</Text>}
      </View>); i++; continue;
    }
    const om = line.match(/^(\d+)\.\s+(.+)/);
    if (om) {
      const t = om[2].trim();
      elements.push(<View key={i} style={mdS.mdBulletRow}>
        <Text style={[mdS.mdOrderedNum, { color: ORANGE }]}>{om[1]}.</Text>
        {parseInline(t, [mdS.mdBulletText, { color: c.textPrimary }], c.textPrimary) || <Text style={[mdS.mdBulletText, { color: c.textPrimary }]}>{t}</Text>}
      </View>); i++; continue;
    }
    elements.push(<View key={i} style={{ marginBottom: 6 }}>
      {parseInline(line, [mdS.mdParagraph, { color: c.textPrimary }], c.textPrimary) || <Text style={[mdS.mdParagraph, { color: c.textPrimary }]}>{line}</Text>}
    </View>);
    i++;
  }
  return <View>{elements}</View>;
};

const mdS = StyleSheet.create({
  mdH2: { fontSize: 20, fontWeight: '800', lineHeight: 28, marginTop: 20, marginBottom: 8 },
  mdH3: { fontSize: 17, fontWeight: '700', lineHeight: 24, marginTop: 16, marginBottom: 6 },
  mdHr: { height: 1.5, borderRadius: 1, marginVertical: 20 },
  mdQuote: { borderLeftWidth: 4, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 10 },
  mdQuoteText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  mdBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6, paddingLeft: 4 },
  mdBulletDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 9, flexShrink: 0 },
  mdOrderedNum: { fontSize: 14, fontWeight: '700', lineHeight: 24, width: 22, flexShrink: 0 },
  mdBulletText: { flex: 1, fontSize: 15, lineHeight: 24 },
  mdParagraph: { fontSize: 15, lineHeight: 26 },
});

// ── Section Card ──────────────────────────────────────────────────────────────
const SCard = ({ children, isDark, style }) => (
  <View style={[{
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    borderRadius: 18, borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    padding: 22, marginBottom: 18,
  }, style]}>
    {children}
  </View>
);

const SectionLabel = ({ text }) => (
  <View style={{ backgroundColor: ORANGE + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 }}>
    <Text style={{ color: ORANGE, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{text.toUpperCase()}</Text>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
const ExploreCourseDetailScreen = () => {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();

  const isMobile  = width < 768;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 900 : '100%';

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);
  const [prereqCourses, setPrereqCourses] = useState([]);
  const [shareVisible, setShareVisible] = useState(false);

  useEffect(() => {
    const id = route.params?.courseId || route.params?.course?.id;
    if (!id) { setError(true); setLoading(false); return; }
    courseAPI.getById(id)
      .then(async res => {
        if (res.course) {
          setCourse(res.course);
          navigation.setOptions({ title: res.course.name + ' | SkillSphere' });
          // Hide SEO content div from real users (Google's renderer can't reach the API
          // so it never hits this branch — seo-content stays visible for Googlebot)
          if (typeof document !== 'undefined') {
            const seoEl = document.getElementById('seo-content');
            if (seoEl) seoEl.style.display = 'none';
          }
          // Fetch prerequisite course names
          const ids = res.course.prerequisiteIds;
          if (Array.isArray(ids) && ids.length > 0) {
            const results = await Promise.allSettled(ids.map(pid => courseAPI.getById(pid)));
            const names = results
              .filter(r => r.status === 'fulfilled' && r.value?.course)
              .map(r => ({ id: r.value.course.id, name: r.value.course.name }));
            setPrereqCourses(names);
          }
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const bgMain = isDark ? NAVY  : '#F0F2FF';
  const catName  = course?.category?.name || 'General';
  const catColor = CAT_COLORS[catName] || ORANGE;
  const thumb    = course?.thumbnailImage ? resolveFileUrl(course.thumbnailImage) : null;

  const renderNav = () => ecNavHeader(navigation, () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(CommonActions.reset({
        index: 1,
        routes: [{ name: 'Landing' }, { name: 'ExploreCourses' }],
      }));
    }
  }, isMobile);

  if (loading) {
    return (
      <ThemedView colorKey="background" style={{ flex: 1 }}>
        {renderNav()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)', fontSize: 14 }}>
            Loading course details...
          </Text>
        </View>
      </ThemedView>
    );
  }

  if (error || !course) {
    return (
      <ThemedView colorKey="background" style={{ flex: 1 }}>
        {renderNav()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 32 }}>
          <Icon name="alert-circle-outline" size={56} color={ORANGE + '80'} />
          <Text style={{ fontSize: 20, fontWeight: '800', color: isDark ? '#FFFFFF' : NAVY }}>Course Not Found</Text>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)', textAlign: 'center', fontSize: 14 }}>
            This course may have been removed or is no longer available.
          </Text>
          <TouchableOpacity style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 }} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const learns = [
    { icon: 'checkmark-circle', text: 'Comprehensive understanding of all course topics' },
    { icon: 'checkmark-circle', text: 'Hands-on practice with real-world examples' },
    { icon: 'checkmark-circle', text: 'Industry-recognised certificate upon completion' },
    { icon: 'checkmark-circle', text: 'Lifetime access to course materials and updates' },
  ];

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      {renderNav()}

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%', padding: isMobile ? 16 : 28 }}>

          {/* ── Thumbnail Hero ── */}
          <View style={[s.thumbWrap, { backgroundColor: catColor + '20', height: isMobile ? 220 : 340 }]}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Icon name="book-outline" size={80} color={catColor} />
            )}
            {/* Category badge over image */}
            <View style={[s.thumbBadge, { backgroundColor: catColor }]}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{catName}</Text>
            </View>
          </View>

          {/* ── Course Info Card ── */}
          <SCard isDark={isDark}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
              <Text style={{ flex: 1, fontSize: isMobile ? 22 : 28, fontWeight: '900', color: isDark ? '#FFFFFF' : NAVY, lineHeight: isMobile ? 30 : 36 }}>
                {course.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShareVisible(true)}
                style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: ORANGE + '15', justifyContent: 'center', alignItems: 'center', marginTop: 4 }}
                activeOpacity={0.75}
              >
                <Icon name="share-social-outline" size={20} color={ORANGE} />
              </TouchableOpacity>
            </View>

            {/* Meta badges */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {[
                { icon: 'bar-chart-outline', label: course.level || 'All Levels',      color: '#6366F1' },
                { icon: 'time-outline',       label: course.duration || 'Self-paced',  color: '#10B981' },
                { icon: 'language-outline',   label: course.language || 'English',     color: '#3B82F6' },
              ].map(m => (
                <View key={m.label} style={[s.metaBadge, { backgroundColor: m.color + '18' }]}>
                  <Icon name={m.icon} size={15} color={m.color} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: m.color }}>{m.label}</Text>
                </View>
              ))}
              {/* Course Type badge */}
              <View style={[s.metaBadge, { backgroundColor: course.creationMode === 'ai' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: course.creationMode === 'ai' ? 'rgba(139,92,246,0.3)' : 'rgba(34,211,238,0.25)' }]}>
                <Icon name={course.creationMode === 'ai' ? 'sparkles' : 'person'} size={15} color={course.creationMode === 'ai' ? '#8B5CF6' : '#22D3EE'} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: course.creationMode === 'ai' ? '#8B5CF6' : '#22D3EE' }}>
                  {course.creationMode === 'ai' ? 'AI-Powered' : 'Instructor-Led'}
                </Text>
              </View>
            </View>

            {/* Instructor + Enrollment */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {course.user?.name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="person-circle-outline" size={16} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)'} />
                  <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)' }}>
                    {course.user.name}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="people-outline" size={16} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)'} />
                <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)' }}>
                  {(course.enrollmentCount || 0).toLocaleString()} students enrolled
                </Text>
              </View>
            </View>
          </SCard>

          {/* ── About ── */}
          <SCard isDark={isDark}>
            <SectionLabel text="About This Course" />
            {course.description
              ? <MarkdownContent content={course.description} c={theme.colors} isDark={isDark} />
              : <Text style={{ fontSize: 15, lineHeight: 26, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(26,26,46,0.75)' }}>No description available for this course.</Text>
            }
          </SCard>

          {/* ── Prerequisites ── */}
          {(prereqCourses.length > 0 || (Array.isArray(course.prerequisiteIds) && course.prerequisiteIds.length > 0)) && (
            <SCard isDark={isDark}>
              <SectionLabel text="Prerequisites" />
              <Text style={{ fontSize: isMobile ? 18 : 22, fontWeight: '800', color: isDark ? '#FFFFFF' : NAVY, marginBottom: 14 }}>
                Before you begin
              </Text>
              {prereqCourses.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {prereqCourses.map(p => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDark ? 'rgba(246,139,60,0.08)' : 'rgba(246,139,60,0.07)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                      <Icon name="git-branch-outline" size={16} color={ORANGE} />
                      <Icon name="book-outline" size={15} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)'} />
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.85)' : NAVY }}>
                        {p.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)', fontStyle: 'italic' }}>
                  Loading prerequisites...
                </Text>
              )}
            </SCard>
          )}

          {/* ── What You'll Learn ── */}
          <SCard isDark={isDark}>
            <SectionLabel text="What You'll Learn" />
            <Text style={{ fontSize: isMobile ? 18 : 22, fontWeight: '800', color: isDark ? '#FFFFFF' : NAVY, marginBottom: 16 }}>
              Skills you'll gain
            </Text>
            <View style={{ gap: 12 }}>
              {learns.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <Icon name={item.icon} size={20} color={ORANGE} style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(26,26,46,0.75)' }}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          </SCard>

          {/* ── Course Content ── */}
          {course.topics && course.topics.length > 0 && (
            <SCard isDark={isDark}>
              <SectionLabel text="Course Content" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: isMobile ? 18 : 22, fontWeight: '800', color: isDark ? '#FFFFFF' : NAVY }}>
                  {course.topics.length} {course.topics.length === 1 ? 'Topic' : 'Topics'}
                </Text>
                <View style={{ backgroundColor: ORANGE + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '700' }}>
                    {course.topics.reduce((sum, t) => sum + (t.materials?.length || 0), 0)} materials
                  </Text>
                </View>
              </View>
              {course.topics.map((topic, i) => (
                <View
                  key={topic.id || i}
                  style={[s.topicRow, {
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)',
                    borderBottomWidth: i < course.topics.length - 1 ? 1 : 0,
                  }]}
                >
                  <View style={[s.topicNum, { backgroundColor: ORANGE + '20' }]}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: ORANGE }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : NAVY }} numberOfLines={2}>
                      {topic.title}
                    </Text>
                    {topic.materials && topic.materials.length > 0 && (
                      <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26,26,46,0.45)', marginTop: 3 }}>
                        {topic.materials.length} material{topic.materials.length !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <Icon name="lock-closed-outline" size={16} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.25)'} />
                </View>
              ))}
            </SCard>
          )}

          {/* ── CTA ── */}
          <View style={[s.cta, { backgroundColor: isDark ? NAVY2 : NAVY }]}>
            <View style={s.ctaGlowDot} />
            <Icon name="school-outline" size={48} color={ORANGE} style={{ marginBottom: 16 }} />
            <Text style={s.ctaTitle}>Ready to Start Learning?</Text>
            <Text style={s.ctaSub}>
              Create a free account to enroll in this course, track your progress, and earn a certificate.
            </Text>
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.85}
            >
              <Icon name="person-add-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Create Free Account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                Already have an account? <Text style={{ color: ORANGE, fontWeight: '700' }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <ShareCourseModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        course={course}
        isDark={isDark}
      />
    </ThemedView>
  );
};

const s = StyleSheet.create({
  thumbWrap: { borderRadius: 18, overflow: 'hidden', marginBottom: 20, justifyContent: 'center', alignItems: 'center' },
  thumbBadge: { position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  topicNum: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  cta: { borderRadius: 20, padding: 40, alignItems: 'center', overflow: 'hidden', marginBottom: 8 },
  ctaGlowDot: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: ORANGE + '15', top: -60, right: -40 },
  ctaTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 10 },
  ctaSub: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22, maxWidth: 400, marginBottom: 4 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 3 },
});

export default ExploreCourseDetailScreen;
