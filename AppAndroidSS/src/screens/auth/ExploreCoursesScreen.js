import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, useWindowDimensions, ActivityIndicator, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import ThemedView from '../../components/ThemedView';
import AppHeader from '../../components/ui/AppHeader';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { categoryAPI, courseAPI } from '../../services/apiClient';
import { resolveFileUrl, slugify } from '../../utils/urlHelpers';
import { Helmet } from 'react-helmet-async';

const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';
const NAVY2  = '#16213E';
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
const CourseCard = ({ course, isDark, onDetails, onEnroll }) => {
  const catColor = CAT_COLORS[course.category?.name] || ORANGE;
  const thumb    = course.thumbnailImage ? resolveFileUrl(course.thumbnailImage) : null;
  const textPri  = isDark ? '#FFFFFF' : NAVY;
  const textSec  = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)';
  const textTer  = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(26,26,46,0.38)';

  return (
    <TouchableOpacity
      style={[s.card, {
        backgroundColor: isDark ? '#1C2033' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF0',
      }]}
      onPress={onDetails}
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
        <Text style={[s.cardTitle, { color: textPri }]} numberOfLines={2}>{course.name}</Text>
        {course.user?.name && (
          <View style={s.instrRow}>
            <Icon name="person-circle-outline" size={13} color={textTer} />
            <Text style={[s.instrTxt, { color: textSec }]} numberOfLines={1}>{course.user.name}</Text>
          </View>
        )}
        <View style={[s.sep, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F3F8' }]} />
        <View style={s.statsRow}>
          <Icon name="layers-outline" size={12} color={textTer} />
          <Text style={[s.statTxt, { color: textTer }]}>{course.topics?.length || 0} topics</Text>
          {!!course.duration && (
            <>
              <Text style={[s.dot, { color: textTer }]}>·</Text>
              <Icon name="time-outline" size={12} color={textTer} />
              <Text style={[s.statTxt, { color: textTer }]}>{course.duration}</Text>
            </>
          )}
          {course.enrollmentCount > 0 && (
            <>
              <Text style={[s.dot, { color: textTer }]}>·</Text>
              <Icon name="people-outline" size={12} color={textTer} />
              <Text style={[s.statTxt, { color: textTer }]}>{course.enrollmentCount.toLocaleString()}</Text>
            </>
          )}
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.detailBtn, { borderColor: ORANGE }]}
            onPress={onDetails}
            activeOpacity={0.8}
          >
            <Icon name="eye-outline" size={13} color={ORANGE} />
            <Text style={[s.detailBtnTxt, { color: ORANGE }]}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.enrollBtn}
            onPress={onEnroll}
            activeOpacity={0.8}
          >
            <Icon name="person-add-outline" size={13} color="#fff" />
            <Text style={s.enrollBtnTxt}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
const ExploreCoursesScreen = () => {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const route      = useRoute();
  const { width }  = useWindowDimensions();

  const isMobile  = width < 768;
  const isTablet  = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 1200 : '100%';
  const numCols   = isDesktop ? 3 : isTablet ? 2 : 1;

  const [categories, setCategories]             = useState([]);
  const [courses, setCourses]                   = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch]                     = useState(route.params?.search || '');
  const [selectedLevel, setSelectedLevel]       = useState('All');
  const [sortOrder, setSortOrder]               = useState('newest');
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(false);
  const [page, setPage]                         = useState(1);
  const [hasMore, setHasMore]                   = useState(false);
  const [total, setTotal]                       = useState(0);
  const [loadingMore, setLoadingMore]           = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown]   = useState(false);

  const didMountRef = React.useRef(false);
  const searchTimer = React.useRef(null);

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

  const buildParams = pageNum => {
    const params = { status: 'published', page: pageNum, limit: PAGE_LIMIT };
    if (search.trim()) params.search = search.trim();
    if (selectedCategory !== 'all') {
      const catObj = categories.find(c => c.id === selectedCategory);
      if (catObj) params.category = catObj.name;
    }
    if (selectedLevel !== 'All') params.level = selectedLevel;
    if (sortOrder !== 'newest') params.sort = sortOrder;
    return params;
  };

  const applyResult = (res, append) => {
    const newCourses = res.courses || [];
    setCourses(prev => append ? [...prev, ...newCourses] : newCourses);
    setTotal(res.total || 0);
    setHasMore(newCourses.length === PAGE_LIMIT);
  };

  useFocusEffect(
    useCallback(() => {
      if (route.params?.search !== undefined) setSearch(route.params.search);
      setLoading(true); setError(false); setPage(1);
      Promise.all([
        categoryAPI.getAll(),
        courseAPI.getAll({ status: 'published', page: 1, limit: PAGE_LIMIT }),
      ])
        .then(([catRes, courseRes]) => {
          setCategories(catRes.categories || []);
          applyResult(courseRes, false);
          setPage(1);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, [route.params?.search])
  );

  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true); setError(false); setPage(1);
      courseAPI.getAll(buildParams(1))
        .then(res => applyResult(res, false))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [search, selectedCategory, selectedLevel, sortOrder]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    courseAPI.getAll(buildParams(nextPage))
      .then(res => { applyResult(res, true); setPage(nextPage); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const bgPage = isDark ? NAVY : '#F4F6FB';
  const textPri = isDark ? '#FFFFFF' : NAVY;
  const textSec = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)';
  const textTer = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(26,26,46,0.38)';
  const borderClr = isDark ? 'rgba(255,255,255,0.1)' : '#DDE1E9';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.05)' : '#FAFBFD';
  const hasActiveFilter = search || selectedCategory !== 'all' || selectedLevel !== 'All';

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      <Helmet>
        <title>Explore Courses - SkillSphere Pakistan</title>
        <meta name="description" content="Browse hundreds of expert-led online courses on SkillSphere. Learn programming, cybersecurity, data science, business, design and more in Pakistan." />
        <link rel="canonical" href="https://skillsphere.com.pk/explore" />
      </Helmet>

      <AppHeader
        showBack={true}
        showDateTime={false}
        minimal={true}
        title="Explore Courses"
        rightActions={!isMobile ? (
          <>
            <TouchableOpacity style={ec.signInBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={ec.signInTxt}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ec.signUpBtn} onPress={() => navigation.navigate('Signup')}>
              <Text style={ec.signUpTxt}>Get Started</Text>
            </TouchableOpacity>
          </>
        ) : null}
        mobileDropdownFooter={(close) => (
          <>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4, marginHorizontal: 12 }} />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 6, borderRadius: 12, gap: 12 }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('Login'), 100); }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,140,66,0.1)' }}>
                <Icon name="log-in-outline" size={18} color="#FF8C42" />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 6, borderRadius: 12, gap: 12 }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('Signup'), 100); }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,140,66,0.1)' }}>
                <Icon name="rocket-outline" size={18} color="#FF8C42" />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Get Started</Text>
            </TouchableOpacity>
          </>
        )}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%' }}>

          {/* ── Hero Banner ── */}
          <View style={[s.hero, { backgroundColor: isDark ? NAVY2 : '#fff' }]}>
            <View style={s.heroInner}>
              <View style={{ flex: 1 }}>
                <View style={s.heroTag}>
                  <Icon name="library-outline" size={13} color={ORANGE} />
                  <Text style={s.heroTagTxt}>COURSE LIBRARY</Text>
                </View>
                <Text style={[s.heroTitle, { color: textPri }]}>
                  Explore <Text style={{ color: ORANGE }}>{total}</Text> Courses
                </Text>
                <Text style={[s.heroSub, { color: textSec }]}>
                  Sign up free to start learning and earn certificates
                </Text>
              </View>
              {!isMobile && (
                <TouchableOpacity
                  style={s.heroBtn}
                  onPress={() => navigation.navigate('Signup')}
                  activeOpacity={0.85}
                >
                  <Text style={s.heroBtnTxt}>Get Started Free</Text>
                  <Icon name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search */}
            <View style={[s.searchBox, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F4F6FA',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#DDE1E9',
            }]}>
              <Icon name="search-outline" size={18} color={textTer} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search courses..."
                placeholderTextColor={textTer}
                style={[s.searchInput, { color: textPri }]}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="close-circle" size={17} color={textTer} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Category Chips ── */}
          <View style={[s.catSection, { backgroundColor: bgPage }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              {[{ id: 'all', name: `All (${total})` }, ...categories].map(cat => {
                const active = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.chip,
                      active
                        ? { backgroundColor: ORANGE, borderColor: ORANGE }
                        : { borderColor: isDark ? 'rgba(255,255,255,0.13)' : '#DDE1E9' }
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipTxt, { color: active ? '#fff' : textSec }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Filter + Results Bar ── */}
          <View style={[s.filterSection, { backgroundColor: bgPage, zIndex: 200 }]}>
            {/* Level dropdown */}
            <View style={{ position: 'relative', zIndex: 110 }}>
              <TouchableOpacity
                style={[s.fpill, {
                  borderColor: selectedLevel !== 'All' ? ORANGE + '80' : borderClr,
                  backgroundColor: selectedLevel !== 'All' ? ORANGE + '0D' : surfaceBg,
                }]}
                onPress={() => { setShowLevelDropdown(v => !v); setShowSortDropdown(false); }}
              >
                <Icon name="speedometer-outline" size={14} color={selectedLevel !== 'All' ? ORANGE : textTer} />
                <Text style={[s.fpillTxt, { color: selectedLevel !== 'All' ? ORANGE : textPri }]}>
                  {levelOptions.find(o => o.value === selectedLevel)?.label || 'Level'}
                </Text>
                <Icon name="chevron-down" size={13} color={selectedLevel !== 'All' ? ORANGE : textTer} />
              </TouchableOpacity>
              {showLevelDropdown && (
                <View style={[s.drop, { backgroundColor: isDark ? '#1C2033' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E4EB' }]}>
                  {levelOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.dropItem, selectedLevel === opt.value && { backgroundColor: ORANGE + '12' }]}
                      onPress={() => { setSelectedLevel(opt.value); setShowLevelDropdown(false); }}
                    >
                      <Text style={[s.dropTxt, { color: selectedLevel === opt.value ? ORANGE : textPri }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Sort dropdown */}
            <View style={{ position: 'relative', zIndex: 100 }}>
              <TouchableOpacity
                style={[s.fpill, { borderColor: borderClr, backgroundColor: surfaceBg }]}
                onPress={() => { setShowSortDropdown(v => !v); setShowLevelDropdown(false); }}
              >
                <Icon name="swap-vertical" size={14} color={textTer} />
                <Text style={[s.fpillTxt, { color: textPri }]}>
                  {sortOptions.find(o => o.value === sortOrder)?.label || 'Sort'}
                </Text>
                <Icon name="chevron-down" size={13} color={textTer} />
              </TouchableOpacity>
              {showSortDropdown && (
                <View style={[s.drop, { backgroundColor: isDark ? '#1C2033' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E4EB' }]}>
                  {sortOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.dropItem, sortOrder === opt.value && { backgroundColor: ORANGE + '12' }]}
                      onPress={() => { setSortOrder(opt.value); setShowSortDropdown(false); }}
                    >
                      <Text style={[s.dropTxt, { color: sortOrder === opt.value ? ORANGE : textPri }]}>
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
                onPress={() => { setSearch(''); setSelectedCategory('all'); setSelectedLevel('All'); setSortOrder('newest'); }}
              >
                <Icon name="close" size={13} color={ORANGE} />
                <Text style={[s.fpillTxt, { color: ORANGE }]}>Clear</Text>
              </TouchableOpacity>
            )}

            <Text style={[s.resCnt, { color: textTer }]}>
              {total} {total === 1 ? 'course' : 'courses'}
            </Text>
          </View>

          {/* ── Courses Grid ── */}
          <View style={[s.gridSection, { backgroundColor: bgPage, paddingHorizontal: isMobile ? 16 : 24 }]}>
            {loading ? (
              <View style={s.centerState}>
                <ActivityIndicator size="large" color={ORANGE} />
                <Text style={[s.centerTxt, { color: textSec }]}>Loading courses...</Text>
              </View>
            ) : error ? (
              <View style={s.centerState}>
                <Icon name="cloud-offline-outline" size={52} color={ORANGE + '70'} />
                <Text style={[s.centerTxt, { color: textSec }]}>Could not load courses. Check your connection.</Text>
              </View>
            ) : courses.length === 0 ? (
              <View style={s.centerState}>
                <Icon name="search-outline" size={52} color={ORANGE + '70'} />
                <Text style={[s.emptyTitle, { color: textPri }]}>No courses found</Text>
                <Text style={[s.emptySub, { color: textSec }]}>Try a different search or category</Text>
              </View>
            ) : numCols > 1 ? (
              // Multi-column grid
              (() => {
                const rows = [];
                for (let i = 0; i < courses.length; i += numCols) {
                  rows.push(courses.slice(i, i + numCols));
                }
                return rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                    {row.map(course => (
                      <View key={course.id} style={{ flex: 1 }}>
                        <CourseCard
                          course={course} isDark={isDark}
                          onDetails={() => navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
                          onEnroll={() => navigation.navigate('Signup')}
                        />
                      </View>
                    ))}
                    {row.length < numCols && Array(numCols - row.length).fill(0).map((_, i) => (
                      <View key={`ph-${i}`} style={{ flex: 1 }} />
                    ))}
                  </View>
                ));
              })()
            ) : (
              // Single column (mobile)
              courses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course} isDark={isDark}
                  onDetails={() => navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
                  onEnroll={() => navigation.navigate('Signup')}
                />
              ))
            )}

            {/* Load More */}
            {!loading && !error && hasMore && (
              <TouchableOpacity
                onPress={loadMore}
                disabled={loadingMore}
                style={[s.loadMore, { opacity: loadingMore ? 0.6 : 1 }]}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Text style={s.loadMoreTxt}>Load More</Text><Icon name="chevron-down" size={18} color="#fff" /></>
                }
              </TouchableOpacity>
            )}
          </View>

          {/* ── CTA Banner ── */}
          {!loading && (
            <View style={[s.cta, { backgroundColor: isDark ? NAVY2 : NAVY, marginHorizontal: isMobile ? 16 : 24 }]}>
              <Icon name="school-outline" size={40} color={ORANGE} style={{ marginBottom: 14 }} />
              <Text style={s.ctaTitle}>Ready to Start Learning?</Text>
              <Text style={s.ctaSub}>
                Create a free account and get instant access to all courses, AI tutor, and certificates.
              </Text>
              <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity style={s.ctaBtnPri} onPress={() => navigation.navigate('Signup')}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Create Free Account</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ctaBtnSec} onPress={() => navigation.navigate('Login')}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 48 }} />
        </View>
      </ScrollView>
    </ThemedView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // hero
  hero:      { paddingTop: 36, paddingBottom: 28, paddingHorizontal: 24 },
  heroInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  heroTag:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  heroTagTxt:{ fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 1.2 },
  heroTitle: { fontSize: 28, fontWeight: '900', lineHeight: 34, marginBottom: 6 },
  heroSub:   { fontSize: 14, lineHeight: 22 },
  heroBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ORANGE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  heroBtnTxt:{ color: '#fff', fontSize: 14, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' },

  // categories
  catSection:    { paddingVertical: 16, paddingHorizontal: 24 },
  chip:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipTxt:       { fontSize: 13, fontWeight: '600' },

  // filter
  filterSection: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 4 },
  fpill:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  fpillTxt:      { fontSize: 13, fontWeight: '500' },
  drop: {
    position: 'absolute', top: '100%', left: 0, minWidth: 160,
    borderRadius: 10, borderWidth: 1, marginTop: 4, zIndex: 1000, overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 20px rgba(0,0,0,0.13)' } : {}),
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropTxt:  { fontSize: 13 },
  resCnt:   { fontSize: 13, marginLeft: 'auto' },

  // grid section
  gridSection: { paddingTop: 4, paddingBottom: 40 },

  // card
  card:      { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  thumb:     { height: 172, position: 'relative', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbFb:   { justifyContent: 'center', alignItems: 'center' },
  levelPill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
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
  btnRow:    { flexDirection: 'row', gap: 8 },
  detailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9, borderWidth: 1.5 },
  detailBtnTxt: { fontSize: 13, fontWeight: '700' },
  enrollBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9, backgroundColor: ORANGE },
  enrollBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // states
  centerState: { alignItems: 'center', paddingVertical: 72 },
  centerTxt:   { marginTop: 14, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  emptyTitle:  { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:    { fontSize: 14, textAlign: 'center' },

  // load more
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'center', backgroundColor: ORANGE,
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12,
    marginTop: 8, marginBottom: 16, minWidth: 140,
  },
  loadMoreTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // cta
  cta:       { borderRadius: 20, padding: 44, alignItems: 'center', marginBottom: 0 },
  ctaTitle:  { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 10 },
  ctaSub:    { fontSize: 14, color: 'rgba(255,255,255,0.68)', textAlign: 'center', lineHeight: 22, maxWidth: 460 },
  ctaBtnPri: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, backgroundColor: ORANGE },
  ctaBtnSec: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
});

const ec = StyleSheet.create({
  signInBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  signInTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  signUpBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: ORANGE },
  signUpTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default ExploreCoursesScreen;
