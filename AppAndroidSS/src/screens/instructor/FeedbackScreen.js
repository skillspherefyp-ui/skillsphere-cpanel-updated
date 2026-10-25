import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import StatsCard from '../../components/ui/StatsCard';
import MainLayout from '../../components/ui/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { feedbackAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';
const PAGE_LIMIT = 10;


const formatDate = d => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FeedbackScreen = () => {
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const [searchQuery, setSearchQuery]   = useState('');
  const [courses, setCourses]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [total, setTotal]               = useState(0);
  const searchTimer                     = useRef(null);

  const isLargeScreen = width > 1024;
  const isTablet      = width > 768;
  const isMobile      = width <= 480;
  const isAdmin = user?.role === 'admin';
  const sidebarItems  = getSidebarItems(user?.role);

  const handleNavigate = (route) => {
    if (isAdmin) {
      if (route === 'ManageInstructors') {
        navigation.navigate('ManageUsers', { userType: 'instructor' });
      } else if (route === 'Categories') {
        navigation.navigate('CategoryManagement');
      } else {
        navigation.navigate(route);
      }
    } else {
      navigation.navigate(route);
    }
  };

  const fetchCourses = useCallback(async ({ pageNum = 1, append = false, search = searchQuery } = {}) => {
    try {
      if (pageNum === 1 && !append) setLoading(true);
      else setLoadingMore(true);

      const params = { page: pageNum, limit: PAGE_LIMIT };
      if (search) params.search = search;

      const res = await feedbackAPI.getByCourse(params);
      if (!res.success) return;

      const newCourses = res.courses || [];
      setCourses(prev => append ? [...prev, ...newCourses] : newCourses);
      setTotal(res.total || 0);
      setPage(pageNum);
      setHasMore(pageNum < (res.totalPages || 1));
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load feedback' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => { fetchCourses({ pageNum: 1 }); }, []);

  const onSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchCourses({ pageNum: 1, search: text });
    }, 400);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses({ pageNum: 1 });
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) fetchCourses({ pageNum: page + 1, append: true });
  };

  const openDetail = (course) => navigation.navigate('CourseFeedbackDetail', {
    courseId:      course.id,
    courseName:    course.name,
    feedbacks:     course.feedbacks || [],
    avgRating:     course.avgRating,
    feedbackCount: course.feedbackCount,
  });

  // Global stats from loaded courses
  const stats = useMemo(() => {
    const allFeedbacks = courses.flatMap(c => c.feedbacks || []);
    const totalFeedback = allFeedbacks.length;
    const avgRating = totalFeedback > 0
      ? (allFeedbacks.reduce((s, f) => s + f.rating, 0) / totalFeedback).toFixed(1)
      : '0.0';
    const highRated = allFeedbacks.filter(f => f.rating >= 4).length;
    return { coursesWithFeedback: courses.length, totalFeedback, avgRating, highRated };
  }, [courses]);

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  const renderCourseCard = (course, index) => {
    const avgNum   = course.avgRating || 0;
    const avgColor = avgNum >= 4 ? '#10B981' : avgNum >= 3 ? '#F59E0B' : '#EF4444';

    return (
      <Animated.View
        key={course.id}
        entering={FadeInDown.duration(350).delay(index * 60)}
        style={styles.courseCardWrapper}
      >
        <TouchableOpacity
          style={[styles.courseCard, {
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8ECF0',
          }]}
          onPress={() => openDetail(course)}
          activeOpacity={0.75}
        >
          <View style={styles.courseHeader}>
            <View style={[styles.courseIconCircle, { backgroundColor: ORANGE + '18' }]}>
              <Icon name="book" size={18} color={ORANGE} />
            </View>
            <View style={styles.courseInfo}>
              <Text style={[styles.courseTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                {course.name}
              </Text>
              <View style={styles.courseMeta}>
                <View style={styles.metaChip}>
                  <Icon name="chatbubble-outline" size={11} color={theme.colors.textTertiary} />
                  <Text style={[styles.metaTxt, { color: theme.colors.textSecondary }]}>
                    {course.feedbackCount} {course.feedbackCount === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
                <View style={[styles.avgBadge, { backgroundColor: avgColor + '15' }]}>
                  <Icon name="star" size={11} color={avgColor} />
                  <Text style={[styles.avgTxt, { color: avgColor }]}>{course.avgRating}</Text>
                </View>
              </View>
            </View>
            <Icon name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <MainLayout
        showSidebar
        sidebarItems={sidebarItems}
        activeRoute="Feedback"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading feedback...</Text>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar
      sidebarItems={sidebarItems}
      activeRoute="Feedback"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} tintColor={ORANGE} />
        }
      >
        {/* Header Banner */}
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
              <Icon name="chatbubbles" size={22} color={ORANGE} />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>Student Feedback</Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>
                {total} {total === 1 ? 'course' : 'courses'} with reviews
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <StatsCard icon="library-outline"   color="#6366F1" value={stats.coursesWithFeedback} label="Courses w/ Reviews" />
          <StatsCard icon="chatbubbles"        color={ORANGE}  value={stats.totalFeedback}        label="Total Reviews" />
          <StatsCard icon="star"               color="#F59E0B" value={`${stats.avgRating}★`}      label="Avg Rating"
            ratio={stats.avgRating > 0 ? stats.avgRating / 5 : 0} />
          <StatsCard icon="thumbs-up"          color="#10B981" value={stats.highRated}             label="High Rated (4+)"
            ratio={stats.totalFeedback > 0 ? stats.highRated / stats.totalFeedback : 0} />
        </View>

        {/* Search */}
        <View style={[styles.searchBar, {
          backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8ECF0',
        }]}>
          <Icon name="search" size={16} color={theme.colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search courses..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <Icon name="close-circle" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Course Cards */}
        {courses.length > 0 ? (
          <>
            <View style={styles.courseList}>
              {courses.map((c, i) => renderCourseCard(c, i))}
            </View>

            {/* Load More */}
            {hasMore && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: ORANGE + '40', backgroundColor: isDark ? 'rgba(255,140,66,0.08)' : 'rgba(255,140,66,0.05)' }]}
                onPress={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={ORANGE} />
                  : <>
                      <Icon name="chevron-down" size={16} color={ORANGE} />
                      <Text style={[styles.loadMoreTxt, { color: ORANGE }]}>Load More</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            <Text style={[styles.pageInfo, { color: theme.colors.textTertiary }]}>
              Showing {courses.length} of {total} courses
            </Text>
          </>
        ) : (
          <View style={[styles.emptyCard, {
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8ECF0',
          }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.05)' }]}>
              <Icon name="chatbubbles-outline" size={36} color={theme.colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No feedback yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Student reviews will appear here after course completion
            </Text>
          </View>
        )}
      </ScrollView>
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isLargeScreen, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { padding: isMobile ? 16 : 24, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, fontFamily: theme.typography.fontFamily.regular },

    pageHeaderBanner: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isTablet ? 'center' : 'flex-start',
      padding: isMobile ? 16 : 20,
      marginBottom: 24,
      borderRadius: 16,
      borderWidth: 1,
      gap: 12,
    },
    bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: isTablet ? 1 : undefined },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    bannerIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,140,66,0.15)',
      justifyContent: 'center', alignItems: 'center',
    },
    bannerTextGroup: { flex: 1 },
    pageTitle: { fontSize: isMobile ? 18 : 22, fontWeight: '700', fontFamily: theme.typography.fontFamily.bold, marginBottom: 2 },
    pageSubtitle: { fontSize: 13, fontFamily: theme.typography.fontFamily.regular },

    statsSection: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 12 : 16,
      marginBottom: 24,
    },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: isMobile ? 8 : 10,
      marginBottom: isMobile ? 16 : 24,
      ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.05)' }),
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: theme.typography.fontFamily.regular,
      ...(Platform.OS === 'web' && { outlineWidth: 0 }),
    },

    courseList: { gap: 12 },
    courseCardWrapper: { width: '100%' },
    courseCard: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
      ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
    },
    courseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: isMobile ? 14 : 18,
    },
    courseIconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    courseInfo: { flex: 1 },
    courseTitle: { fontSize: 15, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, marginBottom: 6 },
    courseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaTxt: { fontSize: 12, fontFamily: theme.typography.fontFamily.regular },
    avgBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    avgTxt: { fontSize: 12, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold },

    feedbacksContainer: { borderTopWidth: 1, paddingHorizontal: isMobile ? 14 : 18 },
    feedbackRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: 12,
      gap: 10,
    },
    fbLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
    fbInfo: { flex: 1 },
    fbStudentName: { fontSize: 13, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, marginBottom: 3 },
    fbComment: { fontSize: 13, fontFamily: theme.typography.fontFamily.regular, fontStyle: 'italic', lineHeight: 19, marginBottom: 4 },
    fbDate: { fontSize: 11, fontFamily: theme.typography.fontFamily.regular },
    fbRight: { alignItems: 'flex-end', gap: 6 },
    ratingBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
    },
    ratingBadgeTxt: { fontSize: 11, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold },

    loadMoreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    },
    loadMoreTxt: { fontSize: 14, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold },
    pageInfo: { fontSize: 12, fontFamily: theme.typography.fontFamily.regular, textAlign: 'center', marginTop: 8 },

    emptyCard: {
      borderRadius: 16, borderWidth: 1, padding: 48, alignItems: 'center',
      ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.05)' }),
    },
    emptyIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, marginBottom: 8, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, fontFamily: theme.typography.fontFamily.regular, textAlign: 'center', maxWidth: 280 },
  });

export default FeedbackScreen;
