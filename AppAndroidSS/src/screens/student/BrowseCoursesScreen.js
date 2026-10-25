import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, useWindowDimensions, RefreshControl,
  ActivityIndicator, Image, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import MainLayout from '../../components/ui/MainLayout';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { courseAPI } from '../../services/apiClient';
import { resolveFileUrl, slugify } from '../../utils/urlHelpers';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';
const PAGE_LIMIT = 20;

const CAT_COLORS = {
  Programming: '#6366F1', Technology: '#6366F1', Design: '#EC4899',
  Business: '#10B981', 'Data Science': '#3B82F6', Data: '#3B82F6',
  Marketing: '#F59E0B', General: ORANGE,
};

const getLevelColor = level => {
  if (level === 'Beginner') return '#10B981';
  if (level === 'Intermediate') return '#F59E0B';
  if (level === 'Advanced') return '#EF4444';
  return '#6366F1';
};

// ── Course Card ──────────────────────────────────────────────────────────────
const CourseCard = ({ course, isEnrolled, theme, isDark, onPress }) => {
  const catColor = CAT_COLORS[course.category?.name] || ORANGE;
  const thumb = course.thumbnailImage ? resolveFileUrl(course.thumbnailImage) : null;

  return (
    <TouchableOpacity
      style={[s.card, {
        backgroundColor: isDark ? '#1C2033' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF0',
      }]}
      onPress={onPress}
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
        <View style={[s.levelPill, { backgroundColor: getLevelColor(course.level) }]}>
          <Text style={s.pillTxt}>{course.level || 'All Levels'}</Text>
        </View>
        {isEnrolled && (
          <View style={s.enrollPill}>
            <Icon name="checkmark-circle" size={11} color="#fff" />
            <Text style={s.pillTxt}>Enrolled</Text>
          </View>
        )}
        {course.creationMode === 'ai' && (
          <View style={s.aiPill}>
            <Icon name="sparkles" size={10} color="#8B5CF6" />
            <Text style={[s.pillTxt, { color: '#8B5CF6' }]}>AI</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={s.cardBody}>
        <Text style={[s.catLabel, { color: catColor }]}>{course.category?.name || 'Course'}</Text>
        <Text style={[s.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {course.name}
        </Text>
        {course.user?.name && (
          <View style={s.instrRow}>
            <Icon name="person-circle-outline" size={13} color={theme.colors.textTertiary} />
            <Text style={[s.instrTxt, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {course.user.name}
            </Text>
          </View>
        )}
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
                {course.enrollmentCount.toLocaleString()}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={[s.cardBtn, { backgroundColor: isEnrolled ? '#10B981' : ORANGE }]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={s.cardBtnTxt}>{isEnrolled ? 'Continue Learning' : 'View Course'}</Text>
          <Icon name={isEnrolled ? 'play' : 'arrow-forward'} size={13} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
const BrowseCoursesScreen = () => {
  const { categories, enrollments, fetchCategories } = useData();
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();

  const isMobile      = width <= 480;
  const isTablet      = width > 768;
  const isLargeScreen = width > 1024;

  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedCategory, setSelectedCategory] = useState(route.params?.category || 'All');
  const [selectedLevel, setSelectedLevel]       = useState('All');
  const [sortOrder, setSortOrder]               = useState('newest');
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown]   = useState(false);
  const [roadmapMode, setRoadmapMode]   = useState(true);
  const [localCourses, setLocalCourses] = useState([]);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [total, setTotal]               = useState(0);
  const [loadingMore, setLoadingMore]   = useState(false);
  const didMountRef = React.useRef(false);

  const sidebarItems = getSidebarItems(user?.role);

  const levelOptions = [
    { label: 'All Levels', value: 'All' },
    { label: 'Beginner', value: 'Beginner' },
    { label: 'Intermediate', value: 'Intermediate' },
    { label: 'Advanced', value: 'Advanced' },
  ];

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Name A–Z', value: 'name-asc' },
    { label: 'Name Z–A', value: 'name-desc' },
    { label: 'Most Popular', value: 'popular' },
  ];

  useEffect(() => {
    if (route.params?.category) setSelectedCategory(route.params.category);
  }, [route.params?.category]);

  const fetchLocalCourses = useCallback(async ({ pageNum = 1, append = false } = {}) => {
    try {
      if (pageNum === 1 && !append) setLoading(true);
      else setLoadingMore(true);

      const params = { status: 'published', page: pageNum, limit: roadmapMode ? 500 : PAGE_LIMIT };
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedLevel !== 'All') params.level = selectedLevel;
      if (!roadmapMode) params.sort = sortOrder;

      const res = await courseAPI.getAll(params);
      if (!res.success) return;

      const newCourses = res.courses || [];
      setLocalCourses(prev => append ? [...prev, ...newCourses] : newCourses);
      setTotal(res.total || 0);
      setPage(pageNum);
      setHasMore(!roadmapMode && newCourses.length === PAGE_LIMIT);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load courses' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, selectedCategory, selectedLevel, sortOrder, roadmapMode]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchLocalCourses({ pageNum: 1 }), fetchCategories()]);
  }, [fetchLocalCourses, fetchCategories]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    fetchLocalCourses({ pageNum: 1 });
  }, [searchQuery, selectedCategory, selectedLevel, sortOrder, roadmapMode]);

  const loadMore = () => {
    if (hasMore && !loadingMore) fetchLocalCourses({ pageNum: page + 1, append: true });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map(e => e.courseId || e.course?.id)),
    [enrollments]
  );

  const cardWrapStyle = useMemo(() => ({
    width: isLargeScreen
      ? (Platform.OS === 'web' ? 'calc(33.333% - 11px)' : '31%')
      : isTablet
        ? (Platform.OS === 'web' ? 'calc(50% - 8px)' : '48%')
        : '100%',
  }), [isLargeScreen, isTablet]);

  // ── Roadmap helpers ────────────────────────────────────────────────────────
  const buildChains = courseList => {
    const ids     = new Set(courseList.map(c => c.id));
    const visited = new Set();
    const chains  = [];
    const roots   = courseList.filter(c => !(c.prerequisiteIds || []).some(p => ids.has(p)));

    const follow = start => {
      const chain = [start];
      visited.add(start.id);
      let cur = start;
      while (true) {
        const next = courseList.filter(c => !visited.has(c.id) && (c.prerequisiteIds || []).includes(cur.id));
        if (next.length !== 1) break;
        chain.push(next[0]); visited.add(next[0].id); cur = next[0];
      }
      return chain;
    };

    roots.forEach(root => {
      if (visited.has(root.id)) return;
      const children = courseList.filter(c => !visited.has(c.id) && (c.prerequisiteIds || []).includes(root.id));
      if (children.length <= 1) {
        chains.push(follow(root));
      } else {
        visited.add(root.id);
        children.forEach(ch => chains.push([root, ...follow(ch)]));
      }
    });
    courseList.forEach(c => { if (!visited.has(c.id)) chains.push([c]); });
    return chains;
  };

  const renderRoadmapCard = (course, si, enrolled) => (
    <TouchableOpacity
      style={[s.rmCard, {
        backgroundColor: isDark ? '#1a1f35' : '#f8f7ff',
        borderColor: enrolled ? '#10B981' : 'rgba(139,92,246,0.25)',
      }]}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('CourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
    >
      <View style={[s.stepBadge, { backgroundColor: enrolled ? '#10B981' : '#8B5CF6' }]}>
        {enrolled
          ? <Icon name="checkmark" size={12} color="#fff" />
          : <Text style={s.stepN}>{si + 1}</Text>
        }
      </View>
      {course.thumbnailImage
        ? <Image source={{ uri: resolveFileUrl(course.thumbnailImage) }} style={s.rmThumb} resizeMode="cover" />
        : <View style={[s.rmThumbFb, { backgroundColor: theme.colors.primary + '15' }]}>
            <Icon name="image-outline" size={24} color={theme.colors.primary} />
          </View>
      }
      <View style={s.rmBody}>
        <Text style={[s.rmCatTxt, { color: '#8B5CF6' }]} numberOfLines={1}>
          {course.category?.name || 'Course'}
        </Text>
        <Text style={[s.rmTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {course.name}
        </Text>
        <View style={s.rmMeta}>
          <Icon name="book-outline" size={10} color={theme.colors.textTertiary} />
          <Text style={[s.rmMetaTxt, { color: theme.colors.textTertiary }]}>{course.topics?.length || 0}</Text>
          <View style={[s.rmDot, { backgroundColor: getLevelColor(course.level) }]} />
          <Text style={[s.rmMetaTxt, { color: getLevelColor(course.level) }]}>{course.level || 'All'}</Text>
        </View>
        <View style={[s.rmBtn, { backgroundColor: enrolled ? '#10B981' : '#8B5CF6' }]}>
          <Text style={s.rmBtnTxt}>{enrolled ? 'Continue' : 'View'}</Text>
          <Icon name="arrow-forward" size={11} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderChain = (chain, ci) => (
    <Animated.View
      key={ci}
      entering={FadeInDown.duration(400).delay(ci * 80)}
      style={[s.chainBlock, {
        backgroundColor: isDark ? theme.colors.card : '#fff',
        borderColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)',
      }]}
    >
      <View style={s.chainHead}>
        <View style={[s.chainHeadIcon, { backgroundColor: '#8B5CF620' }]}>
          <Icon name="git-branch-outline" size={14} color="#8B5CF6" />
        </View>
        <Text style={[s.chainHeadTxt, { color: theme.colors.textPrimary }]}>
          {chain.length > 1 ? `Learning Path · ${chain.length} Courses` : 'Standalone Course'}
        </Text>
        <View style={[s.chainPill, { backgroundColor: chain.length > 1 ? '#8B5CF620' : '#10B98120' }]}>
          <Text style={[s.chainPillTxt, { color: chain.length > 1 ? '#8B5CF6' : '#10B981' }]}>
            {chain.length > 1 ? 'Sequential' : 'Independent'}
          </Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chainScroll}>
        {chain.map((course, si) => {
          const enrolled = enrolledCourseIds.has(course.id);
          return (
            <View key={course.id} style={s.chainStep}>
              {renderRoadmapCard(course, si, enrolled)}
              {si < chain.length - 1 && (
                <View style={s.chainArrow}>
                  <View style={[s.chainLine, { backgroundColor: '#8B5CF640' }]} />
                  <Icon name="chevron-forward" size={17} color="#8B5CF6" />
                  <View style={[s.chainLine, { backgroundColor: '#8B5CF640' }]} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const pad = isMobile ? 16 : 24;
  const hasActiveFilter = searchQuery || selectedCategory !== 'All' || selectedLevel !== 'All';

  return (
    <MainLayout
      showSidebar
      sidebarItems={sidebarItems}
      activeRoute="Courses"
      onNavigate={n => navigation.navigate(n)}
      userInfo={{ name: user?.name, role: 'Student', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: pad, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} tintColor={ORANGE} />
        }
      >
        {/* ── Page Header ── */}
        <View style={s.pageHead}>
          <Text style={[s.pageTitle, { color: theme.colors.textPrimary }]}>Course Catalog</Text>
          <Text style={[s.pageSub, { color: theme.colors.textSecondary }]}>
            {total} {total === 1 ? 'course' : 'courses'} available to explore
          </Text>
        </View>

        {/* ── Search + Mode Toggle ── */}
        <View style={[s.searchRow, { marginBottom: 14 }]}>
          <View style={[s.searchBox, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F6FA',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#DDE1E9',
          }]}>
            <Icon name="search-outline" size={18} color={theme.colors.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search courses..."
              placeholderTextColor={theme.colors.textTertiary}
              style={[s.searchInput, { color: theme.colors.textPrimary }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={17} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Grid / Roadmap toggle */}
          <View style={[s.modeToggle, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F6FA',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#DDE1E9',
          }]}>
            <TouchableOpacity
              style={[s.modeBtn, !roadmapMode && { backgroundColor: ORANGE }]}
              onPress={() => setRoadmapMode(false)}
            >
              <Icon name="grid-outline" size={18} color={!roadmapMode ? '#fff' : theme.colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, roadmapMode && { backgroundColor: '#8B5CF6' }]}
              onPress={() => setRoadmapMode(true)}
            >
              <Icon name="git-branch-outline" size={18} color={roadmapMode ? '#fff' : theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Category Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 14 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {[{ name: 'All' }, ...categories].map(cat => {
            const active = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                style={[s.chip,
                  active
                    ? { backgroundColor: ORANGE, borderColor: ORANGE }
                    : { borderColor: isDark ? 'rgba(255,255,255,0.13)' : '#DDE1E9' }
                ]}
                onPress={() => setSelectedCategory(cat.name)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipTxt, { color: active ? '#fff' : theme.colors.textSecondary }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Filter Bar ── */}
        <View style={[s.filterBar, { marginBottom: 20, zIndex: 200 }]}>
          {/* Level dropdown */}
          <View style={{ position: 'relative', zIndex: 110 }}>
            <TouchableOpacity
              style={[s.fpill, {
                borderColor: selectedLevel !== 'All' ? ORANGE + '80' : (isDark ? 'rgba(255,255,255,0.13)' : '#DDE1E9'),
                backgroundColor: selectedLevel !== 'All' ? ORANGE + '0D' : (isDark ? 'rgba(255,255,255,0.04)' : '#FAFBFD'),
              }]}
              onPress={() => { setShowLevelDropdown(v => !v); setShowSortDropdown(false); }}
            >
              <Icon name="speedometer-outline" size={14} color={selectedLevel !== 'All' ? ORANGE : theme.colors.textTertiary} />
              <Text style={[s.fpillTxt, { color: selectedLevel !== 'All' ? ORANGE : theme.colors.textPrimary }]}>
                {levelOptions.find(o => o.value === selectedLevel)?.label || 'Level'}
              </Text>
              <Icon name="chevron-down" size={13} color={selectedLevel !== 'All' ? ORANGE : theme.colors.textTertiary} />
            </TouchableOpacity>
            {showLevelDropdown && (
              <View style={[s.drop, {
                backgroundColor: isDark ? '#1C2033' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E4EB',
              }]}>
                {levelOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.dropItem, selectedLevel === opt.value && { backgroundColor: ORANGE + '12' }]}
                    onPress={() => { setSelectedLevel(opt.value); setShowLevelDropdown(false); }}
                  >
                    <Text style={[s.dropTxt, { color: selectedLevel === opt.value ? ORANGE : theme.colors.textPrimary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Sort (grid mode only) */}
          {!roadmapMode && (
            <View style={{ position: 'relative', zIndex: 100 }}>
              <TouchableOpacity
                style={[s.fpill, {
                  borderColor: isDark ? 'rgba(255,255,255,0.13)' : '#DDE1E9',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFBFD',
                }]}
                onPress={() => { setShowSortDropdown(v => !v); setShowLevelDropdown(false); }}
              >
                <Icon name="swap-vertical" size={14} color={theme.colors.textTertiary} />
                <Text style={[s.fpillTxt, { color: theme.colors.textPrimary }]}>
                  {sortOptions.find(o => o.value === sortOrder)?.label || 'Sort'}
                </Text>
                <Icon name="chevron-down" size={13} color={theme.colors.textTertiary} />
              </TouchableOpacity>
              {showSortDropdown && (
                <View style={[s.drop, {
                  backgroundColor: isDark ? '#1C2033' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E4EB',
                }]}>
                  {sortOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.dropItem, sortOrder === opt.value && { backgroundColor: ORANGE + '12' }]}
                      onPress={() => { setSortOrder(opt.value); setShowSortDropdown(false); }}
                    >
                      <Text style={[s.dropTxt, { color: sortOrder === opt.value ? ORANGE : theme.colors.textPrimary }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {hasActiveFilter && (
            <TouchableOpacity
              style={[s.fpill, { borderColor: ORANGE + '50', backgroundColor: ORANGE + '0D' }]}
              onPress={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedLevel('All'); }}
            >
              <Icon name="close" size={13} color={ORANGE} />
              <Text style={[s.fpillTxt, { color: ORANGE }]}>Clear</Text>
            </TouchableOpacity>
          )}

          <Text style={[s.resCnt, { color: theme.colors.textTertiary }]}>
            {total} {total === 1 ? 'course' : 'courses'}
          </Text>
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={s.centerState}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={[s.centerTxt, { color: theme.colors.textSecondary }]}>Loading courses...</Text>
          </View>
        ) : localCourses.length === 0 ? (
          <View style={s.centerState}>
            <Icon name="search-outline" size={52} color={ORANGE + '60'} />
            <Text style={[s.emptyTitle, { color: theme.colors.textPrimary }]}>No courses found</Text>
            <Text style={[s.emptySub, { color: theme.colors.textSecondary }]}>
              Try different filters or search terms
            </Text>
          </View>
        ) : roadmapMode ? (
          /* ── Roadmap View ── */
          <View style={{ gap: 20 }}>
            {selectedCategory === 'All'
              ? Object.entries(
                  localCourses.reduce((acc, c) => {
                    const cat = c.category?.name || 'Uncategorized';
                    (acc[cat] = acc[cat] || []).push(c);
                    return acc;
                  }, {})
                ).map(([catName, list]) => (
                  <View key={catName} style={{ gap: 12 }}>
                    <View style={s.rmCatHead}>
                      <Icon name="folder-outline" size={14} color={ORANGE} />
                      <Text style={[s.rmCatName, { color: theme.colors.textPrimary }]}>{catName}</Text>
                      <View style={[s.rmCatLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E4EB' }]} />
                    </View>
                    {buildChains(list).map((chain, ci) => renderChain(chain, ci))}
                  </View>
                ))
              : buildChains(localCourses).map((chain, ci) => renderChain(chain, ci))
            }
          </View>
        ) : (
          /* ── Grid View ── */
          <View style={s.grid}>
            {localCourses.map((course, i) => {
              const enrolled = enrolledCourseIds.has(course.id);
              return (
                <Animated.View
                  key={course.id}
                  entering={FadeInDown.duration(350).delay(Math.min(i, 8) * 45)}
                  style={cardWrapStyle}
                >
                  <CourseCard
                    course={course}
                    isEnrolled={enrolled}
                    theme={theme}
                    isDark={isDark}
                    onPress={() => navigation.navigate('CourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* ── Load More ── */}
        {hasMore && !roadmapMode && !loading && (
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
  // page header
  pageHead:  { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', marginBottom: 3 },
  pageSub:   { fontSize: 14 },

  // search
  searchRow:  { flexDirection: 'row', gap: 10 },
  searchBox:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' },

  // view toggle
  modeToggle: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  modeBtn:    { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  // category chips
  chip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipTxt: { fontSize: 13, fontWeight: '600' },

  // filter bar
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fpill:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  fpillTxt:  { fontSize: 13, fontWeight: '500' },
  drop: {
    position: 'absolute', top: '100%', left: 0, minWidth: 160,
    borderRadius: 10, borderWidth: 1, marginTop: 4, zIndex: 1000, overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } : {}),
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropTxt:  { fontSize: 13 },
  resCnt:   { fontSize: 13, marginLeft: 'auto' },

  // grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  // course card
  card:      { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  thumb:     { height: 172, position: 'relative', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbFb:   { justifyContent: 'center', alignItems: 'center' },
  levelPill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  enrollPill:{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#10B981' },
  aiPill:    { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(139,92,246,0.14)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  pillTxt:   { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody:  { padding: 14 },
  catLabel:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 6 },
  instrRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  instrTxt:  { fontSize: 12, flex: 1 },
  sep:       { height: 1, marginBottom: 10 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  statTxt:   { fontSize: 11 },
  dot:       { fontSize: 13, fontWeight: '300' },
  cardBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  cardBtnTxt:{ color: '#fff', fontSize: 13, fontWeight: '700' },

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

  // roadmap
  rmCatHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rmCatName: { fontSize: 15, fontWeight: '700' },
  rmCatLine: { flex: 1, height: 1 },
  chainBlock: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 16px rgba(139,92,246,0.08)' } : {}),
  },
  chainHead:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(139,92,246,0.1)' },
  chainHeadIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  chainHeadTxt:  { flex: 1, fontSize: 14, fontWeight: '700' },
  chainPill:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  chainPillTxt:  { fontSize: 11, fontWeight: '700' },
  chainScroll:   { padding: 16, gap: 0 },
  chainStep:     { flexDirection: 'row', alignItems: 'center' },
  chainArrow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  chainLine:     { width: 16, height: 2 },
  rmCard:     { width: 180, borderRadius: 12, borderWidth: 1.5, overflow: 'hidden' },
  stepBadge:  { position: 'absolute', top: 8, left: 8, zIndex: 1, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stepN:      { color: '#fff', fontSize: 11, fontWeight: '800' },
  rmThumb:    { width: '100%', height: 88 },
  rmThumbFb:  { width: '100%', height: 88, justifyContent: 'center', alignItems: 'center' },
  rmBody:     { padding: 10 },
  rmCatTxt:   { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  rmTitle:    { fontSize: 12, fontWeight: '700', lineHeight: 16, marginBottom: 6 },
  rmMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  rmDot:      { width: 5, height: 5, borderRadius: 3 },
  rmMetaTxt:  { fontSize: 10 },
  rmBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: 7 },
  rmBtnTxt:   { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default BrowseCoursesScreen;
