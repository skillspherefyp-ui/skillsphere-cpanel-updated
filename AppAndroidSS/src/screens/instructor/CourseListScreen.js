import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  useWindowDimensions, ScrollView, Image, TextInput, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import StatsCard from '../../components/ui/StatsCard';
import MainLayout from '../../components/ui/MainLayout';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { courseAPI } from '../../services/apiClient';
import { resolveFileUrl, slugify } from '../../utils/urlHelpers';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE    = '#FF8C42';
const PAGE_LIMIT = 20;

const CAT_COLORS = {
  Programming: '#6366F1', Technology: '#6366F1', Design: '#EC4899',
  Business: '#10B981', 'Data Science': '#3B82F6', Data: '#3B82F6',
  Marketing: '#F59E0B', General: ORANGE,
};

const formatDate = d => {
  if (!d) return '—';
  return new Date(d).toISOString().split('T')[0];
};

// ── Course Card ──────────────────────────────────────────────────────────────
const AdminCourseCard = ({ course, theme, isDark, onEdit, onView }) => {
  const catColor    = CAT_COLORS[course.category?.name] || ORANGE;
  const thumb       = course.thumbnailImage ? resolveFileUrl(course.thumbnailImage) : null;
  const isPublished = course.status === 'published';

  return (
    <TouchableOpacity
      style={[s.card, {
        backgroundColor: isDark ? '#1C2033' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF0',
      }]}
      onPress={onView}
      activeOpacity={0.87}
    >
      {/* Thumbnail */}
      <View style={s.thumb}>
        {thumb
          ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, s.thumbFb, { backgroundColor: catColor + '18' }]}>
              <Icon name="book-outline" size={40} color={catColor} />
            </View>
        }
        <View style={[s.statusPill, { backgroundColor: isPublished ? '#10B981' : '#F59E0B' }]}>
          <View style={s.statusDot} />
          <Text style={s.statusTxt}>{isPublished ? 'Published' : 'Draft'}</Text>
        </View>
        {course.creationMode === 'ai' && (
          <View style={s.aiPill}>
            <Icon name="sparkles" size={10} color="#8B5CF6" />
            <Text style={[s.pillTxt, { color: '#8B5CF6' }]}>AI</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={s.cardBody}>
        <Text style={[s.catLabel, { color: catColor }]}>{course.category?.name || 'Uncategorized'}</Text>
        <Text style={[s.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {course.name}
        </Text>

        <View style={s.metaBlock}>
          {course.user?.name && (
            <View style={s.metaRow}>
              <Icon name="person-circle-outline" size={13} color={theme.colors.textTertiary} />
              <Text style={[s.metaTxt, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {course.user.name}
              </Text>
            </View>
          )}
          <View style={s.metaRow}>
            <Icon name="calendar-outline" size={13} color={theme.colors.textTertiary} />
            <Text style={[s.metaTxt, { color: theme.colors.textTertiary }]}>
              Updated {formatDate(course.updatedAt)}
            </Text>
          </View>
        </View>

        <View style={[s.sep, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F3F8' }]} />
        <View style={s.statsRow}>
          <Icon name="layers-outline" size={12} color={theme.colors.textTertiary} />
          <Text style={[s.statTxt, { color: theme.colors.textTertiary }]}>
            {course.topics?.length || 0} topics
          </Text>
          {!!course.duration && (
            <>
              <Text style={[s.dot, { color: theme.colors.textTertiary }]}>·</Text>
              <Icon name="time-outline" size={12} color={theme.colors.textTertiary} />
              <Text style={[s.statTxt, { color: theme.colors.textTertiary }]}>{course.duration}</Text>
            </>
          )}
          {course.enrollmentCount > 0 && (
            <>
              <Text style={[s.dot, { color: theme.colors.textTertiary }]}>·</Text>
              <Icon name="people-outline" size={12} color={theme.colors.textTertiary} />
              <Text style={[s.statTxt, { color: theme.colors.textTertiary }]}>
                {course.enrollmentCount.toLocaleString()} enrolled
              </Text>
            </>
          )}
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.editBtn, { borderColor: theme.colors.primary }]}
            onPress={onEdit}
            activeOpacity={0.8}
          >
            <Icon name="create-outline" size={14} color={theme.colors.primary} />
            <Text style={[s.editBtnTxt, { color: theme.colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.viewBtn}
            onPress={onView}
            activeOpacity={0.8}
          >
            <Icon name="eye-outline" size={14} color="#fff" />
            <Text style={s.viewBtnTxt}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
const CourseListScreen = () => {
  const { categories } = useData();
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const isMobile      = width <= 480;
  const isTablet      = width > 768;
  const isLargeScreen = width > 1024;

  const isAdmin = user?.role === 'admin';
  const sidebarItems      = getSidebarItems(user?.role);

  // Pagination + data state
  const [localCourses, setLocalCourses] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [total, setTotal]               = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery]       = useState('');
  const [statusFilter, setStatusFilter]     = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortOrder, setSortOrder]           = useState('newest');
  const [showStatusDrop, setShowStatusDrop]     = useState(false);
  const [showCategoryDrop, setShowCategoryDrop] = useState(false);
  const [showSortDrop, setShowSortDrop]         = useState(false);

  const didMountRef = React.useRef(false);

  const statusOptions = [
    { label: 'All Status',  value: null },
    { label: 'Published',   value: 'published' },
    { label: 'Draft',       value: 'draft' },
  ];

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Name A–Z',     value: 'name-asc' },
    { label: 'Name Z–A',     value: 'name-desc' },
    { label: 'Most Popular', value: 'popular' },
  ];

  const handleNavigate = route => {
    if (isAdmin) {
      if (route === 'ManageInstructors') navigation.navigate('ManageUsers', { userType: 'instructor' });
      else if (route === 'Categories') navigation.navigate('CategoryManagement');
      else navigation.navigate(route);
    } else {
      navigation.navigate(route);
    }
  };

  const buildParams = useCallback((pageNum) => {
    const params = { page: pageNum, limit: PAGE_LIMIT, sort: sortOrder };
    if (searchQuery) params.search = searchQuery;
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) {
      const cat = categories.find(c => c.id === categoryFilter);
      if (cat) params.category = cat.name;
    }
    // Non-admin instructors only see their own courses
    if (!isAdmin && user?.id) params.instructorId = user.id;
    return params;
  }, [searchQuery, statusFilter, categoryFilter, sortOrder, isAdmin, user?.id, categories]);

  const fetchCourses = useCallback(async ({ pageNum = 1, append = false } = {}) => {
    try {
      if (pageNum === 1 && !append) setLoading(true);
      else setLoadingMore(true);

      const res = await courseAPI.getAll(buildParams(pageNum));
      if (!res.success) return;

      const newCourses = res.courses || [];
      setLocalCourses(prev => append ? [...prev, ...newCourses] : newCourses);
      setTotal(res.total || 0);
      setPage(pageNum);
      setHasMore(newCourses.length === PAGE_LIMIT);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchCourses({ pageNum: 1 });
  }, []);

  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    fetchCourses({ pageNum: 1 });
  }, [searchQuery, statusFilter, categoryFilter, sortOrder]);

  const loadMore = () => {
    if (hasMore && !loadingMore) fetchCourses({ pageNum: page + 1, append: true });
  };

  // Global counts — fetched independently so they never change when a filter is active
  const [globalStats, setGlobalStats] = useState({ total: 0, published: 0, draft: 0 });

  useEffect(() => {
    const base = (!isAdmin && user?.id) ? { instructorId: user.id } : {};
    Promise.all([
      courseAPI.getAll({ ...base, limit: 1 }),
      courseAPI.getAll({ ...base, status: 'published', limit: 1 }),
      courseAPI.getAll({ ...base, status: 'draft',     limit: 1 }),
    ]).then(([all, pub, drft]) => {
      setGlobalStats({
        total:     all.total     ?? 0,
        published: pub.total     ?? 0,
        draft:     drft.total    ?? 0,
      });
    }).catch(() => {});
  }, [isAdmin, user?.id]);

  const stats = globalStats;

  const cardWrapStyle = useMemo(() => ({
    width: isLargeScreen
      ? (Platform.OS === 'web' ? 'calc(33.333% - 11px)' : '31%')
      : isTablet
        ? (Platform.OS === 'web' ? 'calc(50% - 8px)' : '48%')
        : '100%',
  }), [isLargeScreen, isTablet]);

  const pad = isMobile ? 16 : 24;
  const hasActiveFilter = searchQuery || statusFilter || categoryFilter;

  return (
    <MainLayout
      showSidebar
      sidebarItems={sidebarItems}
      activeRoute="Courses"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: pad, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page Header Banner ── */}
        <View style={[s.pageHeaderBanner, {
          backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
          borderColor: 'rgba(255,140,66,0.15)',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? 14 : 0,
        }]}>
          {/* Left side */}
          <View style={s.bannerLeft}>
            <TouchableOpacity
              style={[s.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={s.bannerIconCircle}>
              <Icon name="library" size={22} color={ORANGE} />
            </View>
            <View>
              <Text style={[s.pageTitle, { color: theme.colors.textPrimary }]}>Manage Courses</Text>
              <Text style={[s.pageSub, { color: theme.colors.textSecondary }]}>
                {globalStats.total} {globalStats.total === 1 ? 'course' : 'courses'} in your catalog
              </Text>
            </View>
          </View>
          {/* Right side */}
          <TouchableOpacity
            style={s.createBtn}
            onPress={() => navigation.navigate('CreateCourse')}
            activeOpacity={0.85}
          >
            <Icon name="add" size={18} color="#fff" />
            <Text style={s.createBtnTxt}>New Course</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats Row ── */}
        <View style={[s.statsBar, { marginBottom: 20 }]}>
          <StatsCard
            icon="library-outline"
            color="#6366F1"
            value={loading ? '—' : stats.total}
            label="Total"
            onPress={() => setStatusFilter(null)}
            isActive={!statusFilter}
          />
          <StatsCard
            icon="checkmark-circle-outline"
            color="#10B981"
            value={loading ? '—' : stats.published}
            label="Published"
            ratio={stats.total > 0 ? stats.published / stats.total : 0}
            onPress={() => setStatusFilter(statusFilter === 'published' ? null : 'published')}
            isActive={statusFilter === 'published'}
          />
          <StatsCard
            icon="time-outline"
            color="#F59E0B"
            value={loading ? '—' : stats.draft}
            label="Drafts"
            ratio={stats.total > 0 ? stats.draft / stats.total : 0}
            onPress={() => setStatusFilter(statusFilter === 'draft' ? null : 'draft')}
            isActive={statusFilter === 'draft'}
          />
        </View>

        {/* ── Toolbar ── */}
        <View style={[s.toolbar, { marginBottom: 20, zIndex: 200 }]}>
          {/* Search */}
          <View style={[s.searchBox, {
            flex: 1, minWidth: isMobile ? '100%' : 200,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F6FA',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#DDE1E9',
          }]}>
            <Icon name="search-outline" size={17} color={theme.colors.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title or category..."
              placeholderTextColor={theme.colors.textTertiary}
              style={[s.searchInput, { color: theme.colors.textPrimary }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={16} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category filter */}
          <View style={{ position: 'relative', zIndex: 110 }}>
            <TouchableOpacity
              style={[s.fpill, {
                borderColor: categoryFilter ? ORANGE + '80' : (isDark ? 'rgba(255,255,255,0.13)' : '#DDE1E9'),
                backgroundColor: categoryFilter ? ORANGE + '0D' : (isDark ? 'rgba(255,255,255,0.04)' : '#FAFBFD'),
              }]}
              onPress={() => { setShowCategoryDrop(v => !v); setShowStatusDrop(false); setShowSortDrop(false); }}
            >
              <Icon name="folder-outline" size={14} color={categoryFilter ? ORANGE : theme.colors.textTertiary} />
              <Text style={[s.fpillTxt, { color: categoryFilter ? ORANGE : theme.colors.textPrimary }]}>
                {categories.find(c => c.id === categoryFilter)?.name || 'Category'}
              </Text>
              <Icon name="chevron-down" size={13} color={categoryFilter ? ORANGE : theme.colors.textTertiary} />
            </TouchableOpacity>
            {showCategoryDrop && (
              <View style={[s.drop, { backgroundColor: isDark ? '#1C2033' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E4EB', maxHeight: 240 }]}>
                <ScrollView nestedScrollEnabled>
                  {[{ label: 'All Categories', value: null }, ...categories.map(c => ({ label: c.name, value: c.id }))].map(opt => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[s.dropItem, categoryFilter === opt.value && { backgroundColor: ORANGE + '12' }]}
                      onPress={() => { setCategoryFilter(opt.value); setShowCategoryDrop(false); }}
                    >
                      <Text style={[s.dropTxt, { color: categoryFilter === opt.value ? ORANGE : theme.colors.textPrimary }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Sort */}
          <View style={{ position: 'relative', zIndex: 100 }}>
            <TouchableOpacity
              style={[s.fpill, {
                borderColor: isDark ? 'rgba(255,255,255,0.13)' : '#DDE1E9',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFBFD',
              }]}
              onPress={() => { setShowSortDrop(v => !v); setShowStatusDrop(false); setShowCategoryDrop(false); }}
            >
              <Icon name="swap-vertical" size={14} color={theme.colors.textTertiary} />
              <Text style={[s.fpillTxt, { color: theme.colors.textPrimary }]}>
                {sortOptions.find(o => o.value === sortOrder)?.label || 'Sort'}
              </Text>
              <Icon name="chevron-down" size={13} color={theme.colors.textTertiary} />
            </TouchableOpacity>
            {showSortDrop && (
              <View style={[s.drop, { backgroundColor: isDark ? '#1C2033' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E4EB' }]}>
                {sortOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.dropItem, sortOrder === opt.value && { backgroundColor: ORANGE + '12' }]}
                    onPress={() => { setSortOrder(opt.value); setShowSortDrop(false); }}
                  >
                    <Text style={[s.dropTxt, { color: sortOrder === opt.value ? ORANGE : theme.colors.textPrimary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {hasActiveFilter && (
            <TouchableOpacity
              style={[s.fpill, { borderColor: ORANGE + '50', backgroundColor: ORANGE + '0D' }]}
              onPress={() => { setSearchQuery(''); setStatusFilter(null); setCategoryFilter(null); }}
            >
              <Icon name="close" size={13} color={ORANGE} />
              <Text style={[s.fpillTxt, { color: ORANGE }]}>Clear</Text>
            </TouchableOpacity>
          )}

          {!loading && (
            <Text style={[s.resCnt, { color: theme.colors.textTertiary }]}>
              {total} {total === 1 ? 'course' : 'courses'}
            </Text>
          )}
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={s.centerState}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={[s.centerTxt, { color: theme.colors.textSecondary }]}>Loading courses...</Text>
          </View>
        ) : localCourses.length === 0 ? (
          <View style={s.centerState}>
            <Icon name="book-outline" size={52} color={ORANGE + '60'} />
            <Text style={[s.emptyTitle, { color: theme.colors.textPrimary }]}>
              {hasActiveFilter ? 'No courses match your filters' : 'No courses yet'}
            </Text>
            <Text style={[s.emptySub, { color: theme.colors.textSecondary }]}>
              {hasActiveFilter ? 'Try adjusting your filters' : 'Create your first course to get started'}
            </Text>
            {!hasActiveFilter && (
              <TouchableOpacity
                style={[s.createBtnAlt, { backgroundColor: ORANGE }]}
                onPress={() => navigation.navigate('CreateCourse')}
              >
                <Icon name="add" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Create Course</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.grid}>
            {localCourses.map((course, i) => (
              <Animated.View
                key={course.id}
                entering={FadeInDown.duration(350).delay(Math.min(i, 8) * 45)}
                style={cardWrapStyle}
              >
                <AdminCourseCard
                  course={course}
                  theme={theme}
                  isDark={isDark}
                  onEdit={() => navigation.navigate('CreateCourse', { courseId: course.id, courseData: course })}
                  onView={() => navigation.navigate('CourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* ── Load More ── */}
        {hasMore && !loading && (
          <TouchableOpacity
            onPress={loadMore}
            disabled={loadingMore}
            style={[s.loadMore, { opacity: loadingMore ? 0.6 : 1 }]}
          >
            {loadingMore
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Text style={s.loadMoreTxt}>Load More</Text><Icon name="chevron-down" size={16} color="#fff" /></>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </MainLayout>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // page header banner
  pageHeaderBanner: {
    justifyContent: 'space-between',
    padding: 20,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  backButton: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,140,66,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  pageSub:      { fontSize: 13 },
  createBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 12, alignSelf: 'flex-start',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 12px rgba(255,140,66,0.3)' } : {}),
  },
  createBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  createBtnAlt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, marginTop: 20 },

  // stats bar
  statsBar: { flexDirection: 'row', gap: 12 },

  // toolbar
  toolbar:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' },
  fpill:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  fpillTxt:    { fontSize: 13, fontWeight: '500' },
  drop: {
    position: 'absolute', top: '100%', left: 0, minWidth: 170,
    borderRadius: 10, borderWidth: 1, marginTop: 4, zIndex: 1000, overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } : {}),
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropTxt:  { fontSize: 13 },
  resCnt:   { fontSize: 13, marginLeft: 'auto' },

  // grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  // card
  card:      { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  thumb:     { height: 162, position: 'relative', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbFb:   { justifyContent: 'center', alignItems: 'center' },
  statusPill:{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  statusTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  aiPill:    { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(139,92,246,0.14)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  pillTxt:   { fontSize: 10, fontWeight: '700' },
  cardBody:  { padding: 14 },
  catLabel:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 10 },
  metaBlock: { gap: 5, marginBottom: 10 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt:   { fontSize: 12, flex: 1 },
  sep:       { height: 1, marginBottom: 10 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  statTxt:   { fontSize: 11 },
  dot:       { fontSize: 13, fontWeight: '300' },
  actionRow: { flexDirection: 'row', gap: 8 },
  editBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9, borderWidth: 1.5 },
  editBtnTxt:{ fontSize: 13, fontWeight: '700' },
  viewBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9, backgroundColor: ORANGE },
  viewBtnTxt:{ color: '#fff', fontSize: 13, fontWeight: '700' },

  // states
  centerState: { alignItems: 'center', paddingVertical: 80 },
  centerTxt:   { marginTop: 14, fontSize: 14 },
  emptyTitle:  { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:    { fontSize: 14, textAlign: 'center' },

  // load more
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'center', backgroundColor: ORANGE,
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12,
    marginTop: 24, marginBottom: 8, minWidth: 140,
  },
  loadMoreTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default CourseListScreen;
