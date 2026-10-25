import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';

const ORANGE = '#FF8C42';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import AppButton from '../../components/ui/AppButton';
import EmptyState from '../../components/ui/EmptyState';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { resolveFileUrl } from '../../utils/urlHelpers';
import { getSidebarItems } from '../../utils/sidebarItems';
import ShareCourseModal from '../../components/ui/ShareCourseModal';

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

const CourseDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId: _courseId } = route.params;
  const courseId = typeof _courseId === 'string' ? parseInt(_courseId, 10) : _courseId;
  const { courses, enrollments, enrollInCourse, unenrollFromCourse, checkEnrollment, fetchMyEnrollments, getCourseById } = useData();
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [localCourse, setLocalCourse] = useState(null);
  const [fetchingCourse, setFetchingCourse] = useState(false);

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  const course = courses.find(c => c.id === courseId) || localCourse;

  // Student sidebar navigation items
  const sidebarItems = getSidebarItems(user?.role);

  const handleNavigate = (routeName) => {
    if (routeName === 'CertificateVerify') {
      navigation.navigate(routeName, { fromStudent: true });
    } else {
      navigation.navigate(routeName);
    }
  };

  // Check enrollment status
  const checkEnrollmentStatus = useCallback(async () => {
    try {
      const result = await checkEnrollment(courseId);
      if (result.success) {
        setIsEnrolled(result.enrolled);
        if (result.enrolled && result.enrollment) {
          setEnrollmentData(result.enrollment);
        }
      }
    } catch (error) {
      console.error('Error checking enrollment:', error);
    }
  }, [courseId, checkEnrollment]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await checkEnrollmentStatus();
    } catch (error) {
      console.error('Error loading course data:', error);
    } finally {
      setLoading(false);
    }
  }, [checkEnrollmentStatus]);

  useEffect(() => {
    loadData();
  }, [courseId]);

  // If this course is not in DataContext (e.g. beyond page-1 limit), fetch it individually.
  useEffect(() => {
    if (!courses.find(c => c.id === courseId) && courseId) {
      setFetchingCourse(true);
      getCourseById(courseId)
        .then(res => { if (res.success && res.course) setLocalCourse(res.course); })
        .finally(() => setFetchingCourse(false));
    }
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        checkEnrollmentStatus();
      }
    }, [loading, checkEnrollmentStatus])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Get enrollment progress
  const progress = useMemo(() => {
    if (!isEnrolled) return 0;
    const enrollment = enrollments.find(e => e.courseId === courseId || e.course?.id === courseId);
    return enrollment?.progress || enrollmentData?.progress || 0;
  }, [isEnrolled, enrollments, courseId, enrollmentData]);

  // Calculate topic stats
  const topicStats = useMemo(() => {
    if (!course?.topics) return { total: 0, completed: 0, unlocked: 0 };
    const total = course.topics.length;
    const completed = course.topics.filter(t => t.completed).length;
    const unlocked = course.topics.filter(t => t.status === 'unlocked' || t.completed).length;
    return { total, completed, unlocked };
  }, [course?.topics]);

  // Check if all prerequisites are completed
  const prereqsCompleted = useMemo(() => {
    if (!course?.prerequisiteIds?.length) return true;
    return course.prerequisiteIds.every(pid => {
      const e = enrollments.find(en => en.courseId === pid || en.course?.id === pid);
      return e?.progress === 100 || e?.progressPercentage === 100;
    });
  }, [course?.prerequisiteIds, enrollments]);

  const firstIncompletePrereqId = useMemo(() => {
    if (!course?.prerequisiteIds?.length) return null;
    return course.prerequisiteIds.find(pid => {
      const e = enrollments.find(en => en.courseId === pid || en.course?.id === pid);
      return !(e?.progress === 100 || e?.progressPercentage === 100);
    }) ?? null;
  }, [course?.prerequisiteIds, enrollments]);

  // Handle enroll
  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const result = await enrollInCourse(courseId);
      if (result.success) {
        setIsEnrolled(true);
        await fetchMyEnrollments();
        await checkEnrollmentStatus();
        Toast.show({
          type: 'success',
          text1: 'Enrolled Successfully',
          text2: 'You can now access the course content',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Enrollment Failed',
          text2: result.error || 'Failed to enroll in the course',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong. Please try again.',
      });
    } finally {
      setEnrolling(false);
    }
  };

  // Handle unenroll
  const handleUnenroll = async () => {
    setUnenrolling(true);
    try {
      const result = await unenrollFromCourse(courseId);
      if (result.success) {
        setIsEnrolled(false);
        setEnrollmentData(null);
        await fetchMyEnrollments();
        Toast.show({
          type: 'success',
          text1: 'Unenrolled Successfully',
          text2: 'You have been removed from this course',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Unenrollment Failed',
          text2: result.error || 'Failed to unenroll from the course',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong. Please try again.',
      });
    } finally {
      setUnenrolling(false);
    }
  };

  // Get first unlocked/available topic
  const getNextTopic = () => {
    if (!course?.topics || !isEnrolled) return null;
    return course.topics.find(t => (t.status === 'unlocked' || !t.completed) && !t.completed) || course.topics[0];
  };

  // Handle start/continue learning
  const handleStartLearning = () => {
    const nextTopic = getNextTopic();
    if (nextTopic) {
      navigation.navigate('Learning', { courseId, topicId: nextTopic.id });
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Get level color
  const getLevelColor = (level) => {
    switch (level) {
      case 'Beginner': return '#10B981';
      case 'Intermediate': return '#F59E0B';
      case 'Advanced': return '#EF4444';
      default: return theme.colors.primary;
    }
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  // Loading state
  if (loading) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Courses"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: 'Student', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading course details...
          </Text>
        </View>
      </MainLayout>
    );
  }

  // Still fetching individual course — show spinner instead of "not found"
  if (fetchingCourse && !course) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Courses"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: 'Student', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading course details...
          </Text>
        </View>
      </MainLayout>
    );
  }

  // Course not found
  if (!course) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Courses"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: 'Student', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="alert-circle-outline"
            title="Course Not Found"
            subtitle="The course you're looking for doesn't exist or has been removed"
          />
          <AppButton
            title="Browse Courses"
            onPress={() => navigation.navigate('Courses')}
            variant="primary"
            leftIcon="library-outline"
            style={{ marginTop: 20 }}
          />
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Courses"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: 'Student', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Page Header Banner */}
        <View style={[styles.pageHeaderBanner, {
          backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
          borderColor: 'rgba(255,140,66,0.15)',
        }]}>
          <View style={styles.bannerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.bannerIconCircle}>
              <Icon name="book" size={22} color={ORANGE} />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>Course Details</Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>View course information and content</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShareVisible(true)}
              style={{
                width: 38, height: 38, borderRadius: 10,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Icon name="share-social-outline" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            {isEnrolled && (
              <AppButton
                title={progress > 0 ? 'Continue Learning' : 'Start Learning'}
                onPress={handleStartLearning}
                variant="primary"
                style={styles.headerButton}
                leftIcon="play-circle-outline"
              />
            )}
          </View>
        </View>

        <ShareCourseModal
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          course={course}
          isDark={isDark}
        />

        {/* Content Grid */}
        <View style={styles.contentGrid}>
          {/* Main Column */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.mainColumn}>
            {/* Hero Card - Course Name & Description */}
            <AppCard style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.heroTitleSection}>
                  <Text style={[styles.courseName, { color: theme.colors.textPrimary }]}>
                    {course.name}
                  </Text>
                  <Text style={[styles.courseCategory, { color: theme.colors.textSecondary }]}>
                    {course.category?.name || 'No Category'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: isEnrolled ? '#10B98120' : theme.colors.primary + '20' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isEnrolled ? '#10B981' : theme.colors.primary },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: isEnrolled ? '#10B981' : theme.colors.primary },
                    ]}
                  >
                    {isEnrolled ? 'Enrolled' : 'Not Enrolled'}
                  </Text>
                </View>
              </View>

              {course.description
                ? <MarkdownContent content={course.description} c={theme.colors} isDark={isDark} />
                : <Text style={[styles.description, { color: theme.colors.textSecondary }]}>No description available for this course.</Text>
              }

              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Icon name="person-outline" size={16} color={theme.colors.textTertiary} />
                  <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                    {course.user?.name || 'Instructor'}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Icon name="people-outline" size={16} color={theme.colors.textTertiary} />
                  <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                    {course.studentsCount || 0} students
                  </Text>
                </View>
              </View>
            </AppCard>

            {/* Progress Card (if enrolled) */}
            {isEnrolled && (
              <AppCard style={styles.card}>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                  Your Progress
                </Text>

                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]}>
                      Course Completion
                    </Text>
                    <Text style={[styles.progressValue, { color: progress >= 100 ? '#10B981' : theme.colors.primary }]}>
                      {progress}%
                    </Text>
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progress}%`,
                          backgroundColor: progress >= 100 ? '#10B981' : theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressStats, { color: theme.colors.textTertiary }]}>
                    {topicStats.completed} of {topicStats.total} topics completed
                  </Text>
                </View>

                {progress >= 100 && (
                  <TouchableOpacity
                    style={[styles.certificateLink, { backgroundColor: '#10B98115' }]}
                    onPress={() => navigation.navigate('CourseFeedback', {
                      courseId: course.id,
                      courseName: course.name,
                    })}
                  >
                    <Icon name="ribbon" size={20} color="#10B981" />
                    <Text style={[styles.certificateLinkText, { color: '#10B981' }]}>
                      Rate & Get Certificate
                    </Text>
                    <Icon name="chevron-forward" size={18} color="#10B981" />
                  </TouchableOpacity>
                )}
              </AppCard>
            )}

            {/* Course Info Card */}
            <AppCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Course Info
              </Text>

              <View style={styles.infoGrid}>
                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: getLevelColor(course.level) + '15' }]}>
                    <Icon name="bar-chart-outline" size={18} color={getLevelColor(course.level)} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Level</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.level || 'All Levels'}</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Icon name="language-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Language</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.language || 'English'}</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#F59E0B15' }]}>
                    <Icon name="time-outline" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Duration</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.duration || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#8B5CF615' }]}>
                    <Icon name="layers-outline" size={18} color="#8B5CF6" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Topics</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.topics?.length || 0} topics</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: course.creationMode === 'ai' ? '#8B5CF615' : '#0EA5E915' }]}>
                    <Icon
                      name={course.creationMode === 'ai' ? 'flash-outline' : 'school-outline'}
                      size={18}
                      color={course.creationMode === 'ai' ? '#8B5CF6' : '#0EA5E9'}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Course Type</Text>
                    <Text style={[styles.infoValue, { color: course.creationMode === 'ai' ? '#8B5CF6' : '#0EA5E9' }]}>
                      {course.creationMode === 'ai' ? 'AI-Powered' : 'Instructor-Led'}
                    </Text>
                  </View>
                </View>
              </View>
            </AppCard>

            {/* Topics Card */}
            <AppCard style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, marginBottom: 0 }]}>
                  Course Content ({course.topics?.length || 0})
                </Text>
              </View>

              {course.topics && course.topics.length > 0 ? (
                <View style={styles.topicsList}>
                  {course.topics.map((topic, index) => {
                    const isLocked = !isEnrolled || topic.status === 'locked';
                    const isCompleted = topic.completed;

                    return (
                      <TouchableOpacity
                        key={topic.id}
                        style={[styles.topicItem, { backgroundColor: isDark ? theme.colors.backgroundSecondary : theme.colors.background }]}
                        onPress={() => {
                          if (!isLocked && isEnrolled) {
                            navigation.navigate('Learning', { courseId, topicId: topic.id });
                          } else if (!isEnrolled) {
                            Toast.show({
                              type: 'info',
                              text1: 'Enrollment Required',
                              text2: 'Please enroll to access this topic',
                            });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.topicNumber,
                            {
                              backgroundColor: isCompleted
                                ? '#10B981'
                                : isLocked
                                  ? theme.colors.textTertiary + '40'
                                  : theme.colors.primary,
                            },
                          ]}
                        >
                          {isCompleted ? (
                            <Icon name="checkmark" size={14} color="#FFFFFF" />
                          ) : isLocked ? (
                            <Icon name="lock-closed" size={12} color={theme.colors.textTertiary} />
                          ) : (
                            <Text style={styles.topicNumberText}>{index + 1}</Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.topicTitle,
                            { color: isLocked ? theme.colors.textTertiary : theme.colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {topic.title}
                        </Text>
                        <View
                          style={[
                            styles.topicStatusBadge,
                            {
                              backgroundColor: isCompleted
                                ? '#10B98115'
                                : isLocked
                                  ? theme.colors.textTertiary + '15'
                                  : theme.colors.primary + '15',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.topicStatusText,
                              {
                                color: isCompleted
                                  ? '#10B981'
                                  : isLocked
                                    ? theme.colors.textTertiary
                                    : theme.colors.primary,
                              },
                            ]}
                          >
                            {isCompleted ? 'Done' : isLocked ? 'Locked' : 'Start'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptySection, { borderColor: theme.colors.border }]}>
                  <Icon name="list-outline" size={28} color={theme.colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No topics added yet
                  </Text>
                </View>
              )}
            </AppCard>

            {/* Materials Card */}
            {course.materials && course.materials.length > 0 && (
              <AppCard style={styles.card}>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                  Materials ({course.materials.length})
                </Text>

                <View style={styles.materialsList}>
                  {course.materials.map((material, index) => {
                    const fileUrl = resolveFileUrl(material.uri);
                    const canAccess = isEnrolled;

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.materialItem,
                          {
                            backgroundColor: isDark ? theme.colors.backgroundSecondary : theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: canAccess ? 1 : 0.6,
                          },
                        ]}
                        onPress={() => {
                          if (!canAccess) {
                            Toast.show({
                              type: 'info',
                              text1: 'Enrollment Required',
                              text2: 'Please enroll to access materials',
                            });
                            return;
                          }
                          if (Platform.OS === 'web') {
                            window.open(fileUrl, '_blank');
                          } else {
                            Linking.openURL(fileUrl);
                          }
                        }}
                        disabled={!canAccess}
                      >
                        <Icon
                          name={material.type === 'pdf' ? 'document-text-outline' : 'image-outline'}
                          size={20}
                          color={canAccess ? theme.colors.primary : theme.colors.textTertiary}
                        />
                        <Text
                          style={[
                            styles.materialName,
                            { color: canAccess ? theme.colors.textPrimary : theme.colors.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {material.title || material.fileName || 'Material'}
                        </Text>
                        <Icon
                          name={canAccess ? 'download-outline' : 'lock-closed-outline'}
                          size={18}
                          color={canAccess ? theme.colors.primary : theme.colors.textTertiary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </AppCard>
            )}
          </Animated.View>

          {/* Side Column */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.sideColumn}>
            {/* Course Thumbnail Card */}
            <AppCard style={styles.thumbnailCard}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Course Preview
              </Text>

              {course.thumbnailImage ? (
                <Image
                  source={{ uri: resolveFileUrl(course.thumbnailImage) }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.border }]}>
                  <Icon name="image-outline" size={40} color={theme.colors.textTertiary} />
                  <Text style={[styles.thumbnailPlaceholderText, { color: theme.colors.textSecondary }]}>
                    No preview available
                  </Text>
                </View>
              )}
            </AppCard>

            {/* Prerequisites Card */}
            {Array.isArray(course.prerequisiteIds) && course.prerequisiteIds.length > 0 && (
              <AppCard style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
                <View style={styles.prereqHeader}>
                  <Icon name="lock-closed-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.prereqTitle, { color: theme.colors.textPrimary }]}>Prerequisites Required</Text>
                </View>
                <Text style={[styles.prereqSubtitle, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                  Complete the following courses before enrolling:
                </Text>
                {course.prerequisiteIds.map(pid => {
                  const prereqCourse = courses.find(c => c.id === pid);
                  if (!prereqCourse) return null;
                  const prereqEnrollment = enrollments.find(e => e.courseId === pid || e.course?.id === pid);
                  const completed = prereqEnrollment?.progress === 100 || prereqEnrollment?.progressPercentage === 100;
                  return (
                    <TouchableOpacity
                      key={pid}
                      style={[styles.prereqCourseRow, {
                        backgroundColor: completed ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                        borderColor: completed ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
                      }]}
                      onPress={() => navigation.push('CourseDetail', { courseId: pid })}
                    >
                      <View style={[styles.prereqStatusDot, { backgroundColor: completed ? '#10B981' : '#F59E0B' }]} />
                      <Text style={[styles.prereqCourseName, { color: theme.colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                        {prereqCourse.name}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: completed ? '#10B981' : '#F59E0B' }}>
                        {completed ? 'Completed' : 'Incomplete'}
                      </Text>
                      <Icon name="chevron-forward" size={14} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </AppCard>
            )}

            {/* Actions Card */}
            <AppCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Actions
              </Text>

              <View style={styles.actionsList}>
                {!isEnrolled ? (
                  prereqsCompleted ? (
                    <AppButton
                      title={enrolling ? 'Enrolling...' : 'Enroll in Course'}
                      onPress={handleEnroll}
                      variant="primary"
                      leftIcon="add-circle-outline"
                      style={styles.actionBtn}
                      disabled={enrolling}
                      loading={enrolling}
                    />
                  ) : (
                    <AppButton
                      title="Complete Prerequisite First"
                      onPress={() => firstIncompletePrereqId && navigation.push('CourseDetail', { courseId: firstIncompletePrereqId })}
                      variant="outline"
                      leftIcon="lock-closed-outline"
                      style={[styles.actionBtn, { borderColor: '#F59E0B' }]}
                    />
                  )
                ) : (
                  <>
                    <AppButton
                      title={progress > 0 ? 'Continue Learning' : 'Start Learning'}
                      onPress={handleStartLearning}
                      variant="primary"
                      leftIcon="play-circle-outline"
                      style={styles.actionBtn}
                    />
                    <AppButton
                      title={unenrolling ? 'Unenrolling...' : 'Unenroll'}
                      onPress={handleUnenroll}
                      variant="danger"
                      leftIcon="exit-outline"
                      style={styles.actionBtn}
                      disabled={unenrolling}
                      loading={unenrolling}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.discussionBtn, { backgroundColor: ORANGE + '15', borderColor: ORANGE + '40' }]}
                  onPress={() => navigation.navigate('Discussion', { courseId: course.id, courseName: course.name })}
                >
                  <Icon name="chatbubbles-outline" size={18} color={ORANGE} />
                  <Text style={[styles.discussionBtnText, { color: ORANGE }]}>Discussion Forum</Text>
                </TouchableOpacity>
              </View>
            </AppCard>

            {/* Info Card */}
            {!isEnrolled && (
              <AppCard style={[styles.infoCard, { backgroundColor: theme.colors.primary + '10' }]}>
                <Icon name="information-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoCardText, { color: theme.colors.primary }]}>
                  Enroll in this course to access all topics, track your progress, and earn a certificate upon completion.
                </Text>
              </AppCard>
            )}

            {/* Instructor Card */}
            {course.user && (
              <AppCard style={styles.card}>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                  Instructor
                </Text>
                <View style={styles.instructorInfo}>
                  <View style={[styles.instructorAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Icon name="person" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.instructorDetails}>
                    <Text style={[styles.instructorName, { color: theme.colors.textPrimary }]}>
                      {course.user.name || 'Instructor'}
                    </Text>
                    <Text style={[styles.instructorRole, { color: theme.colors.textSecondary }]}>
                      Course Creator
                    </Text>
                  </View>
                </View>
              </AppCard>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isLargeScreen, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: isMobile ? 16 : 24,
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    emptyWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },

    // Page Header Banner
    pageHeaderBanner: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isTablet ? 'center' : 'flex-start',
      padding: isMobile ? 14 : 18,
      marginBottom: 24,
      borderRadius: 16,
      borderWidth: 1,
      gap: 12,
    },
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: isTablet ? 1 : undefined,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,140,66,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerTextGroup: {
      flex: 1,
    },
    pageTitle: {      fontSize: isMobile ? 18 : 22,
      fontWeight: '700',
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: 2,
    },
    pageSubtitle: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },
    headerButton: {
      minWidth: isMobile ? '100%' : 180,
    },

    // Content Grid
    contentGrid: {
      flexDirection: isTablet ? 'row' : 'column',
      gap: 20,
    },
    mainColumn: {
      flex: isTablet ? 2 : undefined,
      width: isTablet ? undefined : '100%',
      gap: 20,
    },
    sideColumn: {
      flex: isTablet ? 1 : undefined,
      width: isTablet ? undefined : '100%',
      gap: 20,
    },

    // Hero Card
    heroCard: {
      padding: isMobile ? 16 : 20,
      borderTopWidth: 3,
      borderTopColor: theme.colors.primary,
      overflow: 'hidden',
    },
    heroHeader: {
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'flex-start',
      marginBottom: 12,
      gap: isMobile ? 8 : 12,
    },
    heroTitleSection: {
      flex: isMobile ? undefined : 1,
      width: isMobile ? '100%' : undefined,
    },
    courseName: {
      fontSize: isMobile ? 18 : 22,
      fontWeight: '700',
      marginBottom: 4,
      fontFamily: theme.typography.fontFamily.bold,
    },
    courseCategory: {
      fontSize: 14,
      fontFamily: theme.typography.fontFamily.regular,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    description: {
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 16,
      fontFamily: theme.typography.fontFamily.regular,
    },
    metaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Cards
    card: {
      padding: isMobile ? 16 : 20,
      borderTopWidth: 3,
      borderTopColor: theme.colors.primary,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    cardTitle: {      fontSize: 16,
      fontWeight: '700',
      marginBottom: 16,
      fontFamily: theme.typography.fontFamily.semiBold,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
      paddingLeft: 10,
    },

    // Progress
    progressContainer: {
      marginBottom: 16,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    progressLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    progressValue: {      fontSize: 20,
      fontWeight: '700',
    },
    progressBarBg: {
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    progressStats: {
      fontSize: 13,
    },
    certificateLink: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      gap: 10,
    },
    certificateLinkText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
    },

    // Info Grid
    infoGrid: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 12 : 16,
    },
    infoGridItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      ...(Platform.OS === 'web' ? {
        width: isMobile ? '100%' : 'calc(50% - 8px)',
      } : {
        width: isMobile ? '100%' : '48%',
      }),
    },
    infoIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      marginBottom: 2,
      fontFamily: theme.typography.fontFamily.regular,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },

    // Topics
    topicsList: {
      gap: 8,
    },
    topicItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      gap: 12,
    },
    topicNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topicNumberText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    topicTitle: {
      flex: 1,
      fontSize: 14,
      fontFamily: theme.typography.fontFamily.regular,
    },
    topicStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    topicStatusText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // Materials
    materialsList: {
      gap: 8,
    },
    materialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      gap: 10,
    },
    materialName: {
      flex: 1,
      fontSize: 14,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Empty Section
    emptySection: {
      padding: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Thumbnail Card
    thumbnailCard: {
      padding: isMobile ? 16 : 20,
    },
    thumbnailImage: {
      width: '100%',
      height: isMobile ? 200 : 180,
      borderRadius: 12,
    },
    thumbnailPlaceholder: {
      width: '100%',
      height: isMobile ? 200 : 180,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    thumbnailPlaceholderText: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Actions
    actionsList: {
      gap: 10,
    },
    actionBtn: {
      width: '100%',
    },
    discussionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 4,
    },
    discussionBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },
    prereqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    prereqTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    prereqSubtitle: {
      fontSize: 13,
    },
    prereqCourseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 8,
    },
    prereqStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    prereqCourseName: {
      fontSize: 13,
      fontWeight: '500',
    },

    // Info Card
    infoCard: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 12,
      alignItems: 'flex-start',
      gap: 12,
    },
    infoCardText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Instructor
    instructorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    instructorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    instructorDetails: {
      flex: 1,
    },
    instructorName: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    instructorRole: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });

export default CourseDetailScreen;
