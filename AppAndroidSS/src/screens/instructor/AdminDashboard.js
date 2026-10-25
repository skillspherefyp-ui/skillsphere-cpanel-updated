import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import MainLayout from '../../components/ui/MainLayout';
import UserAvatar from '../../components/ui/UserAvatar';
import AppCard from '../../components/ui/AppCard';
import StatusBadge from '../../components/ui/StatusBadge';
import Skeleton, { SkeletonDashboardStats, SkeletonTableRow } from '../../components/ui/Skeleton';
import { instructorAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getMonthName = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[new Date(date).getMonth()];
};

const getLast6Months = () => {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: getMonthName(date),
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
    });
  }
  return months;
};

const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  return change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
};

// ============================================
// CUSTOM CHART COMPONENTS
// ============================================

// EduView-style pill-track bar chart (no y-axis, clean)
const BarChart = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const maxIndex = data.reduce((best, d, i, arr) => (d.value >= arr[best].value ? i : best), 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={[barChartStyles.barsContainer, { flex: 1 }]}>
        {data.map((item, index) => {
          const barHeightPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const isActive = index === maxIndex;
          return (
            <View key={index} style={barChartStyles.barWrapper}>
              <View style={barChartStyles.barTrack} />
              <View style={[barChartStyles.bar, {
                height: `${Math.max(barHeightPct, 3)}%`,
                backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
              }]}>
                {item.value > 0 && <Text style={barChartStyles.barValue}>{item.value}</Text>}
              </View>
            </View>
          );
        })}
      </View>
      <View style={barChartStyles.xAxis}>
        {data.map((item, index) => (
          <Text key={index} style={barChartStyles.xLabel}>{item.label}</Text>
        ))}
      </View>
    </View>
  );
};

const barChartStyles = StyleSheet.create({
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    position: 'relative',
    paddingHorizontal: 3,
  },
  barTrack: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
  },
  bar: {
    width: 28,
    borderRadius: 14,
    minHeight: 4,
    alignItems: 'center',
    paddingTop: 5,
    justifyContent: 'flex-start',
  },
  barValue: { color: '#fff', fontSize: 9, fontWeight: '700' },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  xLabel: {
    fontSize: 11,
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
});

// Horizontal bar chart — rows fill full card height evenly
const HorizontalBarChart = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const maxIndex = data.reduce((best, d, i, arr) => (d.value >= arr[best].value ? i : best), 0);

  return (
    <View style={hBarStyles.container}>
      {data.map((item, index) => {
        const widthPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const isActive = index === maxIndex;
        return (
          <View key={index} style={hBarStyles.row}>
            <Text style={hBarStyles.label}>{item.label}</Text>
            <View style={hBarStyles.trackWrap}>
              <View style={hBarStyles.track} />
              <View style={[hBarStyles.fill, {
                width: `${Math.max(widthPct, 3)}%`,
                backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
              }]} />
            </View>
            <Text style={[hBarStyles.value, { opacity: isActive ? 1 : 0.65 }]}>
              {item.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const hBarStyles = StyleSheet.create({
  container: { flex: 1, paddingTop: 4, justifyContent: 'space-between' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 30, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textAlign: 'right' },
  trackWrap: { flex: 1, height: 12, position: 'relative', justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: 12, borderRadius: 6, minWidth: 4 },
  value: { width: 28, fontSize: 12, fontWeight: '700', color: '#FFFFFF', textAlign: 'right' },
});

// ============================================
// REDESIGNED DASHBOARD STAT CARD COMPONENT
// ============================================

const DashboardStatCard = ({ icon, iconColor, value, label, change, theme, isDark, style, onPress }) => {
  const { width } = useWindowDimensions();
  const isMobile = width <= 480;
  const isWeb = Platform.OS === 'web';
  const isPositive = !change || change.startsWith('+');
  const changeColor = isPositive ? '#10B981' : '#EF4444';
  const changeIcon  = isPositive ? 'trending-up' : 'trending-down';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        dsc.card,
        {
          backgroundColor: isDark ? `${iconColor}14` : `${iconColor}0d`,
          borderColor: `${iconColor}30`,
          borderLeftColor: iconColor,
        },
        isWeb && !isDark ? { boxShadow: '0 4px 20px rgba(0,0,0,0.06)' } : {},
        style,
      ]}
    >
      {/* Watermark icon — large, faint, top-right corner */}
      <View style={dsc.watermark} pointerEvents="none">
        <Icon name={icon} size={72} color={iconColor} style={{ opacity: 0.08 }} />
      </View>

      {/* Top row: small icon badge + label + chevron */}
      <View style={dsc.topRow}>
        <View style={[dsc.iconBadge, { backgroundColor: `${iconColor}22` }]}>
          <Icon name={icon} size={15} color={iconColor} />
        </View>
        <Text style={[dsc.label, { color: isDark ? `${iconColor}cc` : `${iconColor}bb` }]} numberOfLines={1}>
          {label}
        </Text>
        {onPress && <Icon name="chevron-forward" size={13} color={`${iconColor}80`} />}
      </View>

      {/* Value */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[dsc.value, {
          color: isDark ? '#FFFFFF' : '#0F172A',
          fontSize: isMobile ? 28 : 36,
        }]}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>

      {/* Change badge */}
      {change ? (
        <View style={[dsc.badge, { backgroundColor: `${changeColor}18`, borderColor: `${changeColor}30` }]}>
          <Icon name={changeIcon} size={12} color={changeColor} />
          <Text style={[dsc.badgeText, { color: changeColor }]}>{change} vs last month</Text>
        </View>
      ) : (
        <View style={dsc.badgePlaceholder} />
      )}
    </Wrapper>
  );
};

const dsc = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  value: {
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgePlaceholder: {
    height: 26,
  },
});

// ============================================
// MAIN COMPONENT
// ============================================

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { courses, students, experts, fetchCourses, fetchStudents, fetchExperts, notifications, fetchMyNotifications } = useData();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [instructors, setInstructors] = useState([]);

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  const sidebarItems = getSidebarItems('admin');

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoading) {
        reloadData();
      }
    }, [initialLoading])
  );

  const loadData = async () => {
    try {
      await Promise.all([fetchCourses(), fetchStudents(), fetchExperts(), fetchMyNotifications()]);
      // Fetch instructors (filter to only role === 'instructor')
      try {
        const instructorRes = await instructorAPI.getAll();
        if (instructorRes.success && instructorRes.users) {
          const onlyInstructors = instructorRes.users.filter(u => u.role === 'instructor');
          setInstructors(onlyInstructors);
        }
      } catch (e) {
        console.log('Could not fetch instructors:', e);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const reloadData = async () => {
    try {
      await Promise.all([fetchCourses(), fetchStudents(), fetchExperts()]);
      // Refresh instructors (filter to only role === 'instructor')
      try {
        const instructorRes = await instructorAPI.getAll();
        if (instructorRes.success && instructorRes.users) {
          const onlyInstructors = instructorRes.users.filter(u => u.role === 'instructor');
          setInstructors(onlyInstructors);
        }
      } catch (e) {
        console.log('Could not refresh instructors:', e);
      }
    } catch (error) {
      console.error('Error reloading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleNavigate = (route) => {
    if (route === 'ManageInstructors') {
      navigation.navigate('ManageUsers', { userType: 'instructor' });
    } else if (route === 'Categories') {
      navigation.navigate('CategoryManagement');
    } else {
      navigation.navigate(route);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const studentsLastMonth = students.filter(s => new Date(s.createdAt) < thisMonth).length;
    const coursesLastMonth = courses.filter(c => new Date(c.createdAt) < thisMonth).length;

    return {
      totalInstructors: instructors.length,
      totalExperts: experts?.length || 0,
      totalCourses: courses.length,
      totalStudents: students.length,
      publishedCourses: courses.filter(c => c.status === 'published').length,
      activeStudents: students.filter(s => s.isActive !== false).length,
      instructorChange: '+2',
      expertChange: '+5%',
      courseChange: calculatePercentageChange(courses.length, coursesLastMonth),
      studentChange: calculatePercentageChange(students.length, studentsLastMonth),
    };
  }, [courses, students, experts, instructors]);

  // Build user growth chart data
  const userGrowthData = useMemo(() => {
    const last6Months = getLast6Months();
    const colors = ['#6366F1', '#6366F1', '#818CF8', '#818CF8', '#A78BFA', '#C4B5FD'];

    return last6Months.map((monthData, index) => {
      const usersUpToMonth = students.filter(student => {
        const createdDate = new Date(student.createdAt);
        return (
          createdDate.getFullYear() < monthData.year ||
          (createdDate.getFullYear() === monthData.year && createdDate.getMonth() <= monthData.monthIndex)
        );
      }).length;

      return {
        label: monthData.month,
        value: usersUpToMonth,
        color: colors[index],
      };
    });
  }, [students]);

  // Build course growth chart data
  const courseGrowthData = useMemo(() => {
    const last6Months = getLast6Months();

    return last6Months.map((monthData) => {
      const coursesUpToMonth = courses.filter(course => {
        const createdDate = new Date(course.createdAt);
        return (
          createdDate.getFullYear() < monthData.year ||
          (createdDate.getFullYear() === monthData.year && createdDate.getMonth() <= monthData.monthIndex)
        );
      }).length;

      return {
        label: monthData.month,
        value: coursesUpToMonth,
      };
    });
  }, [courses]);

  // Platform insights: course status breakdown + top enrollments
  const platformInsights = useMemo(() => {
    const published = courses.filter(c => c.status === 'published').length;
    const draft = courses.filter(c => c.status !== 'published').length;

    const totalEnrollments = courses.reduce((sum, c) => sum + (c.enrollmentCount || 0), 0);
    const avgEnrollment = courses.length > 0 ? (totalEnrollments / courses.length).toFixed(1) : '0.0';

    const topCourses = courses
      .map(course => ({ name: course.name || 'Untitled', count: course.enrollmentCount || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const maxEnroll = Math.max(...topCourses.map(c => c.count), 1);

    return { published, draft, totalEnrollments, avgEnrollment, topCourses, maxEnroll };
  }, [courses]);

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (initialLoading) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Dashboard"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: 'Admin', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Loading banner */}
          <View style={styles.pageBanner}>
            <View style={styles.bannerLeft}>
              <View style={[styles.bannerIconCircle, { backgroundColor: '#8B5CF6' + '20' }]}>
                <Icon name="shield-checkmark" size={24} color="#8B5CF6" />
              </View>
              <View>
                <Text style={[styles.bannerTitle, { color: theme.colors.textPrimary }]}>Admin Dashboard</Text>
                <Text style={[styles.bannerSubtitle, { color: theme.colors.textSecondary }]}>
                  System-wide management and overview
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.section}>
            <SkeletonDashboardStats count={4} />
          </View>
        </ScrollView>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Dashboard"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: 'Admin', avatar: user?.avatar }}
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
        {/* Page Banner — replaces PageTitleRow */}
        <View style={styles.pageBanner}>
          <View style={styles.bannerLeft}>
            <View style={[styles.bannerIconCircle, { backgroundColor: '#8B5CF6' + '20' }]}>
              <Icon name="shield-checkmark" size={24} color="#8B5CF6" />
            </View>
            <View>
              <Text style={[styles.bannerTitle, { color: theme.colors.textPrimary }]}>Admin Dashboard</Text>
              <Text style={[styles.bannerSubtitle, { color: theme.colors.textSecondary }]}>
                Welcome back! You have full system control.
              </Text>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={[styles.notificationBellBtn, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? theme.colors.border : '#EEEEEE' }]}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Icon name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={20} color={unreadCount > 0 ? '#FF8C42' : theme.colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.notificationBellBadge}>
                  <Text style={styles.notificationBellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('ManageUsers', { userType: 'instructor' })}
            >
              <Icon name="person-add" size={16} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Add Instructor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <DashboardStatCard
            icon="person-outline"
            iconColor="#6366F1"
            value={stats.totalInstructors}
            label="Total Instructors"
            change={stats.instructorChange}
            theme={theme}
            isDark={isDark}
            style={styles.statCard}
            onPress={() => navigation.navigate('ManageUsers', { userType: 'instructor' })}
          />
          <DashboardStatCard
            icon="book-outline"
            iconColor="#10B981"
            value={stats.totalCourses}
            label="Total Courses"
            change={stats.courseChange}
            theme={theme}
            isDark={isDark}
            style={styles.statCard}
            onPress={() => navigation.navigate('Courses')}
          />
          <DashboardStatCard
            icon="school-outline"
            iconColor="#22D3EE"
            value={stats.totalStudents}
            label="Total Students"
            change={stats.studentChange}
            theme={theme}
            isDark={isDark}
            style={styles.statCard}
            onPress={() => navigation.navigate('StudentList')}
          />
        </View>

        {/* Charts Section */}
        <View style={styles.chartsSection}>

          {/* User Growth — amber colored card */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.chartCard}>
            <View style={[styles.coloredChartCard, { backgroundColor: '#B45309' }]}>
              <View style={styles.coloredChartHeader}>
                <View style={styles.coloredChartHeaderLeft}>
                  <View style={styles.coloredChartIconBadge}>
                    <Icon name="bar-chart" size={15} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.coloredChartTitle}>User Growth</Text>
                    <Text style={styles.coloredChartSubtitle}>Registered users · last 6 months</Text>
                  </View>
                </View>
                <View style={styles.coloredChartBadge}>
                  <Icon name="trending-up" size={12} color="#FFFFFF" />
                  <Text style={styles.coloredChartBadgeText}>{stats.studentChange}</Text>
                </View>
              </View>
              <BarChart data={userGrowthData} />
            </View>
          </Animated.View>

          {/* Course Growth — navy colored card */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.chartCard}>
            <View style={[styles.coloredChartCard, { backgroundColor: '#1E3A5F' }]}>
              <View style={styles.coloredChartHeader}>
                <View style={styles.coloredChartHeaderLeft}>
                  <View style={styles.coloredChartIconBadge}>
                    <Icon name="book" size={15} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.coloredChartTitle}>Course Growth</Text>
                    <Text style={styles.coloredChartSubtitle}>Cumulative courses · last 6 months</Text>
                  </View>
                </View>
                <View style={styles.coloredChartBadge}>
                  <Icon name="trending-up" size={12} color="#FFFFFF" />
                  <Text style={styles.coloredChartBadgeText}>{stats.courseChange}</Text>
                </View>
              </View>
              <HorizontalBarChart data={courseGrowthData} />
            </View>
          </Animated.View>

          {/* Platform Insights — neutral card */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.chartCard}>
            <AppCard style={[styles.chartCardInner, { paddingBottom: 20, flex: 1 }]}>
              <View style={styles.chartHeader}>
                <View style={styles.chartHeaderLeft}>
                  <View style={[styles.chartIconBadge, { backgroundColor: '#F59E0B18' }]}>
                    <Icon name="analytics" size={15} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={[styles.chartTitle, { color: theme.colors.textPrimary }]}>Platform Insights</Text>
                    <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>Course status & top enrollments</Text>
                  </View>
                </View>
              </View>

              {/* Course status breakdown */}
              <View style={styles.insightSection}>
                <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>Course Status</Text>
                <View style={styles.statusSegmentRow}>
                  <View style={[styles.statusSegment, {
                    flex: platformInsights.published,
                    backgroundColor: '#10B981',
                    borderTopLeftRadius: 6,
                    borderBottomLeftRadius: 6,
                  }]} />
                  <View style={[styles.statusSegment, {
                    flex: Math.max(platformInsights.draft, 0.01),
                    backgroundColor: isDark ? '#374151' : '#D1D5DB',
                    borderTopRightRadius: 6,
                    borderBottomRightRadius: 6,
                  }]} />
                </View>
                <View style={styles.statusLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                      Published ({platformInsights.published})
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: isDark ? '#374151' : '#D1D5DB' }]} />
                    <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                      Draft ({platformInsights.draft})
                    </Text>
                  </View>
                </View>
              </View>

              {/* User role metrics */}
              <View style={[styles.insightMetricsRow, { borderColor: theme.colors.border }]}>
                <View style={styles.insightMetric}>
                  <View style={[styles.insightMetricIcon, { backgroundColor: '#6366F118' }]}>
                    <Icon name="person" size={14} color="#6366F1" />
                  </View>
                  <Text style={[styles.insightMetricValue, { color: theme.colors.textPrimary }]}>
                    {stats.totalInstructors}
                  </Text>
                  <Text style={[styles.insightMetricLabel, { color: theme.colors.textSecondary }]}>
                    Instructors
                  </Text>
                </View>
                <View style={[styles.insightMetricDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.insightMetric}>
                  <View style={[styles.insightMetricIcon, { backgroundColor: '#22D3EE18' }]}>
                    <Icon name="school" size={14} color="#22D3EE" />
                  </View>
                  <Text style={[styles.insightMetricValue, { color: theme.colors.textPrimary }]}>
                    {stats.totalStudents}
                  </Text>
                  <Text style={[styles.insightMetricLabel, { color: theme.colors.textSecondary }]}>
                    Students
                  </Text>
                </View>
              </View>

              {/* Top courses by enrollment */}
              {platformInsights.topCourses.length > 0 && (
                <View style={styles.insightSection}>
                  <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>Top Courses by Enrollment</Text>
                  {platformInsights.topCourses.map((course, i) => (
                    <View key={i} style={styles.topCourseRow}>
                      <Text style={[styles.topCourseRank, { color: theme.colors.textTertiary }]}>#{i + 1}</Text>
                      <View style={styles.topCourseBarWrap}>
                        <Text style={[styles.topCourseName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {course.name}
                        </Text>
                        <View style={[styles.topCourseTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
                          <View style={[styles.topCourseBar, {
                            width: `${(course.count / platformInsights.maxEnroll) * 100}%`,
                            backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5],
                          }]} />
                        </View>
                      </View>
                      <Text style={[styles.topCourseCount, { color: theme.colors.textSecondary }]}>{course.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </AppCard>
          </Animated.View>

        </View>

        {/* Instructors Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: '#6366F1' + '15' }]}>
                <Icon name="person" size={16} color="#6366F1" />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Instructors
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  {instructors.length} total instructors
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.manageButton, { borderColor: '#6366F1' }]}
              onPress={() => navigation.navigate('ManageUsers', { userType: 'instructor' })}
            >
              <Text style={[styles.manageButtonText, { color: '#6366F1' }]}>Manage</Text>
              <Icon name="chevron-forward" size={14} color="#6366F1" />
            </TouchableOpacity>
          </View>

          <AppCard style={styles.tableCard}>
            {instructors.length > 0 ? (
              instructors.slice(0, 5).map((instructor, index) => (
                <View
                  key={instructor.id || index}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(99,102,241,0.03)',
                    },
                    index < Math.min(instructors.length, 5) - 1 && {
                      borderBottomColor: theme.colors.border,
                      borderBottomWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.userRowLeft}>
                    <UserAvatar user={instructor} size={38} />
                    <View style={styles.userDetails}>
                      <Text style={[styles.userName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {instructor.name || 'Unknown'}
                      </Text>
                      <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {instructor.email || '-'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: instructor.isActive !== false ? '#10B98115' : '#EF444415' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: instructor.isActive !== false ? '#10B981' : '#EF4444' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: instructor.isActive !== false ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {instructor.isActive !== false ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No instructors found
                </Text>
              </View>
            )}
          </AppCard>
        </View>

        {/* Students Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: '#22D3EE' + '15' }]}>
                <Icon name="school" size={16} color="#22D3EE" />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Students
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  {students.length} total students
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.manageButton, { borderColor: '#22D3EE' }]}
              onPress={() => navigation.navigate('Students')}
            >
              <Text style={[styles.manageButtonText, { color: '#22D3EE' }]}>View All</Text>
              <Icon name="chevron-forward" size={14} color="#22D3EE" />
            </TouchableOpacity>
          </View>

          <AppCard style={styles.tableCard}>
            {students.length > 0 ? (
              students.slice(0, 5).map((student, index) => (
                <View
                  key={student.id || index}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(34,211,238,0.03)',
                    },
                    index < Math.min(students.length, 5) - 1 && {
                      borderBottomColor: theme.colors.border,
                      borderBottomWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.userRowLeft}>
                    <UserAvatar user={student} size={38} />
                    <View style={styles.userDetails}>
                      <Text style={[styles.userName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {student.name || 'Unknown'}
                      </Text>
                      <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {student.email || '-'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: student.isActive !== false ? '#10B98115' : '#EF444415' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: student.isActive !== false ? '#10B981' : '#EF4444' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: student.isActive !== false ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {student.isActive !== false ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No students found
                </Text>
              </View>
            )}
          </AppCard>
        </View>
      </ScrollView>
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isLargeScreen, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    section: { paddingHorizontal: isMobile ? 16 : 24, marginBottom: 24 },

    // ---- Page Banner ----
    pageBanner: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isTablet ? 'center' : 'flex-start',
      paddingHorizontal: isMobile ? 16 : 24,
      paddingVertical: 20,
      marginBottom: 8,
      gap: 12,
    },
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: isTablet ? 1 : undefined,
    },
    bannerIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerTitle: {
      fontSize: isMobile ? 20 : 26,
      fontWeight: '800',
    },
    bannerSubtitle: {
      fontSize: 13,
      marginTop: 2,
    },
    bannerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    notificationBellBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    notificationBellBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#EF4444',
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    notificationBellBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: '#FF8C42',
    },
    createBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },

    // ---- Section Header ----
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {      fontSize: 16,
      fontWeight: '600',
      fontFamily: theme.typography?.fontFamily?.semiBold,
    },
    sectionSubtitle: { fontSize: 12, marginTop: 2 },

    // Stats Section
    statsSection: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: isMobile ? 16 : 24,
      gap: isMobile ? 12 : 16,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      minWidth: isMobile ? '47%' : isLargeScreen ? 200 : isTablet ? 170 : 140,
    },

    // Charts Section
    chartsSection: {
      flexDirection: isLargeScreen ? 'row' : 'column',
      flexWrap: isLargeScreen ? 'wrap' : 'nowrap',
      paddingHorizontal: isMobile ? 16 : 24,
      gap: 16,
      marginBottom: 24,
    },
    chartCard: {
      flex: 1,
      minWidth: isLargeScreen ? 280 : isTablet ? '47%' : '100%',
      alignSelf: 'stretch',
    },
    chartCardInner: { padding: isMobile ? 16 : 20 },

    // Colored chart card (amber/navy backgrounds)
    coloredChartCard: {
      flex: 1,
      flexDirection: 'column',
      borderRadius: 16,
      padding: isMobile ? 16 : 20,
      overflow: 'hidden',
    },
    coloredChartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 18,
    },
    coloredChartHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    coloredChartIconBadge: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    coloredChartTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    coloredChartSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    coloredChartBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },
    coloredChartBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

    // Neutral chart card header
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    chartHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    chartIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#6366F118',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartTitle: { fontSize: 15, fontWeight: '700' },
    chartSubtitle: { fontSize: 12, marginTop: 3 },

    // Platform insights styles
    insightSection: { marginTop: 16 },
    insightLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    statusSegmentRow: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
    },
    statusSegment: { height: '100%' },
    statusLegendRow: { flexDirection: 'row', gap: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12 },
    insightMetricsRow: {
      flexDirection: 'row',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
    },
    insightMetric: { flex: 1, alignItems: 'center', gap: 4 },
    insightMetricIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    insightMetricDivider: { width: 1, height: '100%' },
    insightMetricValue: { fontSize: 20, fontWeight: '800' },
    insightMetricLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
    topCourseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    topCourseRank: { fontSize: 11, fontWeight: '700', width: 22 },
    topCourseBarWrap: { flex: 1 },
    topCourseName: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
    topCourseTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    topCourseBar: { height: '100%', borderRadius: 3, minWidth: 4 },
    topCourseCount: { fontSize: 12, fontWeight: '600', width: 24, textAlign: 'right' },

    // Manage button
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1.5,
    },
    manageButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },

    // Table
    tableCard: { padding: 0, overflow: 'hidden' },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: isMobile ? 12 : 14,
      paddingHorizontal: isMobile ? 14 : 18,
    },
    userRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: isMobile ? 10 : 14,
    },
    userAvatar: {
      width: isMobile ? 38 : 42,
      height: isMobile ? 38 : 42,
      borderRadius: isMobile ? 19 : 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userAvatarText: {
      color: '#FFFFFF',
      fontSize: isMobile ? 14 : 16,
      fontWeight: '600',
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      fontSize: isMobile ? 14 : 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    userEmail: {
      fontSize: isMobile ? 12 : 13,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isMobile ? 10 : 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusPillText: {
      fontSize: isMobile ? 11 : 12,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
    },
  });

export default AdminDashboard;
