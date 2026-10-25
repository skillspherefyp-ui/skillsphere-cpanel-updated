import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Animated,
  Image,
  ScrollView,
  Modal,
  PanResponder,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from './UserAvatar';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { courseAPI, categoryAPI } from '../../services/apiClient';

// PNG logo (same asset as Sidebar)
const LogoImage = require('../../assets/images/skillsphere-logo.png');


// ── Component ────────────────────────────────────────────────────────────────
const AppHeader = ({
  showBack = true,
  rightActions,
  forceShowBack = false,
  onBack = null,
  leftComponent,
  style,
  showDateTime = true,
  navItems = [],
  activeRoute,
  onNavigate,
  mobileDropdownFooter = null,
  title = null,
  minimal = false,
}) => {
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { width, height: screenHeight } = useWindowDimensions();

  // ── Search state ────────────────────────────────────────────────────────
  const [searchText, setSearchText]         = useState('');
  const [searchFocused, setSearchFocused]   = useState(false);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [allCourses, setAllCourses]         = useState([]);
  const [allCategories, setAllCategories]   = useState([]);
  const searchRef                           = useRef(null);
  const dropdownPressedRef                  = useRef(false);

  useEffect(() => {
    Promise.all([
      courseAPI.getAll({ limit: 300 }),
      categoryAPI.getAll(),
    ]).then(([cr, catR]) => {
      setAllCourses((cr.courses || []).filter(c => c.status === 'published'));
      setAllCategories(catR.categories || []);
    }).catch(() => {});
  }, []);

  const q = searchText.trim().toLowerCase();
  const filteredCourses    = q ? allCourses.filter(c =>
    c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
  ).slice(0, 5) : [];
  const filteredCategories = q ? allCategories.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 3) : [];
  const filteredNavItems   = q ? navItems.filter(n => n.label?.toLowerCase().includes(q)) : [];
  const hasResults = filteredCourses.length > 0 || filteredCategories.length > 0 || filteredNavItems.length > 0;

  const handleSearch = (query) => {
    const trimmed = (query || '').trim();
    setSearchText('');
    setSearchFocused(false);
    setShowDropdown(false);
    setMobileSearchOpen(false);
    const role = user?.role;
    if (role === 'student') {
      navigation.navigate('BrowseCourses', trimmed ? { searchQuery: trimmed } : {});
    } else if (role === 'expert') {
      navigation.navigate('ExploreCourses', trimmed ? { searchQuery: trimmed } : {});
    } else {
      navigation.navigate('Courses', trimmed ? { searchQuery: trimmed } : {});
    }
  };

  const handleSelectCourse = (course) => {
    setSearchText(''); setShowDropdown(false); setMobileSearchOpen(false);
    navigation.navigate('CourseDetail', { courseId: course.id });
  };

  const handleSelectCategory = (cat) => {
    setSearchText(''); setShowDropdown(false); setMobileSearchOpen(false);
    const role = user?.role;
    if (role === 'student') {
      navigation.navigate('BrowseCourses', { categoryId: cat.id, categoryName: cat.name });
    } else {
      navigation.navigate('Courses', { categoryId: cat.id });
    }
  };

  const handleSelectNavItem = (item) => {
    setSearchText(''); setShowDropdown(false); setMobileSearchOpen(false);
    onNavigate?.(item.route);
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setSearchText('');
    setShowDropdown(false);
  };

  // Mobile dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const navScrollRef = useRef(null);
  const navScrollY = useRef(0);
  const [navContentHeight, setNavContentHeight] = useState(0);
  const [navVisibleHeight, setNavVisibleHeight] = useState(0);
  const navContentHeightRef = useRef(0);
  const navVisibleHeightRef = useRef(0);
  const navScrollAnim = useRef(new Animated.Value(0)).current;
  const thumbDragStartScrollY = useRef(0);

  const scrollbarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        thumbDragStartScrollY.current = navScrollY.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const visH = navVisibleHeightRef.current;
        const contH = navContentHeightRef.current;
        if (visH <= 0 || contH <= visH) return;
        const thumbH = Math.max(24, (visH / contH) * visH);
        const maxThumbY = visH - thumbH;
        const maxScrollY = contH - visH;
        const startThumbY = (thumbDragStartScrollY.current / maxScrollY) * maxThumbY;
        const newThumbY = Math.max(0, Math.min(maxThumbY, startThumbY + gestureState.dy));
        const newScrollY = maxThumbY > 0 ? (newThumbY / maxThumbY) * maxScrollY : 0;
        navScrollRef.current?.scrollTo({ y: newScrollY, animated: false });
      },
    })
  ).current;

  // Back-button logic — hide on main/auth screens
  const isMainScreen =
    route.name === 'Login' || route.name === 'Signup' || route.name === 'Dashboard';
  const canGoBack = navigation.canGoBack() && !isMainScreen;
  const hasWebHistory = Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length > 1;
  const shouldShowBack = (showBack && (canGoBack || hasWebHistory)) || forceShowBack;

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (navigation.canGoBack()) { navigation.goBack(); return; }
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.back();
  };

  const isWeb = Platform.OS === 'web';
  const isDesktop = width > 1024;
  const isTablet = width > 768;
  const isMobile = !isTablet;

  const headerHeight = isWeb
    ? theme.layout.headerHeight
    : theme.layout.headerHeightMobile;

  // Total offset from screen top (status bar + header) for dropdown positioning
  const totalHeaderOffset = Platform.OS === 'ios'
    ? 44 + headerHeight
    : isWeb ? headerHeight : 24 + headerHeight;

  const styles = getStyles(theme, isDark, isWeb, isDesktop, isTablet, headerHeight);

  // ── Mobile dropdown open/close ──────────────────────────────────────────
  const openMenu = () => {
    navScrollY.current = 0;
    setMenuOpen(true);
    Animated.spring(menuAnim, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setMenuOpen(false));
  };

  const handleNavPress = (routeName) => {
    closeMenu();
    setTimeout(() => onNavigate?.(routeName), 100);
  };

  const handleLogout = () => {
    closeMenu();
    setTimeout(() => logout(), 150);
  };

  // ── Dropdown inner content (shared across web/native) ───────────────────
  const DropdownContent = () => (
    <>
      {user && (
        <View style={styles.dropdownUserRow}>
          <UserAvatar user={user} size={40} borderColor="rgba(255,140,66,0.4)" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dropdownUserName} numberOfLines={1}>{user.name || 'Student'}</Text>
            <Text style={styles.dropdownUserRole}>⚡ {user.role || 'Student'}</Text>
          </View>
        </View>
      )}
      <View style={styles.dropdownDivider} />
      <View style={{ position: 'relative' }}>
        <ScrollView
          ref={navScrollRef}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: navItems.length > 4 ? 261 : undefined }}
          onContentSizeChange={(_, h) => { setNavContentHeight(h); navContentHeightRef.current = h; }}
          onLayout={(e) => { const h = e.nativeEvent.layout.height; setNavVisibleHeight(h); navVisibleHeightRef.current = h; }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: navScrollAnim } } }],
            { useNativeDriver: false, listener: (e) => { navScrollY.current = e.nativeEvent.contentOffset.y; } }
          )}
          scrollEventThrottle={16}
        >
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                onPress={() => handleNavPress(item.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.dropdownItemIcon, isActive && styles.dropdownItemIconActive]}>
                  {item.iconLib === 'mci'
                    ? <MCIcon name={isActive ? (item.iconActive || item.icon) : item.icon} size={18} color={isActive ? '#FFFFFF' : '#FF8C42'} />
                    : <Icon name={isActive ? (item.iconActive || item.icon) : item.icon} size={18} color={isActive ? '#FFFFFF' : '#FF8C42'} />
                  }
                </View>
                <Text style={[styles.dropdownItemLabel, isActive && styles.dropdownItemLabelActive]}>{item.label}</Text>
                {isActive && <View style={styles.dropdownActiveDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {navItems.length > 4 && navContentHeight > navVisibleHeight && navVisibleHeight > 0 && (
          <View style={styles.scrollTrack}>
            <Animated.View
              {...scrollbarPanResponder.panHandlers}
              style={[styles.scrollThumb, {
                height: Math.max(24, (navVisibleHeight / navContentHeight) * navVisibleHeight),
                transform: [{ translateY: navScrollAnim.interpolate({
                  inputRange: [0, Math.max(1, navContentHeight - navVisibleHeight)],
                  outputRange: [0, navVisibleHeight - Math.max(24, (navVisibleHeight / navContentHeight) * navVisibleHeight)],
                  extrapolate: 'clamp',
                }) }],
              }]}
            />
          </View>
        )}
      </View>
      <View style={styles.dropdownDivider} />
      <View style={styles.dropdownItem}>
        <View style={[styles.dropdownItemIcon, { backgroundColor: 'rgba(124,111,205,0.15)' }]}>
          <Icon name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color="#7C6FCD" />
        </View>
        <Text style={styles.dropdownItemLabel}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
        <ThemeToggle iconColor={isDark ? '#F5C842' : '#7C6FCD'} />
      </View>
      {typeof mobileDropdownFooter === 'function' ? mobileDropdownFooter(closeMenu) : mobileDropdownFooter}
      {user && (
        <TouchableOpacity style={styles.dropdownItem}
          onPress={() => { closeMenu(); setTimeout(() => navigation.navigate('Settings'), 100); }}
          activeOpacity={0.7}
        >
          <View style={[styles.dropdownItemIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Icon name="settings-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.dropdownItemLabel}>Settings</Text>
        </TouchableOpacity>
      )}
      {user && (
        <TouchableOpacity style={styles.dropdownItem} onPress={handleLogout} activeOpacity={0.7}>
          <View style={[styles.dropdownItemIcon, { backgroundColor: 'rgba(255,80,80,0.12)' }]}>
            <Icon name="log-out-outline" size={18} color="#FF5050" />
          </View>
          <Text style={[styles.dropdownItemLabel, { color: '#FF5050' }]}>Sign Out</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // ── Mobile Dropdown Menu (rendered in Modal) ─────────────────────────────
  const MobileDropdown = () => (
    <Modal visible={menuOpen} transparent animationType="none" onRequestClose={closeMenu}>
      <View style={styles.modalBackdrop}>
        {/* Backdrop tap-to-close — sits below the dropdown in z-order */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeMenu} activeOpacity={1} />
        {/* Dropdown — rendered after backdrop so it sits on top, scroll gestures are not intercepted */}
        <Animated.View style={{
          position: 'absolute', right: 12, top: totalHeaderOffset + 8,
          width: 234, borderRadius: 22,
          opacity: menuAnim,
          transform: [
            { translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [-12,0] }) },
            { scale:      menuAnim.interpolate({ inputRange: [0,1], outputRange: [0.95,1] }) },
          ],
          shadowColor: '#7C6FCD', shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4, shadowRadius: 24, elevation: 20,
        }}>
          {/* Web: CSS gradient border */}
          {isWeb ? (
            <View style={{ borderRadius: 22, padding: 2, background: 'linear-gradient(90deg, #FF8C42, #7C6FCD)' }}>
              <View style={[styles.dropdownCard, { backgroundColor: glassBg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }]}>
                {DropdownContent()}
              </View>
            </View>
          ) : (
            /* Native: LinearGradient border */
            <LinearGradient colors={['#FF8C42', '#7C6FCD']} start={{ x:0, y:0.5 }} end={{ x:1, y:0.5 }}
              style={{ borderRadius: 22, padding: 2 }}>
              <View style={[styles.dropdownCard, { backgroundColor: glassBg }]}>
                {DropdownContent()}
              </View>
            </LinearGradient>
          )}
        </Animated.View>
      </View>
    </Modal>
  );

  // ── Shared search results dropdown ──────────────────────────────────────
  const SearchDropdownContent = () => (
    <View style={[styles.searchDropdown, {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      borderColor: isDark ? 'rgba(255,140,66,0.25)' : 'rgba(255,140,66,0.3)',
      ...(isWeb ? { boxShadow: '0 8px 32px rgba(0,0,0,0.35)' } : {
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
      }),
    }]}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
        {filteredCourses.length > 0 && (
          <>
            <View style={styles.sdSection}>
              <Icon name="library-outline" size={12} color="#FF8C42" />
              <Text style={styles.sdSectionLabel}>Courses</Text>
            </View>
            {filteredCourses.map(course => (
              <TouchableOpacity
                key={course.id}
                style={[styles.sdItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.07)' }]}
                onPressIn={() => { dropdownPressedRef.current = true; }}
                onPress={() => handleSelectCourse(course)}
                activeOpacity={0.75}
              >
                <Icon name="book-outline" size={14} color={isDark ? 'rgba(255,255,255,0.38)' : 'rgba(26,26,46,0.35)'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sdItemText, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]} numberOfLines={1}>{course.name}</Text>
                  {course.category?.name && (
                    <Text style={[styles.sdItemMeta, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(26,26,46,0.45)' }]} numberOfLines={1}>
                      {course.category.name}{course.level ? ` · ${course.level}` : ''}
                    </Text>
                  )}
                </View>
                <Icon name="arrow-forward" size={12} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,46,0.2)'} />
              </TouchableOpacity>
            ))}
          </>
        )}
        {filteredCategories.length > 0 && (
          <>
            <View style={[styles.sdSection, filteredCourses.length > 0 && { marginTop: 4 }]}>
              <Icon name="grid-outline" size={12} color="#FF8C42" />
              <Text style={styles.sdSectionLabel}>Categories</Text>
            </View>
            {filteredCategories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.sdItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.07)' }]}
                onPressIn={() => { dropdownPressedRef.current = true; }}
                onPress={() => handleSelectCategory(cat)}
                activeOpacity={0.75}
              >
                <Icon name="folder-outline" size={14} color={isDark ? 'rgba(255,255,255,0.38)' : 'rgba(26,26,46,0.35)'} />
                <Text style={[styles.sdItemText, { color: isDark ? '#FFFFFF' : '#1A1A2E', flex: 1 }]} numberOfLines={1}>{cat.name}</Text>
                <Icon name="arrow-forward" size={12} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,46,0.2)'} />
              </TouchableOpacity>
            ))}
          </>
        )}
        {filteredNavItems.length > 0 && (
          <>
            <View style={[styles.sdSection, (filteredCourses.length > 0 || filteredCategories.length > 0) && { marginTop: 4 }]}>
              <Icon name="albums-outline" size={12} color="#FF8C42" />
              <Text style={styles.sdSectionLabel}>Pages</Text>
            </View>
            {filteredNavItems.map(item => (
              <TouchableOpacity
                key={item.route}
                style={[styles.sdItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.07)' }]}
                onPressIn={() => { dropdownPressedRef.current = true; }}
                onPress={() => handleSelectNavItem(item)}
                activeOpacity={0.75}
              >
                <Icon name={item.icon} size={14} color={isDark ? 'rgba(255,255,255,0.38)' : 'rgba(26,26,46,0.35)'} />
                <Text style={[styles.sdItemText, { color: isDark ? '#FFFFFF' : '#1A1A2E', flex: 1 }]} numberOfLines={1}>{item.label}</Text>
                <Icon name="arrow-forward" size={12} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,46,0.2)'} />
              </TouchableOpacity>
            ))}
          </>
        )}
        {q.length > 0 && (
          <TouchableOpacity
            style={[styles.sdSeeAll, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)' }]}
            onPressIn={() => { dropdownPressedRef.current = true; }}
            onPress={() => handleSearch(searchText)}
            activeOpacity={0.8}
          >
            <Icon name="search" size={13} color="#FF8C42" />
            <Text style={styles.sdSeeAllText}>See all results for "{q}"</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  // ── Mobile full-screen search overlay ───────────────────────────────────
  const MobileSearchOverlay = () => (
    <Modal visible={mobileSearchOpen} transparent animationType="none" onRequestClose={closeMobileSearch}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeMobileSearch} activeOpacity={1} />
        <View style={[styles.mobileSearchOverlay, { top: totalHeaderOffset + 8 }]}>
          <View style={[styles.mobileSearchBar, { backgroundColor: glassBg }]}>
            <Icon name="search-outline" size={16} color="rgba(255,255,255,0.5)" />
            <TextInput
              ref={searchRef}
              style={styles.mobileSearchInput}
              placeholder="Search courses, pages..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchText}
              onChangeText={v => { setSearchText(v); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onSubmitEditing={() => handleSearch(searchText)}
              returnKeyType="search"
              autoFocus
            />
            <TouchableOpacity onPress={closeMobileSearch} activeOpacity={0.7}>
              <Icon name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {showDropdown && hasResults && (
            <View style={{ marginTop: 6 }}>
              <SearchDropdownContent />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // ── Native tablet/desktop search dropdown (Modal to escape overflow:hidden) ──
  const DesktopDropdownModal = () => (
    <Modal visible={showDropdown && hasResults} transparent animationType="none" onRequestClose={() => setShowDropdown(false)}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={() => { setShowDropdown(false); setSearchFocused(false); }}
        activeOpacity={1}
      />
      <View style={[
        styles.desktopDropdown,
        { top: totalHeaderOffset + 8 },
        isMobile && { left: 12, right: 12, width: undefined },
      ]}>
        <SearchDropdownContent />
      </View>
    </Modal>
  );

  // ── Header inner content ────────────────────────────────────────────────
  const HeaderContent = () => {
    /* Mobile inline-search mode — replace entire content with search bar */
    if (isMobile && mobileSearchOpen) {
      return (
        <View style={styles.contentWrapper}>
          <View style={styles.content}>
            <Image source={LogoImage} style={styles.logoImg} resizeMode="cover" />
            <View style={[styles.searchBarWrapper, styles.searchBarFocused, { flex: 1 }]}>
              <Icon name="search-outline" size={14} color="rgba(255,140,66,0.8)" />
              <TextInput
                ref={searchRef}
                style={styles.searchInput}
                placeholder="Search courses, pages..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={searchText}
                onChangeText={v => { setSearchText(v); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onSubmitEditing={() => handleSearch(searchText)}
                returnKeyType="search"
                autoFocus
                {...(isWeb ? { outlineWidth: 0 } : {})}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchText(''); setShowDropdown(false); }} activeOpacity={0.7}>
                  <Icon name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={closeMobileSearch} style={styles.searchCloseBtn} activeOpacity={0.7}>
              <Icon name="close" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
    <View style={styles.contentWrapper}>
      <View style={styles.content}>

        {/* ── LEFT ── */}
        <View style={styles.leftSection}>
          {shouldShowBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {!minimal && (
            <View style={styles.logoArea}>
              <Image source={LogoImage} style={styles.logoImg} resizeMode="cover" />
              {!leftComponent && (
                <Text style={styles.logoText}>
                  SKILL<Text style={{ color: '#FF8C42' }}>SPHERE</Text>
                </Text>
              )}
            </View>
          )}

          {!minimal && leftComponent}
        </View>

        {/* ── CENTER: Nav pills or page title ── */}
        {navItems.length > 0 && !isMobile ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navPillsWrap}
            style={styles.navPillsScroll}
          >
            {navItems.map((item) => {
              const isActive = activeRoute === item.route;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.navPill, isActive && styles.navPillActive]}
                  onPress={() => onNavigate?.(item.route)}
                  activeOpacity={0.7}
                >
                  {item.iconLib === 'mci'
                    ? <MCIcon name={isActive ? (item.iconActive || item.icon) : item.icon} size={isDesktop ? 16 : 14} color={isActive ? '#1A1A2E' : '#FFFFFF'} />
                    : <Icon name={isActive ? (item.iconActive || item.icon) : item.icon} size={isDesktop ? 16 : 14} color={isActive ? '#1A1A2E' : '#FFFFFF'} />
                  }
                  {isActive && isDesktop && (
                    <Text style={styles.navPillTextActive}>{item.label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : title ? (
          <View style={styles.titleArea}>
            <Text style={styles.pageTitle} numberOfLines={1}>{title}</Text>
          </View>
        ) : null}

        {/* ── RIGHT ── */}
        <View style={styles.rightSection}>

          {/* Minimal mode: just ThemeToggle + optional rightActions */}
          {minimal ? (
            <>
              {rightActions}
              <ThemeToggle style={styles.themeToggle} iconColor="#FFFFFF" />
            </>
          ) : (
            <>
              {/* Search bar — desktop/tablet */}
              {showDateTime && !isMobile && (
                <View style={[styles.searchBarWrapper, searchFocused && styles.searchBarFocused]}>
                  <Icon name="search-outline" size={14} color={searchFocused ? 'rgba(255,140,66,0.8)' : 'rgba(255,255,255,0.45)'} />
                  <TextInput
                    ref={searchRef}
                    style={styles.searchInput}
                    placeholder="Search courses, pages..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={searchText}
                    onChangeText={v => { setSearchText(v); setShowDropdown(true); }}
                    onFocus={() => { setSearchFocused(true); setShowDropdown(true); }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!dropdownPressedRef.current) { setShowDropdown(false); }
                        dropdownPressedRef.current = false;
                        setSearchFocused(false);
                      }, 200);
                    }}
                    onSubmitEditing={() => handleSearch(searchText)}
                    returnKeyType="search"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchText(''); setShowDropdown(false); }} activeOpacity={0.7}>
                      <Icon name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Greeting + avatar — desktop only */}
              {isDesktop && user && (
                <View style={styles.userGreeting}>
                  <Text style={styles.greetingName}>
                    Hello, {user.name?.split(' ')[0] || 'Student'}
                  </Text>
                  <Text style={styles.greetingRole}>⚡ {user.role || 'Student'}</Text>
                </View>
              )}

              {!isMobile && user && (
                <UserAvatar user={user} size={34} borderColor="rgba(255,255,255,0.3)" />
              )}

              {/* Theme toggle + settings + logout — tablet/desktop only */}
              {!isMobile && (
                <>
                  <ThemeToggle style={styles.themeToggle} iconColor="#FFFFFF" />
                  {user && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Settings')}
                      style={styles.settingsButton}
                      activeOpacity={0.7}
                    >
                      <Icon name="settings-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  {user && (
                    <TouchableOpacity
                      onPress={() => logout()}
                      style={styles.logoutButton}
                      activeOpacity={0.7}
                    >
                      <Icon name="log-out-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  {rightActions}
                </>
              )}

              {/* Search icon — mobile: opens expand overlay */}
              {showDateTime && isMobile && (
                <TouchableOpacity
                  style={styles.searchIconBtn}
                  onPress={() => { setMobileSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 80); }}
                  activeOpacity={0.7}
                >
                  <Icon name="search-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {/* Mobile: right actions + hamburger */}
              {isMobile && rightActions}
              {isMobile && (
                <TouchableOpacity
                  onPress={menuOpen ? closeMenu : openMenu}
                  style={[styles.menuTrigger, menuOpen && styles.menuTriggerOpen]}
                  activeOpacity={0.8}
                >
                  <Animated.View
                    style={{
                      transform: [{
                        rotate: menuAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '90deg'],
                        }),
                      }],
                    }}
                  >
                    <Icon name={menuOpen ? 'close' : 'apps'} size={20} color="#FFFFFF" />
                  </Animated.View>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

      </View>
    </View>
    );
  };

  // ── Shared glass color (header + dropdown must match) ───────────────────
  const glassBg = isDark ? 'rgba(22,22,46,0.82)' : 'rgba(26,26,50,0.90)';

  // ── Web render ──────────────────────────────────────────────────────────
  if (isWeb) {
    return (
      <>
        <View style={{ position: 'sticky', top: 0, zIndex: 999, paddingTop: 10 }}>
          {/* Orange-left → purple-right gradient border wrapper */}
          <View style={{
            marginHorizontal: 12,
            padding: 2,
            borderRadius: 22,
            background: 'linear-gradient(90deg, #FF8C42, #7C6FCD)',
          }}>
            <View style={[styles.container, {
              marginHorizontal: 0,
              borderWidth: 0,
              borderRadius: 20,
              backgroundColor: glassBg,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }, style]}>
              {HeaderContent()}
            </View>
          </View>
          {/* Dropdown — outside overflow:hidden container, works for both desktop and mobile inline search */}
          {showDropdown && hasResults && (
            <View style={{
              position: 'absolute',
              left: isMobile ? 12 : undefined,
              right: 14,
              top: 10 + 2 + headerHeight + 6,
              width: isMobile ? undefined : 310,
              zIndex: 1001,
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <SearchDropdownContent />
            </View>
          )}
        </View>
        {isMobile && MobileDropdown()}
      </>
    );
  }

  // ── Native render ────────────────────────────────────────────────────────
  return (
    <>
      <View style={{ paddingTop: 8 }}>
        <LinearGradient
          colors={['#FF8C42', '#7C6FCD']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ marginHorizontal: 12, padding: 2, borderRadius: 22 }}
        >
          <View style={[styles.container, {
            marginHorizontal: 0,
            borderWidth: 0,
            borderRadius: 20,
            backgroundColor: glassBg,
          }, style]}>
            {HeaderContent()}
          </View>
        </LinearGradient>
      </View>
      {isMobile && MobileDropdown()}
      {<DesktopDropdownModal />}
    </>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme, isDark, isWeb, isDesktop, isTablet, headerHeight) =>
  StyleSheet.create({
    container: {
      height: headerHeight + (Platform.OS === 'ios' ? 44 : isWeb ? 0 : 24),
      paddingTop: Platform.OS === 'ios' ? 44 : isWeb ? 0 : 24,
      paddingHorizontal: isTablet ? 20 : 16,
      marginHorizontal: 12,
      marginTop: isWeb ? 0 : (Platform.OS === 'ios' ? 0 : 4),
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 16,
    },
    contentWrapper: {
      flex: 1,
      width: '100%',
      alignSelf: 'center',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
    },

    // ── Left ──
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    logoArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logoImg: {
      width: 46,
      height: 46,
      borderRadius: 13,
    },
    logoText: {
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold',
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 1.2,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },

    // ── Center nav pills (tablet/desktop) ──
    navPillsScroll: {
      flex: 1,
      marginHorizontal: isDesktop ? 8 : 4,
    },
    navPillsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#252540',
      borderRadius: 14,
      padding: 4,
      gap: 2,
      flexGrow: 1,
    },
    navPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: isDesktop ? 10 : 8,
      paddingVertical: isDesktop ? 5 : 4,
      borderRadius: 8,
    },
    navPillActive: {
      backgroundColor: '#FFFFFF',
    },
    navPillTextActive: {
      color: '#1A1A2E',
      fontSize: 11,
      fontWeight: '700',
    },

    // ── Page title (shown when no navItems) ──
    titleArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    pageTitle: {
      color: '#FFFFFF',
      fontSize: isDesktop ? 17 : 15,
      fontWeight: '700',
      letterSpacing: 0.3,
      opacity: 0.92,
    },

    // ── Right ──
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      ...(isTablet ? { flexShrink: 0 } : { flex: 1, justifyContent: 'flex-end' }),
    },
    searchBarWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 22,
      paddingHorizontal: 12,
      paddingVertical: isDesktop ? 7 : 6,
      width: isDesktop ? 220 : 175,
    },
    searchBarFocused: {
      borderColor: 'rgba(255,140,66,0.55)',
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    searchInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '500',
      minWidth: 0,
      paddingVertical: 0,
      ...(isWeb ? { outlineWidth: 0 } : {}),
    },
    searchIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    searchCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      flexShrink: 0,
    },
    userGreeting: {
      alignItems: 'flex-end',
    },
    greetingName: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    greetingRole: {
      color: '#FF8C42',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
    },
    avatarSmall: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#F5C842',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarSmallText: {
      color: '#1A1A2E',
      fontWeight: '800',
      fontSize: 14,
    },
    themeToggle: {
      marginLeft: 0,
    },
    settingsButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    logoutButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,80,80,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,80,80,0.35)',
    },

    // ── Mobile menu trigger ──
    menuTrigger: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,140,66,0.2)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,140,66,0.5)',
    },
    menuTriggerOpen: {
      backgroundColor: 'rgba(255,140,66,0.35)',
      borderColor: '#FF8C42',
    },

    // ── Mobile dropdown (inside Modal) ──
    modalBackdrop: {
      flex: 1,
      backgroundColor: isWeb ? 'rgba(10,10,30,0.4)' : 'rgba(0,0,0,0.6)',
      ...(isWeb ? {
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      } : {}),
    },
    // Glass content card — sits inside gradient shell
    dropdownCard: {
      borderRadius: 20,
      paddingVertical: 8,
      overflow: 'hidden',
    },

    // User strip
    dropdownUserRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    dropdownAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F5C842',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,140,66,0.4)',
    },
    dropdownAvatarText: {
      color: '#1A1A2E',
      fontWeight: '900',
      fontSize: 16,
    },
    dropdownUserName: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    dropdownUserRole: {
      color: '#FF8C42',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
    },

    // Divider
    dropdownDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginVertical: 4,
      marginHorizontal: 12,
    },


    // Nav item row
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: 6,
      marginVertical: 1,
      borderRadius: 12,
      gap: 12,
    },
    dropdownItemActive: {
      backgroundColor: 'rgba(255,140,66,0.15)',
    },
    dropdownItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,140,66,0.1)',
    },
    dropdownItemIconActive: {
      backgroundColor: '#FF8C42',
    },
    dropdownItemLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
    },
    dropdownItemLabelActive: {
      color: '#FF8C42',
      fontWeight: '700',
    },
    dropdownActiveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#FF8C42',
    },
    // ── Search dropdown (shared) ──
    searchDropdown: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    sdSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
    },
    sdSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FF8C42',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    sdItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    sdItemText: {
      fontSize: 13,
      fontWeight: '600',
    },
    sdItemMeta: {
      fontSize: 11,
      fontWeight: '400',
      marginTop: 1,
    },
    sdSeeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderTopWidth: 1,
    },
    sdSeeAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FF8C42',
      flex: 1,
    },

    // ── Desktop dropdown modal (native) ──
    desktopDropdown: {
      position: 'absolute',
      right: 26,
      width: 310,
      borderRadius: 16,
      overflow: 'hidden',
      zIndex: 1001,
    },

    // ── Mobile search overlay ──
    mobileSearchOverlay: {
      position: 'absolute',
      left: 12,
      right: 12,
      zIndex: 1001,
    },
    mobileSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,140,66,0.3)',
    },
    mobileSearchInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
    },

    scrollTrack: {
      position: 'absolute',
      right: 4,
      top: 6,
      bottom: 6,
      width: 3,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,140,66,0.12)' : 'rgba(255,140,66,0.15)',
    },
    scrollThumb: {
      width: 3,
      borderRadius: 2,
      backgroundColor: '#FF8C42',
    },
  });

export default AppHeader;
