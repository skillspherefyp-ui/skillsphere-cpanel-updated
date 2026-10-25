import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Linking,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import AppButton from '../../components/ui/AppButton';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resolveFileUrl } from '../../utils/urlHelpers';
import { getSidebarItems } from '../../utils/sidebarItems';
import { aiTutorAPI } from '../../services/apiClient';

const ORANGE = '#FF8C42';

const TOPIC_COLORS = [
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#F97316',
  '#EC4899',
  '#06B6D4',
  '#EF4444',
  '#F59E0B',
];

const VM_INFO = {
  comparison_table: { label: 'Table', icon: 'grid-outline', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  whiteboard:       { label: 'Whiteboard', icon: 'easel-outline', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  code_editor:      { label: 'Code', icon: 'code-slash-outline', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  image_board:      { label: 'Image', icon: 'image-outline', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
  guided_steps:     { label: 'Steps', icon: 'footsteps-outline', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  narration:        { label: 'Narration', icon: 'mic-outline', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
};
const getVisualModeInfo = (vm) =>
  VM_INFO[vm] || { label: vm || 'Slide', icon: 'albums-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };

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
  const { courseId } = route.params;
  const { courses, updateCourse, deleteCourse, isLoading, getCourseById } = useData();
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const [localCourse, setLocalCourse] = useState(null);
  const [fetchingCourse, setFetchingCourse] = useState(false);
  const course = courses.find(c => String(c.id) === String(courseId)) || localCourse;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedTopicId, setExpandedTopicId] = useState(null);
  const [topicPackages, setTopicPackages] = useState({});
  const [loadingTopicId, setLoadingTopicId] = useState(null);

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  // Permission checks
  const isOwner = course?.user?.id === user?.id;
  const isAdmin = user?.role === 'admin';
  const canManageAllCourses = user?.permissions?.canManageAllCourses === true;
  const canEdit = isOwner || isAdmin || canManageAllCourses;

  // Sidebar navigation items based on user role
  const sidebarItems = getSidebarItems(user?.role);

  // If course is not in DataContext (pagination), fetch it individually.
  useEffect(() => {
    if (!courses.find(c => String(c.id) === String(courseId)) && courseId) {
      setFetchingCourse(true);
      getCourseById(courseId)
        .then(res => { if (res.success && res.course) setLocalCourse(res.course); })
        .finally(() => setFetchingCourse(false));
    }
  }, [courseId]);

  const handleNavigate = (navRoute) => {
    if (isAdmin) {
      if (navRoute === 'ManageInstructors') {
        navigation.navigate('ManageUsers', { userType: 'instructor' });
      } else if (navRoute === 'Categories') {
        navigation.navigate('CategoryManagement');
      } else {
        navigation.navigate(navRoute);
      }
    } else {
      navigation.navigate(navRoute);
    }
  };

  const handleTopicPress = async (topicId) => {
    if (expandedTopicId === topicId) {
      setExpandedTopicId(null);
      return;
    }
    setExpandedTopicId(topicId);
    if (topicPackages[topicId]) return; // already loaded
    setLoadingTopicId(topicId);
    try {
      const data = await aiTutorAPI.getLecturePackage(topicId);
      setTopicPackages(prev => ({ ...prev, [topicId]: data }));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load topic content' });
    } finally {
      setLoadingTopicId(null);
    }
  };

  const handlePublish = () => {
    const newStatus = course.status === 'published' ? 'draft' : 'published';
    const message = newStatus === 'published' ? 'Course published!' : 'Course unpublished!';
    updateCourse(courseId, { status: newStatus });
    Toast.show({ type: 'success', text1: 'Success', text2: message });
  };

  // Alias used by pageHeaderBanner onPress
  const handlePublishToggle = handlePublish;

  const handleDelete = () => {
    setShowConfirmDialog(true);
  };

  const confirmDelete = async () => {
    setShowConfirmDialog(false);
    const result = await deleteCourse(courseId);
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Success', text2: 'Course deleted!' });
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to delete' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  if ((isLoading || fetchingCourse) && !course) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Courses"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.emptyWrapper}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </MainLayout>
    );
  }

  if (!course) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Courses"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="alert-circle-outline"
            title="Course not found"
            subtitle="The course you're looking for doesn't exist"
          />
        </View>
      </MainLayout>
    );
  }

  const isPublished = course.status === 'published';

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Courses"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header Banner — matches CourseListScreen design language */}
        <View style={[styles.pageHeaderBanner, {
          backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
          borderColor: 'rgba(255,140,66,0.15)',
          borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24,
          flexDirection: isTablet ? 'row' : 'column',
          justifyContent: 'space-between', alignItems: isTablet ? 'center' : 'flex-start', gap: 12,
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)', borderRadius: 10, padding: 10 }}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ backgroundColor: ORANGE + '20', borderRadius: 12, padding: 12 }}>
              <Icon name="book" size={22} color={ORANGE} />
            </View>
            <View>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
                {course?.name || 'Course Details'}
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                {course?.topics?.length || 0} topics · {course?.status || 'draft'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => navigation.navigate('CreateCourse', { courseId: course.id, courseData: course })}
            >
              <Icon name="create-outline" size={16} color={theme.colors.textPrimary} />
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 13 }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: course?.status === 'published' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={handlePublishToggle}
            >
              <Icon name={course?.status === 'published' ? 'eye-off-outline' : 'checkmark-circle-outline'} size={16} color={course?.status === 'published' ? '#EF4444' : '#10B981'} />
              <Text style={{ color: course?.status === 'published' ? '#EF4444' : '#10B981', fontWeight: '600', fontSize: 13 }}>
                {course?.status === 'published' ? 'Unpublish' : 'Publish'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Grid */}
        <View style={styles.contentGrid}>
          {/* Main Column */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.mainColumn}>

            {/* Hero / Course Info Card */}
            <AppCard style={styles.heroCard}>
              {/* Thumbnail or colored placeholder */}
              {course.thumbnailImage ? (
                <View style={styles.heroThumbContainer}>
                  <Image
                    source={{ uri: resolveFileUrl(course.thumbnailImage) }}
                    style={styles.heroThumbImage}
                    resizeMode="cover"
                  />
                  <View style={[styles.heroThumbOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
                  <View style={[
                    styles.heroStatusOverlay,
                    { backgroundColor: isPublished ? '#10B981' : '#F59708' },
                  ]}>
                    <Icon name={isPublished ? 'checkmark-circle' : 'time'} size={12} color="#fff" />
                    <Text style={styles.heroStatusOverlayText}>
                      {isPublished ? 'Published' : 'Draft'}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Colored placeholder when no thumbnail */
                <View style={[styles.heroThumbContainer, styles.heroThumbPlaceholder, {
                  backgroundColor: isDark ? 'rgba(255,140,66,0.12)' : 'rgba(255,140,66,0.08)',
                }]}>
                  <View style={{ backgroundColor: ORANGE + '25', borderRadius: 20, padding: 18 }}>
                    <Icon name="book" size={40} color={ORANGE} />
                  </View>
                  <View style={[
                    styles.heroStatusOverlay,
                    { backgroundColor: isPublished ? '#10B981' : '#F59708' },
                  ]}>
                    <Icon name={isPublished ? 'checkmark-circle' : 'time'} size={12} color="#fff" />
                    <Text style={styles.heroStatusOverlayText}>
                      {isPublished ? 'Published' : 'Draft'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.heroBody}>
                <View style={styles.heroHeader}>
                  <View style={styles.heroTitleSection}>
                    <Text style={[styles.courseName, { color: theme.colors.textPrimary }]}>
                      {course.name}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: isPublished ? '#10B98120' : '#F5970820' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isPublished ? '#10B981' : '#F59708' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isPublished ? '#10B981' : '#F59708' },
                      ]}
                    >
                      {isPublished ? 'Published' : 'Draft'}
                    </Text>
                  </View>
                </View>

                {/* Meta badges row */}
                <View style={styles.metaBadgesRow}>
                  {course.category?.name && (
                    <View style={[styles.metaBadge, { backgroundColor: '#6366F1' + '18', borderWidth: 1, borderColor: '#6366F1' + '30' }]}>
                      <Icon name="layers" size={13} color="#6366F1" />
                      <Text style={[styles.metaBadgeText, { color: '#6366F1' }]}>{course.category.name}</Text>
                    </View>
                  )}
                  {course.level && (
                    <View style={[styles.metaBadge, { backgroundColor: ORANGE + '18', borderWidth: 1, borderColor: ORANGE + '30' }]}>
                      <Icon name="bar-chart" size={13} color={ORANGE} />
                      <Text style={[styles.metaBadgeText, { color: ORANGE }]}>{course.level}</Text>
                    </View>
                  )}
                  {course.language && (
                    <View style={[styles.metaBadge, { backgroundColor: '#10B981' + '18', borderWidth: 1, borderColor: '#10B981' + '30' }]}>
                      <Icon name="language" size={13} color="#10B981" />
                      <Text style={[styles.metaBadgeText, { color: '#10B981' }]}>{course.language}</Text>
                    </View>
                  )}
                  {course.duration && (
                    <View style={[styles.metaBadge, { backgroundColor: '#8B5CF6' + '18', borderWidth: 1, borderColor: '#8B5CF6' + '30' }]}>
                      <Icon name="time" size={13} color="#8B5CF6" />
                      <Text style={[styles.metaBadgeText, { color: '#8B5CF6' }]}>{course.duration}</Text>
                    </View>
                  )}
                  {/* Enrollment count chip */}
                  <View style={[styles.metaBadge, { backgroundColor: '#EC4899' + '18', borderWidth: 1, borderColor: '#EC4899' + '30' }]}>
                    <Icon name="people" size={13} color="#EC4899" />
                    <Text style={[styles.metaBadgeText, { color: '#EC4899' }]}>
                      {course.enrollments?.length || 0} enrolled
                    </Text>
                  </View>
                </View>

                {course.description
                  ? <MarkdownContent content={course.description} c={theme.colors} isDark={isDark} />
                  : <Text style={[styles.description, { color: theme.colors.textSecondary }]}>No description available.</Text>
                }

                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Icon name="person-outline" size={15} color={theme.colors.textTertiary} />
                    <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                      {course.user?.name || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="calendar-outline" size={15} color={theme.colors.textTertiary} />
                    <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                      Updated {formatDate(course.updatedAt)}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="add-circle-outline" size={15} color={theme.colors.textTertiary} />
                    <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                      Created {formatDate(course.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            </AppCard>

            {/* Course Info Card */}
            <AppCard style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: ORANGE + '18' }]}>
                  <Icon name="information-circle" size={18} color={ORANGE} />
                </View>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Course Info</Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#6366F1' + '18' }]}>
                    <Icon name="bar-chart-outline" size={18} color="#6366F1" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Level</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.level}</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#10B981' + '18' }]}>
                    <Icon name="language-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Language</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.language}</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#8B5CF6' + '18' }]}>
                    <Icon name="time-outline" size={18} color="#8B5CF6" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Duration</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{course.duration}</Text>
                  </View>
                </View>

                <View style={styles.infoGridItem}>
                  <View style={[styles.infoIcon, { backgroundColor: ORANGE + '18' }]}>
                    <Icon name="calendar-outline" size={18} color={ORANGE} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textTertiary }]}>Created</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>{formatDate(course.createdAt)}</Text>
                  </View>
                </View>
              </View>

              {/* Prerequisites row */}
              {(() => {
                const prereqIds = Array.isArray(course.prerequisiteIds) ? course.prerequisiteIds : [];
                const prereqCourses = prereqIds.map(id => courses.find(c => c.id === id)).filter(Boolean);
                return (
                  <View style={[styles.prereqRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)' }]}>
                    <View style={[styles.infoIcon, { backgroundColor: '#EC4899' + '18', flexShrink: 0 }]}>
                      <Icon name="git-branch-outline" size={18} color="#EC4899" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textTertiary, marginBottom: 6 }]}>Prerequisites</Text>
                      {prereqCourses.length === 0 ? (
                        <Text style={[styles.infoValue, { color: theme.colors.textTertiary, fontStyle: 'italic' }]}>None</Text>
                      ) : (
                        <View style={styles.prereqChips}>
                          {prereqCourses.map(pc => (
                            <View key={pc.id} style={[styles.prereqChip, { backgroundColor: '#EC4899' + '14', borderColor: '#EC4899' + '40' }]}>
                              <Icon name="book-outline" size={11} color="#EC4899" />
                              <Text style={[styles.prereqChipText, { color: '#EC4899' }]} numberOfLines={1}>{pc.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })()}
            </AppCard>

            {/* Topics Card */}
            <AppCard style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#8B5CF6' + '18' }]}>
                    <Icon name="list" size={18} color="#8B5CF6" />
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Topics ({course.topics?.length || 0})
                  </Text>
                </View>
                <AppButton
                  title={canEdit ? 'Manage' : 'View'}
                  onPress={() => navigation.navigate('AddTopics', { courseId, creationMode: course?.creationMode })}
                  variant="outline"
                  size="sm"
                  leftIcon={canEdit ? 'settings-outline' : 'eye-outline'}
                />
              </View>

              {course.topics && course.topics.length > 0 ? (
                <View style={styles.topicsList}>
                  {course.topics.map((topic, index) => {
                    const topicColor = TOPIC_COLORS[index % TOPIC_COLORS.length];
                    const isAI = course.creationMode === 'ai';
                    const isExpanded = expandedTopicId === topic.id;
                    const isLoading = loadingTopicId === topic.id;
                    const pkg = topicPackages[topic.id];
                    const chunks = (pkg?.lecture?.sections || [])
                      .slice()
                      .sort((a, b) => a.sectionIndex !== b.sectionIndex ? a.sectionIndex - b.sectionIndex : a.chunkIndex - b.chunkIndex);

                    const topicRow = (
                      <View
                        style={[
                          styles.topicItem,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : theme.colors.background,
                            borderLeftColor: topicColor,
                            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)',
                            borderBottomLeftRadius: isExpanded ? 0 : 12,
                            borderBottomRightRadius: isExpanded ? 0 : 12,
                          },
                        ]}
                      >
                        <View style={[styles.topicNumber, { backgroundColor: topicColor }]}>
                          <Text style={styles.topicNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={[styles.topicTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {topic.title}
                        </Text>
                        {/* Materials shown as chips */}
                        {!isAI && topic.materials?.length > 0 && (
                          <View style={styles.topicChipsRow}>
                            {topic.materials.slice(0, 3).map((mat, mIdx) => {
                              const isPdf = mat.type === 'pdf';
                              const chipColor = isPdf ? '#EF4444' : '#06B6D4';
                              return (
                                <View
                                  key={mIdx}
                                  style={[styles.topicChip, { backgroundColor: chipColor + '18', borderColor: chipColor + '30', borderWidth: 1 }]}
                                >
                                  <Icon
                                    name={isPdf ? 'document-text-outline' : 'image-outline'}
                                    size={11}
                                    color={chipColor}
                                  />
                                  <Text style={[styles.topicChipText, { color: chipColor }]} numberOfLines={1}>
                                    {mat.title || mat.fileName || 'File'}
                                  </Text>
                                </View>
                              );
                            })}
                            {topic.materials.length > 3 && (
                              <View style={[styles.topicChip, { backgroundColor: topicColor + '18', borderColor: topicColor + '30', borderWidth: 1 }]}>
                                <Text style={[styles.topicChipText, { color: topicColor }]}>
                                  +{topic.materials.length - 3} more
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {isAI ? (
                          <View style={[styles.topicChip, { backgroundColor: '#8B5CF6' + '18', borderColor: '#8B5CF6' + '30', borderWidth: 1 }]}>
                            <Icon name="sparkles" size={11} color="#8B5CF6" />
                            <Text style={[styles.topicChipText, { color: '#8B5CF6' }]}>AI</Text>
                          </View>
                        ) : (
                          <View style={[styles.topicMatCount, { backgroundColor: topicColor + '18' }]}>
                            <Text style={[styles.topicMatCountText, { color: topicColor }]}>
                              {topic.materials?.length || 0}
                            </Text>
                          </View>
                        )}
                        {isAI && (
                          isLoading
                            ? <ActivityIndicator size="small" color={topicColor} />
                            : <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textTertiary} />
                        )}
                      </View>
                    );

                    return (
                      <View key={topic.id} style={styles.topicExpandWrapper}>
                        {isAI ? (
                          <TouchableOpacity onPress={() => handleTopicPress(topic.id)} activeOpacity={0.7}>
                            {topicRow}
                          </TouchableOpacity>
                        ) : topicRow}

                        {/* Expanded AI chunks panel */}
                        {isAI && isExpanded && (
                          <View style={[styles.chunksPanel, {
                            backgroundColor: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.04)',
                            borderColor: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.15)',
                          }]}>
                            {isLoading ? (
                              <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 16 }} />
                            ) : chunks.length === 0 ? (
                              <Text style={[styles.chunksEmpty, { color: theme.colors.textTertiary }]}>
                                No content generated yet for this topic.
                              </Text>
                            ) : (
                              chunks.map((chunk, ci) => {
                                const vmInfo = getVisualModeInfo(chunk.visualMode);
                                const bullets = Array.isArray(chunk.slideBullets) ? chunk.slideBullets : [];
                                return (
                                  <View key={chunk.id || ci} style={[styles.chunkRow, {
                                    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)',
                                    borderBottomWidth: ci < chunks.length - 1 ? 1 : 0,
                                  }]}>
                                    <View style={[styles.chunkIndex, { backgroundColor: '#8B5CF6' + '20' }]}>
                                      <Text style={[styles.chunkIndexText, { color: '#8B5CF6' }]}>{ci + 1}</Text>
                                    </View>
                                    <View style={styles.chunkContent}>
                                      <Text style={[styles.chunkTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                                        {chunk.title || `Chunk ${ci + 1}`}
                                      </Text>
                                      <View style={styles.chunkMeta}>
                                        <View style={[styles.vmBadge, { backgroundColor: vmInfo.bg, borderColor: vmInfo.border }]}>
                                          <Icon name={vmInfo.icon} size={10} color={vmInfo.color} />
                                          <Text style={[styles.vmBadgeText, { color: vmInfo.color }]}>{vmInfo.label}</Text>
                                        </View>
                                        {bullets.length > 0 && (
                                          <View style={styles.chunkBulletCount}>
                                            <Icon name="list-outline" size={10} color={theme.colors.textTertiary} />
                                            <Text style={[styles.chunkBulletCountText, { color: theme.colors.textTertiary }]}>
                                              {bullets.length} bullets
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                      {chunk.spokenExplanation ? (
                                        <Text style={[styles.chunkPreview, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                                          {chunk.spokenExplanation}
                                        </Text>
                                      ) : chunk.summary ? (
                                        <Text style={[styles.chunkPreview, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                                          {chunk.summary}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                );
                              })
                            )}
                          </View>
                        )}
                      </View>
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
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#06B6D4' + '18' }]}>
                    <Icon name="folder-open" size={18} color="#06B6D4" />
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Materials ({course.materials.length})
                  </Text>
                </View>

                {/* Materials grid */}
                <View style={styles.materialsGrid}>
                  {course.materials.map((material, index) => {
                    const fileUrl = resolveFileUrl(material.uri);
                    const isPdf = material.type === 'pdf';
                    const matColor = isPdf ? '#EF4444' : '#06B6D4';

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.materialGridItem,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : theme.colors.background,
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
                            borderTopColor: matColor,
                          },
                        ]}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            window.open(fileUrl, '_blank');
                          } else {
                            Linking.openURL(fileUrl);
                          }
                        }}
                      >
                        <View style={[styles.materialGridIcon, { backgroundColor: matColor + '18' }]}>
                          <Icon
                            name={isPdf ? 'document-text-outline' : 'image-outline'}
                            size={24}
                            color={matColor}
                          />
                        </View>
                        <Text style={[styles.materialGridName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                          {material.title || material.fileName || 'Material'}
                        </Text>
                        <View style={[styles.materialGridType, { backgroundColor: matColor + '14' }]}>
                          <Text style={[styles.materialGridTypeText, { color: matColor }]}>
                            {material.type?.toUpperCase() || 'FILE'}
                          </Text>
                        </View>
                        <View style={[styles.materialDownloadBtn, { backgroundColor: matColor + '15' }]}>
                          <Icon name="download-outline" size={15} color={matColor} />
                          <Text style={[styles.materialDownloadText, { color: matColor }]}>Download</Text>
                        </View>
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
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#EC4899' + '18' }]}>
                  <Icon name="image" size={18} color="#EC4899" />
                </View>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Course Thumbnail
                </Text>
              </View>

              {course.thumbnailImage ? (
                <View style={styles.thumbContainer}>
                  <Image
                    source={{ uri: resolveFileUrl(course.thumbnailImage) }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                  <View style={[
                    styles.thumbStatusBadge,
                    { backgroundColor: isPublished ? '#10B981' : '#F59708' },
                  ]}>
                    <Icon name={isPublished ? 'checkmark-circle' : 'time'} size={12} color="#fff" />
                    <Text style={styles.thumbStatusText}>{isPublished ? 'Published' : 'Draft'}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.thumbnailPlaceholder, {
                  backgroundColor: isDark ? 'rgba(255,140,66,0.08)' : 'rgba(255,140,66,0.06)',
                  borderColor: ORANGE + '30',
                }]}>
                  <View style={{ backgroundColor: ORANGE + '20', borderRadius: 16, padding: 14 }}>
                    <Icon name="image-outline" size={36} color={ORANGE} />
                  </View>
                  <Text style={[styles.thumbnailPlaceholderText, { color: theme.colors.textSecondary }]}>
                    No thumbnail
                  </Text>
                </View>
              )}
            </AppCard>

            {/* Actions Card */}
            {canEdit ? (
              <AppCard style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: ORANGE + '18' }]}>
                    <Icon name="flash" size={18} color={ORANGE} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Actions</Text>
                </View>

                <View style={styles.actionsList}>
                  <TouchableOpacity
                    style={[
                      styles.actionCardBtn,
                      {
                        backgroundColor: isPublished ? '#F59708' + '12' : '#10B981' + '12',
                        borderColor: isPublished ? '#F59708' + '40' : '#10B981' + '40',
                      },
                    ]}
                    onPress={handlePublish}
                  >
                    <View style={[styles.actionBtnIcon, { backgroundColor: isPublished ? '#F59708' + '25' : '#10B981' + '25' }]}>
                      <Icon
                        name={isPublished ? 'eye-off-outline' : 'checkmark-circle-outline'}
                        size={20}
                        color={isPublished ? '#F59708' : '#10B981'}
                      />
                    </View>
                    <View style={styles.actionBtnText}>
                      <Text style={[styles.actionBtnTitle, { color: theme.colors.textPrimary }]}>
                        {isPublished ? 'Unpublish Course' : 'Publish Course'}
                      </Text>
                      <Text style={[styles.actionBtnDesc, { color: theme.colors.textSecondary }]}>
                        {isPublished ? 'Move back to draft' : 'Make visible to students'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionCardBtn, { backgroundColor: '#EF4444' + '10', borderColor: '#EF4444' + '30' }]}
                    onPress={handleDelete}
                  >
                    <View style={[styles.actionBtnIcon, { backgroundColor: '#EF4444' + '20' }]}>
                      <Icon name="trash-outline" size={20} color="#EF4444" />
                    </View>
                    <View style={styles.actionBtnText}>
                      <Text style={[styles.actionBtnTitle, { color: theme.colors.textPrimary }]}>Delete Course</Text>
                      <Text style={[styles.actionBtnDesc, { color: theme.colors.textSecondary }]}>
                        Permanently remove this course
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </AppCard>
            ) : (
              <AppCard style={[styles.infoCard, { backgroundColor: theme.colors.infoLight || theme.colors.primary + '10' }]}>
                <Icon name="information-circle" size={20} color={theme.colors.info || theme.colors.primary} />
                <Text style={[styles.infoCardText, { color: theme.colors.info || theme.colors.primary }]}>
                  Only the course creator or instructor can edit this course.
                </Text>
              </AppCard>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showConfirmDialog}
        title="Delete Course"
        message="Are you sure you want to delete this course? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirmDialog(false)}
      />
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
    emptyWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },

    // Page Header Banner (inline styles override via JSX, this is the base)
    pageHeaderBanner: {
      // Dimensions and flex direction applied inline from the JSX
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

    // Section headers shared style
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    sectionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {      fontSize: 15,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },

    // Hero Card
    heroCard: {
      padding: 0,
      overflow: 'hidden',
    },
    heroThumbContainer: {
      height: isMobile ? 160 : 200,
      position: 'relative',
    },
    heroThumbPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroThumbImage: {
      width: '100%',
      height: '100%',
    },
    heroThumbOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    heroStatusOverlay: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    heroStatusOverlayText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    heroBody: {
      padding: isMobile ? 16 : 20,
    },
    heroHeader: {
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: isMobile ? 8 : 12,
    },
    heroTitleSection: {
      flex: isMobile ? undefined : 1,
      width: isMobile ? '100%' : undefined,
    },
    courseName: {
      fontSize: isMobile ? 20 : 24,
      fontWeight: '700',
      marginBottom: 4,
      fontFamily: theme.typography.fontFamily.bold,
      lineHeight: isMobile ? 26 : 32,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      gap: 6,
      alignSelf: 'flex-start',
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    metaBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    metaBadgeText: {
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
      gap: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    metaText: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Cards
    card: {
      padding: isMobile ? 16 : 20,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    // Topics
    topicsList: {
      gap: 8,
    },
    topicItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      gap: 10,
      borderLeftWidth: 3,
      borderWidth: 1,
      flexWrap: 'wrap',
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
      fontWeight: '500',
      fontFamily: theme.typography.fontFamily.regular,
    },
    topicChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      flex: isMobile ? undefined : 1,
      width: isMobile ? '100%' : undefined,
    },
    topicChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    topicChipText: {
      fontSize: 11,
      fontWeight: '500',
      maxWidth: 80,
    },
    topicMatCount: {
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    topicMatCountText: {
      fontSize: 12,
      fontWeight: '700',
    },
    topicExpandWrapper: {
      gap: 0,
    },

    // AI Chunks panel
    chunksPanel: {
      borderWidth: 1,
      borderTopWidth: 0,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chunksEmpty: {
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 12,
      fontStyle: 'italic',
    },
    chunkRow: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 10,
      alignItems: 'flex-start',
    },
    chunkIndex: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 1,
    },
    chunkIndexText: {
      fontSize: 11,
      fontWeight: '700',
    },
    chunkContent: {
      flex: 1,
      gap: 5,
    },
    chunkTitle: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    chunkMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    vmBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 20,
      borderWidth: 1,
    },
    vmBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    chunkBulletCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    chunkBulletCountText: {
      fontSize: 11,
    },
    chunkPreview: {
      fontSize: 12,
      lineHeight: 17,
      fontStyle: 'italic',
    },

    // Materials Grid
    materialsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    materialGridItem: {
      borderRadius: 12,
      borderWidth: 1,
      borderTopWidth: 3,
      padding: 14,
      gap: 8,
      alignItems: 'flex-start',
      ...(Platform.OS === 'web' ? {
        width: isMobile ? '100%' : 'calc(50% - 6px)',
      } : {
        width: isMobile ? '100%' : '48%',
      }),
    },
    materialGridIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    materialGridName: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    materialGridType: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    materialGridTypeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    materialDownloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    materialDownloadText: {
      fontSize: 12,
      fontWeight: '600',
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

    // Thumbnail Card (in sidebar)
    thumbnailCard: {
      padding: isMobile ? 16 : 20,
    },
    thumbContainer: {
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
    },
    thumbnailImage: {
      width: '100%',
      height: isMobile ? 200 : 180,
      borderRadius: 12,
    },
    thumbStatusBadge: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    thumbStatusText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    thumbnailPlaceholder: {
      width: '100%',
      height: isMobile ? 200 : 180,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    thumbnailPlaceholderText: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Info List
    infoList: {
      gap: 16,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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

    prereqRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
    },
    prereqChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    prereqChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    prereqChipText: {
      fontSize: 12,
      fontWeight: '700',
      maxWidth: 180,
    },

    // Actions
    actionsList: {
      gap: 10,
    },
    actionCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    actionBtnIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtnText: {
      flex: 1,
    },
    actionBtnTitle: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: 2,
    },
    actionBtnDesc: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Info Card
    infoCard: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      gap: 12,
    },
    infoCardText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });

export default CourseDetailScreen;
