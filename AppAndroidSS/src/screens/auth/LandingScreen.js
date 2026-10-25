import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
  StatusBar,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme, HEADING_FONT } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import AppHeader from '../../components/ui/AppHeader';
import { courseAPI, contactAPI, categoryAPI } from '../../services/apiClient';
import { resolveFileUrl, slugify } from '../../utils/urlHelpers';
import { Helmet } from 'react-helmet-async';

const LOGO              = require('../../assets/images/skillsphere-logo.png');
const SAFEPAY_LOGO_BLUE  = require('../../assets/images/safepay-logo-blue.png');
const SAFEPAY_LOGO_WHITE = require('../../assets/images/safepay-logo-white.png');
// Replace with your generated hero image: save as AppAndroidSS/src/assets/images/hero-illustration.png
let HERO_IMAGE = null;
try { HERO_IMAGE = require('../../assets/images/hero-illustration.png'); } catch (_) {}
const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';

const NAVY2  = '#16213E';

// ─── PULSING BLOB ─────────────────────────────────────────────────────────────
const PulsingBlob = ({ style, duration = 3400, delay = 0 }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const easing = Easing.inOut(Easing.sin);
    const startAnim = () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration, easing, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration, easing, useNativeDriver: true }),
        ])
      ).start();
    const timer = delay > 0 ? setTimeout(startAnim, delay) : null;
    if (!timer) startAnim();
    return () => { if (timer) clearTimeout(timer); };
  }, [pulse, duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
      ]}
    />
  );
};

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
const AnimatedReveal = ({ children, delay = 0, fromY = 30, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);
  const [uid] = useState(() => `rv-${Math.random().toString(36).slice(2, 9)}`);

  const trigger = useCallback(() => {
    if (triggered.current) return;
    triggered.current = true;
    const run = () =>
      Animated.spring(anim, { toValue: 1, tension: 52, friction: 11, useNativeDriver: true }).start();
    delay > 0 ? setTimeout(run, delay) : run();
  }, [anim, delay]);

  // Web: fire when element scrolls into view
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const timer = setTimeout(() => {
      const el = document.getElementById(uid);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { trigger(); obs.disconnect(); } },
        { threshold: 0.08 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, 150);
    return () => clearTimeout(timer);
  }, [uid, trigger]);

  const animStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) }],
  };

  return (
    <Animated.View
      nativeID={Platform.OS === 'web' ? uid : undefined}
      onLayout={Platform.OS !== 'web' ? trigger : undefined}
      style={[animStyle, style]}
    >
      {children}
    </Animated.View>
  );
};

// ─── Section title ────────────────────────────────────────────────────────────
const SectionTitle = ({ tag, title, subtitle, center = true, theme, isMobile }) => (
  <AnimatedReveal fromY={20} style={{ alignItems: center ? 'center' : 'flex-start', marginBottom: isMobile ? 28 : 40, width: '100%' }}>
    {tag ? (
      <View style={{
        backgroundColor: ORANGE + '20', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10,
      }}>
        <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }}>
          {tag.toUpperCase()}
        </Text>
      </View>
    ) : null}
    <Text style={{
      fontSize: isMobile ? 22 : 30, fontWeight: '800',
      color: theme.colors.textPrimary,
      textAlign: center ? 'center' : 'left',
      lineHeight: isMobile ? 30 : 38, marginBottom: 10,
    }}>
      {title}
    </Text>
    {subtitle ? (
      <Text style={{
        fontSize: isMobile ? 14 : 16, color: theme.colors.textSecondary,
        textAlign: center ? 'center' : 'left',
        lineHeight: isMobile ? 22 : 26, maxWidth: 560,
      }}>
        {subtitle}
      </Text>
    ) : null}
  </AnimatedReveal>
);

// ─── Searchable sections & pages ──────────────────────────────────────────────
const SEARCH_SECTIONS = [
  { id: 'features',  label: 'Features',      icon: 'grid-outline' },
  { id: 'how',       label: 'How It Works',  icon: 'git-branch-outline' },
  { id: 'courses',   label: 'Courses',       icon: 'library-outline' },
  { id: 'faq',       label: 'FAQ',           icon: 'help-circle-outline' },
  { id: 'contact',   label: 'Contact',       icon: 'mail-outline' },
];

const SEARCH_PAGES = [
  { label: 'Blog',                 icon: 'newspaper-outline',        route: 'Blog' },
  { label: 'About Us',             icon: 'information-circle-outline',route: 'About' },
  { label: 'Explore Courses',      icon: 'compass-outline',           route: 'ExploreCourses' },
  { label: 'Verify Certificate',   icon: 'shield-checkmark-outline',  route: 'CertificateVerify' },
  { label: 'Login',                icon: 'log-in-outline',            route: 'Login' },
  { label: 'Sign Up',              icon: 'person-add-outline',        route: 'Signup' },
];

// ─── Nav links (AppHeader format) ────────────────────────────────────────────
const NAV_LINKS = [
  { route: 'features', label: 'Features',     icon: 'grid-outline',        iconActive: 'grid' },
  { route: 'how',      label: 'How It Works', icon: 'git-branch-outline',  iconActive: 'git-branch' },
  { route: 'courses',  label: 'Courses',      icon: 'library-outline',     iconActive: 'library' },
  { route: 'faq',      label: 'FAQ',          icon: 'help-circle-outline', iconActive: 'help-circle' },
  { route: 'contact',  label: 'Contact',      icon: 'mail-outline',        iconActive: 'mail' },
];

// ─── 1. NAVBAR — replaced by AppHeader component ──────────────────────────────
const _Navbar = ({ navigation, isDark, isMobile, isDesktop, scrollToSection, activeSection }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === 'web';

  const openMenu = () => {
    setMenuOpen(true);
    Animated.spring(menuAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
  };
  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: true })
      .start(() => setMenuOpen(false));
  };
  const handleLink = (id) => { closeMenu(); setTimeout(() => scrollToSection(id), 120); };

  const MobileDropdown = () => (
    <Modal visible={menuOpen} transparent animationType="none" onRequestClose={closeMenu}>
      <TouchableOpacity
        style={[
          ns.modalBackdrop,
          isWeb && { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' },
        ]}
        onPress={closeMenu} activeOpacity={1}
      >
        <Animated.View style={[
          ns.dropdownCard,
          isWeb ? {
            backgroundColor: 'rgba(22,22,46,0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          } : { backgroundColor: 'rgba(22,22,46,0.97)' },
          {
            borderColor: 'rgba(255,140,66,0.25)',
            top: 80,
            opacity: menuAnim,
            transform: [
              { translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [-12,0] }) },
              { scale:      menuAnim.interpolate({ inputRange: [0,1], outputRange: [0.95,1] }) },
            ],
          },
        ]}>
          {NAV_LINKS.map(link => {
            const isActive = activeSection === link.id;
            return (
              <TouchableOpacity key={link.id}
                style={[ns.dropdownItem, isActive && ns.dropdownItemActive]}
                onPress={() => handleLink(link.id)} activeOpacity={0.7}
              >
                <View style={[ns.dropdownItemIcon, isActive && ns.dropdownItemIconActive]}>
                  <Icon name={isActive ? link.iconActive : link.icon} size={18}
                    color={isActive ? '#FFFFFF' : ORANGE} />
                </View>
                <Text style={[ns.dropdownItemLabel,
                  { color: 'rgba(255,255,255,0.85)' },
                  isActive && ns.dropdownItemLabelActive]}>
                  {link.label}
                </Text>
                {isActive && <View style={ns.dropdownActiveDot} />}
              </TouchableOpacity>
            );
          })}

          <View style={[ns.dropdownDivider, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

          <View style={ns.dropdownItem}>
            <View style={[ns.dropdownItemIcon, { backgroundColor: 'rgba(124,111,205,0.15)' }]}>
              <Icon name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color="#7C6FCD" />
            </View>
            <Text style={[ns.dropdownItemLabel, { color: 'rgba(255,255,255,0.85)' }]}>
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </Text>
            <ThemeToggle iconColor={isDark ? '#F5C842' : '#7C6FCD'} />
          </View>

          <View style={[ns.dropdownDivider, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

          <TouchableOpacity style={ns.dropdownItem}
            onPress={() => { closeMenu(); navigation.navigate('CertificateVerify'); }} activeOpacity={0.7}>
            <View style={[ns.dropdownItemIcon, { backgroundColor: 'rgba(255,140,66,0.1)' }]}>
              <Icon name="shield-checkmark-outline" size={18} color={ORANGE} />
            </View>
            <Text style={[ns.dropdownItemLabel, { color: 'rgba(255,255,255,0.85)' }]}>Verify Certificate</Text>
          </TouchableOpacity>

          <View style={[ns.dropdownDivider, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

          <TouchableOpacity style={ns.dropdownItem}
            onPress={() => { closeMenu(); navigation.navigate('Login'); }} activeOpacity={0.7}>
            <View style={[ns.dropdownItemIcon, { backgroundColor: 'rgba(255,140,66,0.1)' }]}>
              <Icon name="log-in-outline" size={18} color={ORANGE} />
            </View>
            <Text style={[ns.dropdownItemLabel, { color: 'rgba(255,255,255,0.85)' }]}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[ns.dropdownItem, ns.getStartedRow]}
            onPress={() => { closeMenu(); navigation.navigate('Signup'); }} activeOpacity={0.7}>
            <View style={[ns.dropdownItemIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Icon name="rocket-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={[ns.dropdownItemLabel, { color: '#FFFFFF', fontWeight: '800' }]}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );

  const stickyStyle = isWeb ? { position: 'sticky', top: 0, zIndex: 999, paddingTop: 10 } : {};

  const Inner = () => (
    <View style={ns.content}>
      <View style={ns.leftSection}>
        <Image source={LOGO} style={ns.logoImg} resizeMode="cover" />
        <Text style={ns.logoText}>
          SKILL<Text style={{ color: ORANGE }}>SPHERE</Text>
        </Text>
      </View>

      {!isMobile && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={ns.navPillsScroll} contentContainerStyle={ns.navPillsWrap}>
          {NAV_LINKS.map(link => {
            const isActive = activeSection === link.id;
            return (
              <TouchableOpacity key={link.id}
                style={[ns.navPill, isActive && ns.navPillActive]}
                onPress={() => scrollToSection(link.id)} activeOpacity={0.7}>
                <Icon
                  name={isActive ? link.iconActive : link.icon}
                  size={isDesktop ? 13 : 12}
                  color={isActive ? NAVY : 'rgba(255,255,255,0.6)'}
                />
                {isActive && (
                  <Text style={ns.navPillTextActive}>{link.label}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={ns.rightSection}>
        {!isMobile && (
          <>
            <ThemeToggle iconColor="#FFFFFF" />
            <TouchableOpacity style={ns.verifyBtn} onPress={() => navigation.navigate('CertificateVerify')}>
              <Icon name="shield-checkmark-outline" size={14} color={ORANGE} />
              <Text style={ns.verifyBtnText}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ns.signInBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={ns.signInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ns.getStartedBtn} onPress={() => navigation.navigate('Signup')}>
              <Text style={ns.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          </>
        )}
        {isMobile && (
          <TouchableOpacity onPress={menuOpen ? closeMenu : openMenu}
            style={[ns.menuTrigger, menuOpen && ns.menuTriggerOpen]} activeOpacity={0.8}>
            <Animated.View style={{
              transform: [{ rotate: menuAnim.interpolate({ inputRange:[0,1], outputRange:['0deg','90deg'] }) }],
            }}>
              <Icon name={menuOpen ? 'close' : 'apps'} size={20} color="#FFFFFF" />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const glassBg = 'rgba(22,22,46,0.82)';

  if (isWeb) {
    return (
      <>
        <View style={[
          ns.container,
          {
            backgroundColor: glassBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          },
          stickyStyle,
        ]}>
          <Inner />
        </View>
        {isMobile && <MobileDropdown />}
      </>
    );
  }
  const LG = require('react-native-linear-gradient').default;
  return (
    <>
      <LG colors={['#1A1A2E','#1E1E38']} style={ns.container} start={{x:0,y:0}} end={{x:1,y:1}}>
        <Inner />
      </LG>
      {isMobile && <MobileDropdown />}
    </>
  );
};

const ns = StyleSheet.create({
  container: { height: 62, paddingHorizontal: 20, marginHorizontal: 12, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.4, shadowRadius:20, elevation:16 },
  content: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  leftSection: { flexDirection:'row', alignItems:'center', gap:8, flexShrink:0 },
  logoImg: { width:46, height:46, borderRadius:13 },
  logoText: { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', color:'#FFFFFF', fontWeight:'700', fontSize:16, letterSpacing:1.2 },
  navPillsScroll: { flex:1, marginHorizontal:8 },
  navPillsWrap: { flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:'#252540', borderRadius:14, padding:4, gap:2, flexGrow:1 },
  navPill: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  navPillActive: { backgroundColor:'#FFFFFF' },
  navPillTextActive: { color:NAVY, fontSize:11, fontWeight:'700' },
  rightSection: { flexDirection:'row', alignItems:'center', gap:10, flexShrink:0 },
  verifyBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:14, paddingVertical:7, borderRadius:9999, borderWidth:1.5, borderColor:ORANGE+'60', backgroundColor:ORANGE+'12' },
  verifyBtnText: { color:ORANGE, fontSize:13, fontWeight:'700' },
  signInBtn: { paddingHorizontal:18, paddingVertical:8, borderRadius:9999, borderWidth:1.5, borderColor:'rgba(255,255,255,0.25)' },
  signInText: { color:'#FFFFFF', fontSize:13, fontWeight:'600' },
  getStartedBtn: { paddingHorizontal:18, paddingVertical:8, borderRadius:9999, backgroundColor:ORANGE, borderWidth:1, borderColor:'#E77828', shadowColor:'#C96A24', shadowOffset:{width:0,height:3}, shadowOpacity:0.14, shadowRadius:6, elevation:3 },
  getStartedText: { color:'#FFFFFF', fontSize:13, fontWeight:'700' },
  menuTrigger: { width:38, height:38, borderRadius:19, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(255,140,66,0.2)', borderWidth:1.5, borderColor:'rgba(255,140,66,0.5)' },
  menuTriggerOpen: { backgroundColor:'rgba(255,140,66,0.35)', borderColor:ORANGE },
  modalBackdrop: { flex:1, backgroundColor:'rgba(10,10,30,0.5)' },
  dropdownCard: { position:'absolute', right:12, width:230, borderRadius:20, paddingVertical:8, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.3, shadowRadius:20, elevation:20, borderWidth:1, overflow:'hidden' },
  dropdownItem: { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, marginHorizontal:6, marginVertical:1, borderRadius:12, gap:12 },
  dropdownItemActive: { backgroundColor:'rgba(255,140,66,0.1)' },
  dropdownItemIcon: { width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(255,140,66,0.1)' },
  dropdownItemIconActive: { backgroundColor:ORANGE },
  dropdownItemLabel: { flex:1, fontSize:14, fontWeight:'600' },
  dropdownItemLabelActive: { color:ORANGE, fontWeight:'700', letterSpacing:0.1 },
  dropdownActiveDot: { width:7, height:7, borderRadius:4, backgroundColor:ORANGE },
  dropdownDivider: { height:1, marginVertical:4, marginHorizontal:12 },
  getStartedRow: { backgroundColor:ORANGE, marginHorizontal:10, marginBottom:6, borderWidth:1, borderColor:'#E77828', shadowColor:'#C96A24', shadowOffset:{width:0,height:3}, shadowOpacity:0.14, shadowRadius:6, elevation:3 },
});

// ─── TEXT MORPH WORD ──────────────────────────────────────────────────────────
// React Native equivalent of TextMorph.jsx — opacity + translateY (all platforms)
// + CSS blur filter on web only (separate non-native-driver animation)
const TextMorphWord = ({ words, interval = 2800, style }) => {
  const [idx, setIdx] = useState(0);
  const opacity    = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const blurAnim   = useRef(new Animated.Value(1)).current; // 1 = sharp, 0 = blurred
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!words || words.length < 2) return;
    const OUT = 260, IN = 420;
    const id = setInterval(() => {
      // native-driver: opacity + slide up on exit
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,   duration: OUT, easing: Easing.in(Easing.quad),    useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -18, duration: OUT, easing: Easing.in(Easing.quad),    useNativeDriver: true }),
      ]).start(() => {
        setIdx(i => (i + 1) % words.length);
        translateY.setValue(18); // reset below, then slide in
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: IN, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: IN, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      });
      // non-native-driver: blur (web only, separate sequence so drivers don't mix)
      if (isWeb) {
        Animated.sequence([
          Animated.timing(blurAnim, { toValue: 0, duration: OUT, useNativeDriver: false }),
          Animated.timing(blurAnim, { toValue: 1, duration: IN,  useNativeDriver: false }),
        ]).start();
      }
    }, interval);
    return () => clearInterval(id);
  }, [words, interval]);

  const webBlurStyle = isWeb
    ? { filter: blurAnim.interpolate({ inputRange: [0, 1], outputRange: ['blur(10px)', 'blur(0px)'] }) }
    : {};

  return (
    <Animated.Text style={[style, { opacity, transform: [{ translateY }] }, webBlurStyle]}>
      {words[idx]}
    </Animated.Text>
  );
};

// ─── HERO ILLUSTRATION (right-side panel) ─────────────────────────────────────
// No blobs, no animation — large image fills the right column
const HeroIllustration = ({ isDark, fadeAnim }) => {
  return (
    <Animated.View style={{
      opacity: fadeAnim,
      flex: 1.1,
    }}>
      {HERO_IMAGE ? (
        <Image
          source={HERO_IMAGE}
          style={{ width: '100%', height: 520 }}
          resizeMode="contain"
        />
      ) : (
        <View style={{ width: '100%', height: 480, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="image-outline" size={56} color={ORANGE + '40'} />
          <Text style={{ color: ORANGE + '60', fontSize: 13, fontWeight: '600', marginTop: 14, textAlign: 'center' }}>
            Add hero-illustration.png{'\n'}to assets/images/
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

// ─── 2. HERO ──────────────────────────────────────────────────────────────────
const HeroSection = ({ navigation, theme, isDark, isMobile, scrollToSection }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current; // for illustration
  const a0 = useRef(new Animated.Value(0)).current; // badge
  const a1 = useRef(new Animated.Value(0)).current; // headline
  const a2 = useRef(new Animated.Value(0)).current; // subtitle + search
  const a3 = useRef(new Animated.Value(0)).current; // CTAs
  const a4 = useRef(new Animated.Value(0)).current; // stats + mobile image

  const [heroSearch, setHeroSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [allCourses, setAllCourses] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [heroLiveStats, setHeroLiveStats] = useState(null);
  const searchRef = useRef(null);
  const dropdownPressedRef = useRef(false);

  useEffect(() => {
    const go = (anim, delay) =>
      Animated.timing(anim, { toValue: 1, duration: 620, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    Animated.parallel([
      go(fadeAnim, 0),
      go(a0, 90),
      go(a1, 210),
      go(a2, 350),
      go(a3, 470),
      go(a4, 580),
    ]).start();
    // Prefetch for instant dropdown + live stats
    Promise.all([courseAPI.getAll(), categoryAPI.getAll(), courseAPI.getPublicStats()]).then(([cr, catR, statsR]) => {
      setAllCourses((cr.courses || []).filter(c => c.status === 'published'));
      setAllCategories(catR.categories || []);
      if (statsR.success) setHeroLiveStats(statsR.stats);
    }).catch(() => {});
  }, []);

  const q = heroSearch.trim().toLowerCase();
  const filteredCourses = q
    ? allCourses.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];
  const filteredCategories = q
    ? allCategories.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 3)
    : [];
  const filteredSections = q
    ? SEARCH_SECTIONS.filter(s => s.label.toLowerCase().includes(q))
    : [];
  const filteredPages = q
    ? SEARCH_PAGES.filter(p => p.label.toLowerCase().includes(q))
    : [];
  const hasResults =
    filteredCourses.length > 0 || filteredCategories.length > 0 ||
    filteredSections.length > 0 || filteredPages.length > 0;

  const handleHeroSearch = () => {
    const query = heroSearch.trim();
    setShowDropdown(false);
    navigation.navigate('ExploreCourses', query ? { search: query } : {});
  };

  const handleSelectCourse = (course) => {
    setHeroSearch('');
    setShowDropdown(false);
    navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) });
  };

  const handleSelectCategory = (cat) => {
    setHeroSearch('');
    setShowDropdown(false);
    navigation.navigate('ExploreCourses', { search: cat.name });
  };

  const handleSelectSection = (section) => {
    setHeroSearch('');
    setShowDropdown(false);
    scrollToSection?.(section.id);
  };

  const handleSelectPage = (page) => {
    setHeroSearch('');
    setShowDropdown(false);
    navigation.navigate(page.route);
  };

  const MORPH_WORDS = ['Learn Faster', 'Build Smarter', 'Grow Further', 'Earn More'];

  const fmtHero = (val, suffix = '+') => {
    if (!val || val <= 0) return null; // 0 or missing → caller uses fallback
    if (suffix === '%') return `${val}%`;
    return val >= 1000 ? `${(val / 1000).toFixed(0)}K+` : `${val}${suffix}`;
  };
  const stats = [
    { value: fmtHero(heroLiveStats?.totalStudents) || '10K+', label: 'Students',  color: ORANGE    },
    { value: fmtHero(heroLiveStats?.totalCourses)  || '200+', label: 'Courses',   color: '#6366F1' },
    { value: fmtHero(heroLiveStats?.totalInstructors) || '50+', label: 'Experts', color: '#10B981' },
    { value: fmtHero(heroLiveStats?.completionRate, '%') || '95%', label: 'Success', color: '#F59E0B' },
  ];

  const slideFrom = (anim, from = 20) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });

  const hlFont = { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold' };

  return (
    <View style={[styles.hero, { backgroundColor: 'transparent' }]}>
      <PulsingBlob style={[styles.heroBlobLeft, { backgroundColor: ORANGE + (isDark ? '15' : '28') }]} duration={4000} />
      <PulsingBlob style={[styles.heroBlobRight, { backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(26,26,46,0.08)' }]} duration={3600} delay={900} />

      {/* ── CONTENT WRAPPER ── */}
      <View style={[
        { width: '100%', maxWidth: 1200, zIndex: 2 },
        !isMobile && { flexDirection: 'row', alignItems: 'center', gap: 32, paddingHorizontal: 28 },
        isMobile  && { alignItems: 'center', paddingHorizontal: 20 },
      ]}>

        {/* ════ LEFT / TEXT COLUMN ════ */}
        <View style={[!isMobile && { flex: 1 }, isMobile && { alignItems: 'center', width: '100%' }]}>

          {/* Morph accent — cycles above headline */}
          <Animated.View style={{ opacity: a0, transform: [{ translateY: slideFrom(a0, 14) }], alignSelf: isMobile ? 'center' : 'flex-start', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE }} />
            <TextMorphWord
              words={MORPH_WORDS}
              interval={2600}
              style={{ fontSize: 10, fontWeight: '700', color: ORANGE, letterSpacing: 1.6, textTransform: 'uppercase' }}
            />
          </Animated.View>

          {/* Headline — static, verbatim */}
          <Animated.View style={{ opacity: a1, transform: [{ translateY: slideFrom(a1, 24) }], marginBottom: 14, alignSelf: isMobile ? 'center' : 'flex-start' }}>
            <Text style={[
              hlFont,
              { fontWeight: '900', letterSpacing: -2, color: theme.colors.textPrimary },
              !isMobile && { fontSize: 56, lineHeight: 66, textAlign: 'left' },
              isMobile  && { fontSize: 28, lineHeight: 36, textAlign: 'center' },
            ]}>
              Empower Your Skills,{'\n'}
              <Text style={{ color: ORANGE }}>Expand Your Sphere</Text>
            </Text>
          </Animated.View>

          {/* Mobile image — immediately after headline, before subtitle */}
          {isMobile && HERO_IMAGE && (
            <Animated.View style={{ opacity: a1, marginBottom: 20, width: '100%' }}>
              <Image source={HERO_IMAGE} style={{ width: '100%', height: 260 }} resizeMode="contain" />
            </Animated.View>
          )}

          {/* Subtitle */}
          <Animated.View style={{ opacity: a2, transform: [{ translateY: slideFrom(a2, 18) }], marginBottom: 16 }}>
            <Text style={[
              styles.heroSub, { color: theme.colors.textSecondary },
              !isMobile && { textAlign: 'left', maxWidth: 460 },
              isMobile  && { fontSize: 14, lineHeight: 24, textAlign: 'center', paddingHorizontal: 4 },
            ]}>
              Learn from industry experts with hands-on projects, AI-assisted tutoring, and globally recognised certificates.
            </Text>
          </Animated.View>

          {/* Trust badges */}
          <Animated.View style={{ opacity: a2, transform: [{ translateY: slideFrom(a2, 12) }], marginBottom: 22, alignSelf: isMobile ? 'center' : 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isMobile ? 10 : 16, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="star" size={13} color="#F59E0B" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.8)' : NAVY }}>4.8 / 5</Text>
              </View>
              <View style={{ width: 1, height: 13, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,46,0.2)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="people-outline" size={12} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.45)'} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)' }}>
                  10,000+ students
                </Text>
              </View>
              <View style={{ width: 1, height: 13, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,46,0.2)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="shield-checkmark" size={12} color="#10B981" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)' }}>
                  Verified certificates
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Search Bar + Dropdown */}
          <Animated.View style={{ opacity: a2, transform: [{ translateY: slideFrom(a2, 18) }], marginBottom: 26, width: '100%', zIndex: 100, alignSelf: isMobile ? 'center' : 'flex-start' }}>
            <View style={[styles.heroSearchContainer, { marginBottom: 0 }, isMobile && { width: '100%' }, !isMobile && { maxWidth: 500 }]}>
              <View style={[
                styles.heroSearchWrap,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#fff',
                  borderColor: showDropdown && hasResults ? ORANGE : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.12)',
                  borderBottomLeftRadius:  showDropdown && hasResults ? 0 : 50,
                  borderBottomRightRadius: showDropdown && hasResults ? 0 : 50,
                },
              ]}>
                <Icon name="search-outline" size={20} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26,26,46,0.4)'} />
                <TextInput
                  ref={searchRef}
                  style={[styles.heroSearchInput, { color: isDark ? '#fff' : NAVY }]}
                  placeholder="Search courses, topics, skills…"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(26,26,46,0.35)'}
                  value={heroSearch}
                  onChangeText={v => { setHeroSearch(v); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (!dropdownPressedRef.current) setShowDropdown(false);
                      dropdownPressedRef.current = false;
                    }, 200);
                  }}
                  onSubmitEditing={handleHeroSearch}
                  returnKeyType="search"
                />
                {heroSearch.length > 0 && (
                  <TouchableOpacity onPress={() => { setHeroSearch(''); setShowDropdown(false); }} activeOpacity={0.7}>
                    <Icon name="close-circle" size={18} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(26,26,46,0.3)'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.heroSearchBtn, { backgroundColor: ORANGE }, isMobile && { paddingHorizontal: 10 }]}
                  onPress={handleHeroSearch}
                  activeOpacity={0.85}
                >
                  {isMobile
                    ? <Icon name="search" size={18} color="#fff" />
                    : <Text style={styles.heroSearchBtnText}>Search</Text>
                  }
                </TouchableOpacity>
              </View>

              {/* Dropdown */}
              {showDropdown && hasResults && (
                <View style={[styles.heroDropdown, { backgroundColor: isDark ? '#1a1a2e' : '#fff', borderColor: ORANGE, shadowColor: '#000' }]}>
                  {filteredCourses.length > 0 && (
                    <>
                      <View style={styles.heroDropdownSection}>
                        <Icon name="library-outline" size={13} color={ORANGE} />
                        <Text style={[styles.heroDropdownHeading, { color: ORANGE }]}>Courses</Text>
                      </View>
                      {filteredCourses.map(course => (
                        <TouchableOpacity key={course.id}
                          style={[styles.heroDropdownItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' }]}
                          onPressIn={() => { dropdownPressedRef.current = true; }}
                          onPress={() => handleSelectCourse(course)} activeOpacity={0.75}>
                          <Icon name="book-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.4)'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.heroDropdownItemText, { color: theme.colors.textPrimary }]} numberOfLines={1}>{course.name}</Text>
                            {course.category?.name && (
                              <Text style={[styles.heroDropdownItemMeta, { color: theme.colors.textSecondary }]}>{course.category.name} · {course.level}</Text>
                            )}
                          </View>
                          <Icon name="arrow-forward" size={13} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.25)'} />
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  {filteredCategories.length > 0 && (
                    <>
                      <View style={[styles.heroDropdownSection, filteredCourses.length > 0 && { marginTop: 6 }]}>
                        <Icon name="grid-outline" size={13} color={ORANGE} />
                        <Text style={[styles.heroDropdownHeading, { color: ORANGE }]}>Categories</Text>
                      </View>
                      {filteredCategories.map(cat => (
                        <TouchableOpacity key={cat.id}
                          style={[styles.heroDropdownItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' }]}
                          onPressIn={() => { dropdownPressedRef.current = true; }}
                          onPress={() => handleSelectCategory(cat)} activeOpacity={0.75}>
                          <Icon name="folder-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.4)'} />
                          <Text style={[styles.heroDropdownItemText, { color: theme.colors.textPrimary, flex: 1 }]} numberOfLines={1}>{cat.name}</Text>
                          <Icon name="arrow-forward" size={13} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.25)'} />
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  {filteredSections.length > 0 && (
                    <>
                      <View style={[styles.heroDropdownSection, { marginTop: (filteredCourses.length > 0 || filteredCategories.length > 0) ? 6 : 0 }]}>
                        <Icon name="navigate-outline" size={13} color={ORANGE} />
                        <Text style={[styles.heroDropdownHeading, { color: ORANGE }]}>Sections</Text>
                      </View>
                      {filteredSections.map(sec => (
                        <TouchableOpacity key={sec.id}
                          style={[styles.heroDropdownItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' }]}
                          onPressIn={() => { dropdownPressedRef.current = true; }}
                          onPress={() => handleSelectSection(sec)} activeOpacity={0.75}>
                          <Icon name={sec.icon} size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.4)'} />
                          <Text style={[styles.heroDropdownItemText, { color: theme.colors.textPrimary, flex: 1 }]} numberOfLines={1}>{sec.label}</Text>
                          <Text style={[styles.heroDropdownItemMeta, { color: ORANGE }]}>on this page</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  {filteredPages.length > 0 && (
                    <>
                      <View style={[styles.heroDropdownSection, { marginTop: (filteredCourses.length > 0 || filteredCategories.length > 0 || filteredSections.length > 0) ? 6 : 0 }]}>
                        <Icon name="albums-outline" size={13} color={ORANGE} />
                        <Text style={[styles.heroDropdownHeading, { color: ORANGE }]}>Pages</Text>
                      </View>
                      {filteredPages.map(page => (
                        <TouchableOpacity key={page.route}
                          style={[styles.heroDropdownItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' }]}
                          onPressIn={() => { dropdownPressedRef.current = true; }}
                          onPress={() => handleSelectPage(page)} activeOpacity={0.75}>
                          <Icon name={page.icon} size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.4)'} />
                          <Text style={[styles.heroDropdownItemText, { color: theme.colors.textPrimary, flex: 1 }]} numberOfLines={1}>{page.label}</Text>
                          <Icon name="arrow-forward" size={13} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.25)'} />
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.heroDropdownSeeAll, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)' }]}
                    onPressIn={() => { dropdownPressedRef.current = true; }}
                    onPress={handleHeroSearch} activeOpacity={0.8}>
                    <Icon name="search" size={14} color={ORANGE} />
                    <Text style={[styles.heroDropdownSeeAllText, { color: ORANGE }]}>See all results for "{heroSearch.trim()}"</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>

          {/* CTAs */}
          <Animated.View style={{ opacity: a3, transform: [{ translateY: slideFrom(a3, 16) }], marginBottom: 24, width: isMobile ? '100%' : undefined }}>
            <View style={[
              { flexDirection: 'row', gap: 12, alignItems: 'center' },
              !isMobile && { justifyContent: 'flex-start' },
              isMobile  && { flexDirection: 'column', width: '100%', gap: 10 },
            ]}>
              {/* Primary CTA */}
              <TouchableOpacity
                style={[
                  {
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: ORANGE,
                    paddingHorizontal: 28, paddingVertical: 15,
                    borderRadius: 9999,
                    borderWidth: 1.5, borderColor: '#E07830',
                    shadowColor: '#C96A24', shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
                  },
                  isMobile && { width: '100%', justifyContent: 'center' },
                ]}
                onPress={() => navigation.navigate('Signup')} activeOpacity={0.84}>
                <Icon name="rocket-outline" size={17} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                  Start Learning Free
                </Text>
              </TouchableOpacity>

              {/* Secondary CTA */}
              <TouchableOpacity
                style={[
                  {
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                    paddingHorizontal: 24, paddingVertical: 15,
                    borderRadius: 9999,
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(26,26,46,0.16)',
                  },
                  isMobile && { width: '100%', justifyContent: 'center' },
                ]}
                onPress={() => navigation.navigate('ExploreCourses')} activeOpacity={0.8}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.85)' : NAVY }}>
                  Browse Courses
                </Text>
                <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="arrow-forward" size={13} color={isDark ? 'rgba(255,255,255,0.7)' : NAVY} />
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Stats row */}
          <Animated.View style={{ opacity: a4, transform: [{ translateY: slideFrom(a4, 12) }], alignSelf: isMobile ? 'center' : 'flex-start' }}>
            <View style={[styles.heroStatsRow, isMobile && styles.heroStatsRowMobile]}>
              {stats.map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <View style={[styles.statsRowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,26,46,0.14)' }]} />}
                  <View style={[styles.statsRowItem, isMobile && styles.statsRowItemMobile]}>
                    <Text style={[styles.statValue, { color: s.color }, isMobile && { fontSize: 18 }]}>{s.value}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </Animated.View>

          {/* Mobile: feature pills after stats */}
          {isMobile && (
            <Animated.View style={{ opacity: a4, marginTop: 20, flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: 'sparkles',         label: 'AI Tutor',     color: '#6366F1' },
                { icon: 'ribbon-outline',    label: 'Certificates', color: '#10B981' },
                { icon: 'bar-chart-outline', label: 'Progress',     color: ORANGE    },
              ].map(p => (
                <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: p.color + '18', borderWidth: 1, borderColor: p.color + '40' }}>
                  <Icon name={p.icon} size={12} color={p.color} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: p.color }}>{p.label}</Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>{/* end left column */}

        {/* ════ RIGHT: illustration (desktop only) ════ */}
        {!isMobile && (
          <HeroIllustration isDark={isDark} fadeAnim={fadeAnim} />
        )}
      </View>
    </View>
  );
};

// ─── ANNOUNCEMENT BANNER ──────────────────────────────────────────────────────
const AnnouncementBanner = ({ navigation }) => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <View style={{
      backgroundColor: ORANGE,
      paddingVertical: 9,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'center' }}>
        AI Virtual Classroom is live. Try it free today.
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Signup')}
        activeOpacity={0.8}
        style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.18)' }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Try Now</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.7} style={{ padding: 4, marginLeft: 2 }}>
        <Icon name="close" size={14} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </View>
  );
};

// ─── CATEGORY BROWSE SECTION ──────────────────────────────────────────────────
const CAT_ICONS_MAP = {
  Technology: 'laptop-outline', Design: 'color-palette-outline',
  Business: 'briefcase-outline', 'Data Science': 'analytics-outline',
  Data: 'analytics-outline', Marketing: 'megaphone-outline',
  Default: 'folder-outline',
};
const CAT_PILL_COLORS = {
  Technology: '#6366F1', Design: '#EC4899', Business: '#10B981',
  'Data Science': '#3B82F6', Data: '#3B82F6', Marketing: '#F59E0B',
};

// ─── 6. EXPLORE SECTION (categories + courses merged) ────────────────────────
const ExploreSection = ({ navigation, theme, isDark, isMobile, onLayout }) => {
  const [categories, setCategories]   = useState([]);
  const [courses, setCourses]         = useState([]);
  const [activeCat, setActiveCat]     = useState(null); // null = "All"
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);

  const cardBg     = isDark ? 'rgba(255,255,255,0.06)' : '#F8F9FF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)';
  const CARD_W     = isMobile ? 220 : 240;

  // Load categories once
  useEffect(() => {
    categoryAPI.getAll()
      .then(res => setCategories((res.categories || []).slice(0, 8)))
      .catch(() => {});
  }, []);

  // Load courses when activeCat changes
  useEffect(() => {
    setLoading(true); setError(false);
    const fetch = activeCat
      ? courseAPI.getAll({ category: activeCat, status: 'published' })
      : courseAPI.getTopCourses(6);
    fetch
      .then(res => setCourses((res.courses || []).slice(0, 6)))
      .catch(() => { setCourses([]); setError(true); })
      .finally(() => setLoading(false));
  }, [activeCat]);

  const sectionBg = isDark ? NAVY2 : '#FFFFFF';

  const renderCard = (course, horizontal) => {
    const catName  = course.category?.name || 'General';
    const catColor = CAT_COLORS[catName] || ORANGE;
    const thumb    = course.thumbnailImage ? resolveFileUrl(course.thumbnailImage) : null;
    const instructor = course.user?.name || null;

    if (horizontal) {
      return (
        <TouchableOpacity key={course.id}
          style={[styles.courseCard, { width: CARD_W, backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
          activeOpacity={0.85}>
          <View style={[styles.courseThumb, { backgroundColor: catColor + '20' }]}>
            {thumb
              ? <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%', borderTopLeftRadius: 14, borderTopRightRadius: 14 }} resizeMode="cover" />
              : <Icon name="book-outline" size={38} color={catColor} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 10 }}>
            <View style={[styles.courseCatBadge, { backgroundColor: catColor + '20', marginBottom: 0, paddingHorizontal: 0, paddingVertical: 0 }]}>
              <Text style={[styles.courseCatText, { color: catColor }]}>{catName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, backgroundColor: course.creationMode === 'ai' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.1)', borderColor: course.creationMode === 'ai' ? 'rgba(139,92,246,0.3)' : 'rgba(34,211,238,0.25)' }}>
              <Icon name={course.creationMode === 'ai' ? 'sparkles' : 'person'} size={10} color={course.creationMode === 'ai' ? '#8B5CF6' : '#22D3EE'} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: course.creationMode === 'ai' ? '#8B5CF6' : '#22D3EE' }}>{course.creationMode === 'ai' ? 'AI-Powered' : 'Instructor-Led'}</Text>
            </View>
          </View>
          <View style={styles.courseInfo}>
            <Text style={[styles.courseTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>{course.name}</Text>
            {instructor && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <Icon name="person-circle-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={[styles.courseInstructor, { color: theme.colors.textSecondary }]}>{instructor}</Text>
              </View>
            )}
            <View style={styles.courseFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="people-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.courseEnroll, { color: theme.colors.textSecondary }]}>{(course.enrollmentCount || 0).toLocaleString()} enrolled</Text>
              </View>
              <TouchableOpacity style={styles.enrollBtn} onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.enrollBtnText}>Enroll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity key={course.id}
        style={[styles.courseCard, { width: '100%', backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', overflow: 'hidden' }]}
        onPress={() => navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
        activeOpacity={0.85}>
        <View style={{ width: 110, height: 110, backgroundColor: catColor + '20', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          {thumb
            ? <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <Icon name="book-outline" size={34} color={catColor} />}
        </View>
        <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: catColor + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: catColor, fontSize: 10, fontWeight: '700' }}>{catName}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 20 }} numberOfLines={2}>{course.name}</Text>
            {instructor && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Icon name="person-circle-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{instructor}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="people-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{(course.enrollmentCount || 0).toLocaleString()} enrolled</Text>
            </View>
            <TouchableOpacity style={[styles.enrollBtn, { paddingHorizontal: 14, paddingVertical: 6 }]} onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.enrollBtnText}>Enroll</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const catFallback = [
    { name: 'Technology' }, { name: 'Design' }, { name: 'Business' },
    { name: 'Data Science' }, { name: 'Marketing' },
  ];
  const catItems = categories.length > 0 ? categories : catFallback;

  return (
    <View style={[styles.section, { backgroundColor: sectionBg, paddingVertical: isMobile ? 44 : 68 }]} onLayout={onLayout}>
      {/* Header row */}
      <AnimatedReveal fromY={18} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 18 : 24, width: '100%' }}>
        <View>
          <View style={{ backgroundColor: ORANGE + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 }}>
            <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }}>EXPLORE & LEARN</Text>
          </View>
          <Text style={{ fontSize: isMobile ? 20 : 26, fontWeight: '800', color: theme.colors.textPrimary }}>
            Browse Courses
          </Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: ORANGE, backgroundColor: ORANGE + '12', borderRadius: 9999, paddingHorizontal: isMobile ? 12 : 16, paddingVertical: isMobile ? 7 : 9 }}
          onPress={() => navigation.navigate('ExploreCourses')}
          activeOpacity={0.75}
        >
          <Text style={{ color: ORANGE, fontSize: isMobile ? 12 : 13, fontWeight: '700' }}>View All</Text>
          <Icon name="arrow-forward" size={isMobile ? 12 : 13} color={ORANGE} />
        </TouchableOpacity>
      </AnimatedReveal>

      {/* Category filter pills */}
      <AnimatedReveal fromY={12} style={{ width: '100%', marginBottom: isMobile ? 18 : 24 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {/* "All" pill */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: activeCat === null ? ORANGE : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,46,0.18)'), backgroundColor: activeCat === null ? ORANGE : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.04)') }}
            onPress={() => setActiveCat(null)}
            activeOpacity={0.8}
          >
            <Icon name="apps" size={12} color={activeCat === null ? '#fff' : theme.colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeCat === null ? '#fff' : theme.colors.textSecondary }}>All</Text>
          </TouchableOpacity>
          {catItems.map((cat) => {
            const color    = CAT_PILL_COLORS[cat.name] || ORANGE;
            const icon     = CAT_ICONS_MAP[cat.name]   || CAT_ICONS_MAP.Default;
            const isActive = activeCat === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: isActive ? color : color + '55', backgroundColor: isActive ? color : color + '12' }}
                onPress={() => setActiveCat(isActive ? null : cat.name)}
                activeOpacity={0.8}
              >
                <Icon name={icon} size={12} color={isActive ? '#fff' : color} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : theme.colors.textPrimary }}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </AnimatedReveal>

      {/* Course cards */}
      {loading && (
        isMobile ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.courseCard, { width: '100%', backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', height: 100 }]}>
                <View style={{ width: 100, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ECECEC', borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }} />
                <View style={{ flex: 1, padding: 14, gap: 10, justifyContent: 'center' }}>
                  <View style={{ height: 11, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E0', width: '40%' }} />
                  <View style={{ height: 13, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E0', width: '90%' }} />
                  <View style={{ height: 11, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EBEBEB', width: '55%' }} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.courseCard, { width: CARD_W, backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.courseThumb, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ECECEC' }]} />
                <View style={{ padding: 14, gap: 10 }}>
                  <View style={{ height: 11, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E0', width: '40%' }} />
                  <View style={{ height: 13, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E0', width: '90%' }} />
                </View>
              </View>
            ))}
          </ScrollView>
        )
      )}

      {!loading && error && (
        <View style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="cloud-offline-outline" size={36} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 10, fontSize: 13 }}>Could not load courses.</Text>
        </View>
      )}

      {!loading && !error && courses.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="book-outline" size={36} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 10, fontSize: 13 }}>
            {activeCat ? `No courses in ${activeCat} yet.` : 'No published courses yet.'}
          </Text>
        </View>
      )}

      {!loading && !error && courses.length > 0 && (
        isMobile ? (
          <View style={{ gap: 12, width: '100%' }}>
            {courses.map((c, i) => (
              <AnimatedReveal key={c.id} delay={i * 70} fromY={20}>{renderCard(c, false)}</AnimatedReveal>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8, paddingHorizontal: 2 }}>
            {courses.map((c, i) => (
              <AnimatedReveal key={c.id} delay={i * 80} fromY={20}>{renderCard(c, true)}</AnimatedReveal>
            ))}
          </ScrollView>
        )
      )}
    </View>
  );
};

// ─── AI FEATURE SHOWCASE ──────────────────────────────────────────────────────
const AIShowcaseSection = ({ navigation, theme, isDark, isMobile }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [waveAnim]);

  const classroomFeatures = [
    { icon: 'easel-outline',       color: '#6366F1', text: 'AI-generated lecture slides and whiteboards for every topic' },
    { icon: 'chatbubbles-outline', color: '#10B981', text: 'Ask questions mid-lecture and get instant, context-aware answers' },
    { icon: 'bar-chart-outline',   color: ORANGE,    text: 'Live quizzes generated on the spot to test your understanding' },
    { icon: 'headset-outline',     color: '#3B82F6', text: 'Audio narration and visual aids adapting to your pace' },
  ];

  const WAVE_HEIGHTS = [3,5,8,5,3,6,9,6,4,7,10,7,5,8,6,4,5,7,4,3,5,8,6,3,7];

  return (
    <View style={{ backgroundColor: '#07071A', paddingVertical: isMobile ? 36 : 52, paddingHorizontal: isMobile ? 20 : 40, alignItems: 'center' }}>
      <View style={{ maxWidth: 1100, width: '100%', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 28 : 48 }}>

        {/* Left: text column */}
        <AnimatedReveal fromY={24} style={{ flex: 1 }}>
          <View style={{ backgroundColor: '#6366F1' + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: isMobile ? 'center' : 'flex-start', marginBottom: 10 }}>
            <Text style={{ color: '#6366F1', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>VIRTUAL CLASSROOM</Text>
          </View>
          <Text style={{
            fontSize: isMobile ? 20 : 28, fontWeight: '900', color: '#FFFFFF',
            letterSpacing: -0.5, lineHeight: isMobile ? 28 : 36, marginBottom: 10,
            textAlign: isMobile ? 'center' : 'left',
          }}>
            A Classroom That{'\n'}
            <Text style={{ color: ORANGE }}>Thinks With You</Text>
          </Text>
          <Text style={{ fontSize: isMobile ? 13 : 13, color: 'rgba(255,255,255,0.6)', lineHeight: 21, marginBottom: 18, textAlign: isMobile ? 'center' : 'left', maxWidth: 400 }}>
            Live AI-narrated lectures, interactive whiteboards, and on-demand quizzes inside a real-time session.
          </Text>
          <View style={{ gap: 10, marginBottom: 22 }}>
            {classroomFeatures.map((f, i) => (
              <AnimatedReveal key={i} delay={i * 80} fromY={12}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: f.color + '22', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <Icon name={f.icon} size={13} color={f.color} />
                  </View>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18, flex: 1 }}>{f.text}</Text>
                </View>
              </AnimatedReveal>
            ))}
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: ORANGE, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999, alignSelf: isMobile ? 'center' : 'flex-start', shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 }}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.85}
          >
            <Icon name="play-circle-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Enter Virtual Classroom</Text>
          </TouchableOpacity>
        </AnimatedReveal>

        {/* Right: classroom mockup — whiteboard-first design (desktop only) */}
        {!isMobile && (
          <AnimatedReveal delay={140} fromY={28} style={{ flex: 1.2 }}>
            {/* Outer glow ring */}
            <View style={{ borderRadius: 16, padding: 1, backgroundColor: 'transparent', ...(Platform.OS === 'web' ? { boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 32px 64px rgba(0,0,0,0.7), 0 0 80px rgba(99,102,241,0.18)' } : {}) }}>
              <View style={{ borderRadius: 15, overflow: 'hidden', backgroundColor: '#0A0C16' }}>

                {/* ── CHROME TOP BAR ── */}
                <View style={{ backgroundColor: '#12151F', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                  {/* macOS traffic lights */}
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF5F57' }} />
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#FEBC2E' }} />
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#28C840' }} />
                  </View>
                  {/* Course info */}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' }}>
                      <Icon name="diamond-outline" size={7} color="#fff" />
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600' }}>Introduction to SkillSphere</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>· Module 1 of 1</Text>
                  </View>
                  {/* Progress */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 90, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                      <View style={{ width: '10%', height: 3, backgroundColor: '#22C55E', borderRadius: 2 }} />
                    </View>
                    <Text style={{ color: ORANGE, fontSize: 9.5, fontWeight: '800' }}>10%</Text>
                  </View>
                </View>

                {/* ── SLIDE TITLE BAR ── */}
                <View style={{ backgroundColor: '#0E1018', paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4B5563' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>PAUSED</Text>
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700', flex: 1 }}>What is SkillSphere?</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(99,102,241,0.18)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)' }}>
                      <Icon name="navigate-outline" size={8} color="#9B9EFF" />
                      <Text style={{ color: '#9B9EFF', fontSize: 7.5, fontWeight: '600' }}>Getting started</Text>
                    </View>
                    <Icon name="volume-mute-outline" size={11} color="rgba(255,255,255,0.28)" />
                    <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}>
                      <Icon name="play" size={9} color="rgba(255,255,255,0.65)" />
                    </View>
                    <Icon name="play-skip-forward" size={11} color="rgba(255,255,255,0.3)" />
                  </View>
                </View>

                {/* ── WHITEBOARD SLIDE — the hero ── */}
                <View style={{ marginHorizontal: 12, marginTop: 10, marginBottom: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(175,145,88,0.45)', ...(Platform.OS === 'web' ? { boxShadow: '0 4px 24px rgba(0,0,0,0.4)' } : {}) }}>
                  {/* mac chrome bar — exact app colors */}
                  <View style={{ backgroundColor: '#B89060', paddingHorizontal: 8, paddingVertical: 4.5, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF5F57' }} />
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4FC3F7' }} />
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#57C561' }} />
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#C4B5A0' }} />
                  </View>
                  {/* Cream slide body */}
                  <View style={{ backgroundColor: '#F7F2E8', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F0F0F', marginBottom: 6, letterSpacing: -0.4 }}>What is SkillSphere?</Text>
                    <Text style={{ fontSize: 8.5, color: '#2A2A2A', lineHeight: 14, marginBottom: 10 }}>
                      {'▶  AI Tutor  ·  Expert Courses  ·  Certificates  ·  Live Classroom'}
                    </Text>
                    {/* Pill badges — row 1 */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                      {[
                        { text: 'AI-powered learning', c: '#2563EB' },
                        { text: 'live classroom',      c: '#DC2626' },
                        { text: 'certificates',        c: '#7C3AED' },
                      ].map((p, i) => (
                        <View key={i} style={{ borderWidth: 1.5, borderColor: p.c, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 8, color: p.c, fontStyle: 'italic', fontWeight: '500' }}>{p.text}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Pill badges — row 2 */}
                    <View style={{ flexDirection: 'row', gap: 5, marginBottom: 10 }}>
                      {[
                        { text: 'expert instructors', c: '#059669' },
                        { text: 'Pakistan',           c: '#374151' },
                      ].map((p, i) => (
                        <View key={i} style={{ borderWidth: 1.5, borderColor: p.c, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 8, color: p.c, fontStyle: 'italic', fontWeight: '500' }}>{p.text}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Yellow insight highlight */}
                    <View style={{ backgroundColor: '#FDE047', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 8.5, color: '#111', fontStyle: 'italic', lineHeight: 13 }}>
                        SkillSphere is an AI-powered learning platform offering expert courses, live classrooms, and verified certificates.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ── AI NARRATOR BAR ── */}
                <View style={{ paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <Icon name="navigate" size={12} color="#fff" />
                  </View>
                  <Text style={{ flex: 1, fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 14 }} numberOfLines={1}>
                    Great. Now let's explore how SkillSphere's AI adapts to your unique learning style.
                  </Text>
                  {/* Action icon row — matches app */}
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {['navigate-outline', 'chatbubble-outline', 'bulb-outline', 'refresh-outline', 'help-circle-outline'].map((ic, i) => (
                      <View key={i} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                        <Icon name={ic} size={9} color="rgba(255,255,255,0.28)" />
                      </View>
                    ))}
                  </View>
                </View>

                {/* ── WAVEFORM + STATUS ── */}
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', backgroundColor: '#080A12' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(99,102,241,0.16)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <Icon name="school-outline" size={11} color="#9B9EFF" />
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
                    {WAVE_HEIGHTS.map((h, i) => (
                      <Animated.View key={i} style={{
                        width: 2, height: h * 0.8, borderRadius: 1, backgroundColor: '#6366F1',
                        opacity: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2 + (i % 3) * 0.15, 0.6 + (i % 2) * 0.3] }),
                      }} />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E' }} />
                    <Text style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.45)', fontWeight: '700', letterSpacing: 0.5 }}>READY</Text>
                    <Text style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.18)' }}>· SKILLSPHERE AI</Text>
                  </View>
                </View>

                {/* ── TAKE QUIZ footer ── */}
                <View style={{ backgroundColor: '#12151F', paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                  <Icon name="help-circle-outline" size={12} color="rgba(255,255,255,0.3)" />
                  <Text style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: 0.3 }}>Take Quiz</Text>
                </View>

              </View>
            </View>
          </AnimatedReveal>
        )}
      </View>
    </View>
  );
};

// ─── 4. FEATURES (BENTO GRID) ─────────────────────────────────────────────────
const FEATURES_DATA = [
  { icon: 'chatbubbles-outline', title: 'AI Assistant',       desc: 'Get instant help from our integrated AI tutor, available 24/7 inside every course.', num: '01', accent: '#6366F1' },
  { icon: 'school-outline',      title: 'Expert Instructors', desc: 'Learn from certified professionals with real-world industry experience.',              num: '02', accent: '#10B981' },
  { icon: 'ribbon-outline',      title: 'Certificates',       desc: 'Earn industry-recognised certificates that boost your career prospects.',               num: '03', accent: '#F59E0B' },
  { icon: 'construct-outline',   title: 'Live Projects',      desc: 'Apply knowledge with hands-on projects that build your portfolio.',                     num: '04', accent: '#EC4899' },
  { icon: 'time-outline',        title: 'Flexible Learning',  desc: 'Study at your own pace with lifetime access to all course materials.',                  num: '05', accent: '#3B82F6' },
  { icon: 'bar-chart-outline',   title: 'Track Progress',     desc: 'Monitor your learning journey with detailed analytics and insights.',                   num: '06', accent: ORANGE   },
];

const FeatureCard = ({ feature, wide, isDark, theme, delay }) => {
  const cardBg     = isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)';
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === 'web';
  return (
    <AnimatedReveal delay={delay} fromY={24} style={wide ? { flex: 1.5 } : { flex: 1 }}>
      <View
        style={[
          { backgroundColor: cardBg, borderRadius: 18, borderWidth: 1, borderColor: hovered ? feature.accent + '55' : cardBorder, padding: 24, overflow: 'hidden', height: '100%' },
          isWeb && { transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease', transform: hovered ? [{ scale: 1.025 }] : [{ scale: 1 }] },
          isWeb && hovered && { boxShadow: `0 8px 32px ${feature.accent}22` },
        ]}
        {...(isWeb ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        } : {})}
      >
        {/* Watermark */}
        <Text style={{ position: 'absolute', right: 10, bottom: 6, fontSize: 64, fontWeight: '900', lineHeight: 64, color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(26,26,46,0.04)', fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold' }}>
          {feature.num}
        </Text>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: feature.accent + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <Icon name={feature.icon} size={24} color={feature.accent} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8, lineHeight: 22 }}>
          {feature.title}
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 21 }}>
          {feature.desc}
        </Text>
        {/* AI card chat preview */}
        {feature.num === '01' && wide && (
          <View style={{ marginTop: 20, gap: 8 }}>
            <View style={{ backgroundColor: feature.accent + '14', borderRadius: 10, padding: 10, alignSelf: 'flex-start', maxWidth: '80%' }}>
              <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.75)' : NAVY, lineHeight: 17 }}>What is a closure in JavaScript?</Text>
            </View>
            <View style={{ backgroundColor: ORANGE + '14', borderRadius: 10, padding: 10, alignSelf: 'flex-end', maxWidth: '88%' }}>
              <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.75)' : NAVY, lineHeight: 17 }}>A closure gives access to an outer function's scope from an inner function...</Text>
            </View>
          </View>
        )}
      </View>
    </AnimatedReveal>
  );
};

const FeaturesSection = ({ theme, isDark, isMobile, onLayout }) => {
  const sectionBg = isDark ? NAVY2 : '#FFFFFF';

  if (isMobile) {
    return (
      <View style={[styles.section, { backgroundColor: sectionBg, paddingVertical: 48 }]} onLayout={onLayout}>
        <SectionTitle tag="Why Us" title="Everything You Need to Succeed"
          subtitle="Cutting-edge technology with expert knowledge for an unparalleled learning experience."
          theme={theme} isMobile={isMobile} />
        <View style={{ gap: 12, width: '100%' }}>
          {FEATURES_DATA.map((f, i) => (
            <FeatureCard key={f.num} feature={f} wide={false} isDark={isDark} theme={theme} delay={i * 60} />
          ))}
        </View>
      </View>
    );
  }

  // Desktop: Row 1 — wide AI card + 1 card; Row 2 — 3 equal cards
  return (
    <View style={[styles.section, { backgroundColor: sectionBg, paddingVertical: 72 }]} onLayout={onLayout}>
      <SectionTitle tag="Why Us" title="Everything You Need to Succeed"
        subtitle="Cutting-edge technology with expert knowledge for an unparalleled learning experience."
        theme={theme} isMobile={isMobile} />
      <View style={{ gap: 14, maxWidth: 1100, width: '100%' }}>
        {/* Row 1: AI (wide) + Certificates */}
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <FeatureCard feature={FEATURES_DATA[0]} wide isDark={isDark} theme={theme} delay={0} />
          <FeatureCard feature={FEATURES_DATA[2]} wide={false} isDark={isDark} theme={theme} delay={80} />
        </View>
        {/* Row 2: Expert + Live + Flexible + Track */}
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {[FEATURES_DATA[1], FEATURES_DATA[3], FEATURES_DATA[4], FEATURES_DATA[5]].map((f, i) => (
            <FeatureCard key={f.num} feature={f} wide={false} isDark={isDark} theme={theme} delay={120 + i * 60} />
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── 5. HOW IT WORKS (TIMELINE) ───────────────────────────────────────────────
const HowItWorksSection = ({ theme, isDark, isMobile, onLayout }) => {
  const steps = [
    { icon: 'search-outline',     num: '01', title: 'Browse Courses',   desc: 'Explore our library across technology, business, design, and more.' },
    { icon: 'person-add-outline', num: '02', title: 'Enroll & Learn',   desc: 'Learn with video lessons, hands-on projects, and quizzes at your own pace.' },
    { icon: 'medal-outline',      num: '03', title: 'Earn Certificate', desc: 'Pass the final assessment and download your verified certificate.' },
  ];

  const travelDot = useRef(new Animated.Value(0)).current;
  const [lineWidth, setLineWidth] = useState(200);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(travelDot, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(travelDot, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(300),
      ])
    ).start();
  }, [travelDot]);

  const cardBg     = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)';

  return (
    <View style={[styles.section, { backgroundColor: isDark ? NAVY : '#F8F9FF', paddingVertical: isMobile ? 48 : 80 }]} onLayout={onLayout}>
      <SectionTitle tag="The Process" title="Three Steps to Mastery"
        subtitle="A proven path from curious beginner to certified professional."
        theme={theme} isMobile={isMobile} />

      {/* Desktop: horizontal timeline */}
      {!isMobile ? (
        <View style={{ maxWidth: 960, width: '100%', flexDirection: 'row', alignItems: 'stretch' }}>
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <AnimatedReveal delay={i * 140} fromY={28} style={{ flex: 1 }}>
                <View style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1, borderRadius: 20, padding: 28, overflow: 'hidden', height: '100%' }}>
                  {/* Watermark */}
                  <Text style={{ position: 'absolute', right: 10, bottom: 4, fontSize: 80, fontWeight: '900', lineHeight: 80, color: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(26,26,46,0.04)', fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold' }}>
                    {step.num}
                  </Text>
                  {/* Icon */}
                  <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: ORANGE + '18', justifyContent: 'center', alignItems: 'center', marginBottom: 18 }}>
                    <Icon name={step.icon} size={28} color={ORANGE} />
                  </View>
                  {/* Number pill */}
                  <View style={{ backgroundColor: ORANGE + '15', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 10 }}>
                    <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{step.num}</Text>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10, lineHeight: 24 }}>{step.title}</Text>
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 22 }}>{step.desc}</Text>
                </View>
              </AnimatedReveal>
              {/* Connector between cards */}
              {i < steps.length - 1 && (
                <View style={{ width: 40, alignItems: 'center', justifyContent: 'center', paddingTop: 10 }}>
                  {/* Animated traveling dot */}
                  <View style={{ width: 32, height: 2, backgroundColor: isDark ? 'rgba(255,140,66,0.25)' : 'rgba(246,139,60,0.3)', borderRadius: 1, position: 'relative', overflow: 'visible' }}>
                    <Animated.View style={{
                      position: 'absolute', width: 10, height: 10, borderRadius: 5,
                      backgroundColor: ORANGE, top: -4,
                      shadowColor: ORANGE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 3,
                      transform: [{ translateX: travelDot.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }],
                    }} />
                  </View>
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      ) : (
        /* Mobile: vertical timeline */
        <View style={{ width: '100%', paddingLeft: 8 }}>
          {/* Vertical line */}
          <View style={{ position: 'absolute', left: 28, top: 22, bottom: 22, width: 2, backgroundColor: ORANGE + '22' }} />

          {steps.map((step, i) => (
            <AnimatedReveal key={step.num} delay={i * 100} fromY={22} style={{ marginBottom: i < steps.length - 1 ? 20 : 0 }}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                {/* Timeline node */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE + '18', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: ORANGE + '45', flexShrink: 0, zIndex: 1 }}>
                  <Icon name={step.icon} size={20} color={ORANGE} />
                </View>
                {/* Card */}
                <View style={{ flex: 1, backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1, borderRadius: 16, padding: 18, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: ORANGE + '15', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: ORANGE, fontSize: 10, fontWeight: '800' }}>{step.num}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary }}>{step.title}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 21 }}>{step.desc}</Text>
                </View>
              </View>
            </AnimatedReveal>
          ))}
        </View>
      )}
    </View>
  );
};

// ─── 6. COURSES CAROUSEL ──────────────────────────────────────────────────────
const CAT_COLORS = {
  Technology: '#6366F1', Design: '#EC4899', Business: '#10B981',
  'Data Science': '#3B82F6', Data: '#3B82F6', Marketing: '#F59E0B',
};

const CoursesCarousel = ({ navigation, theme, isDark, isMobile, onLayout }) => {
  // Kept as a thin wrapper — actual logic is inside ExploreSection
  return <ExploreSection navigation={navigation} theme={theme} isDark={isDark} isMobile={isMobile} onLayout={onLayout} />;
};
const _CoursesCarouselImpl = ({ navigation, theme, isDark, isMobile, onLayout }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    courseAPI.getTopCourses(3)
      .then(res => setCourses(res.courses || []))
      .catch(() => { setCourses([]); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  const cardBg     = isDark ? 'rgba(255,255,255,0.06)' : '#F8F9FF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)';
  const CARD_W     = isMobile ? 220 : 240;

  return (
    <View style={[styles.section, { backgroundColor: isDark ? NAVY2 : '#FFFFFF', paddingVertical: isMobile ? 48 : 72 }]} onLayout={onLayout}>
      <AnimatedReveal fromY={18} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: isMobile ? 20 : 32, width:'100%' }}>
        <View>
          <View style={{ backgroundColor: ORANGE+'20', borderRadius:20, paddingHorizontal:12, paddingVertical:4, alignSelf:'flex-start', marginBottom:8 }}>
            <Text style={{ color:ORANGE, fontSize:11, fontWeight:'700', letterSpacing:1.2 }}>LEARN NOW</Text>
          </View>
          <Text style={{ fontSize: isMobile ? 20 : 26, fontWeight:'800', color: theme.colors.textPrimary }}>Top Courses</Text>
        </View>
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            borderWidth: 1.5, borderColor: ORANGE,
            backgroundColor: ORANGE + '12',
            borderRadius: 20,
            paddingHorizontal: isMobile ? 12 : 16,
            paddingVertical: isMobile ? 7 : 9,
          }}
          onPress={() => navigation.navigate('ExploreCourses')}
          activeOpacity={0.75}
        >
          <Text style={{ color: ORANGE, fontSize: isMobile ? 12 : 13, fontWeight: '700' }}>View All</Text>
          <Icon name="arrow-forward" size={isMobile ? 12 : 13} color={ORANGE} />
        </TouchableOpacity>
      </AnimatedReveal>

      {loading && (
        isMobile ? (
          <View style={{ gap:12 }}>
            {[1,2,3].map(i => (
              <View key={i} style={[styles.courseCard, { width:'100%', backgroundColor:cardBg, borderColor:cardBorder, flexDirection:'row', height:100 }]}>
                <View style={{ width:100, backgroundColor: isDark ? 'rgba(255,255,255,0.04)':'#ECECEC', borderTopLeftRadius:14, borderBottomLeftRadius:14 }} />
                <View style={{ flex:1, padding:14, gap:10, justifyContent:'center' }}>
                  <View style={{ height:11, borderRadius:6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)':'#E0E0E0', width:'40%' }} />
                  <View style={{ height:13, borderRadius:6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)':'#E0E0E0', width:'90%' }} />
                  <View style={{ height:11, borderRadius:6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)':'#EBEBEB', width:'55%' }} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:14, paddingBottom:8 }}>
            {[1,2,3].map(i => (
              <View key={i} style={[styles.courseCard, { width:CARD_W, backgroundColor:cardBg, borderColor:cardBorder }]}>
                <View style={[styles.courseThumb, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)':'#ECECEC' }]} />
                <View style={{ padding:14, gap:10 }}>
                  <View style={{ height:11, borderRadius:6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)':'#E0E0E0', width:'40%' }} />
                  <View style={{ height:13, borderRadius:6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)':'#E0E0E0', width:'90%' }} />
                  <View style={{ height:13, borderRadius:6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)':'#EBEBEB', width:'65%' }} />
                </View>
              </View>
            ))}
          </ScrollView>
        )
      )}

      {!loading && error && (
        <View style={{ alignItems:'center', paddingVertical:28 }}>
          <Icon name="cloud-offline-outline" size={36} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop:10, fontSize:13 }}>
            Could not load courses. Check your connection.
          </Text>
        </View>
      )}

      {!loading && !error && courses.length === 0 && (
        <View style={{ alignItems:'center', paddingVertical:28 }}>
          <Icon name="book-outline" size={36} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop:10, fontSize:13 }}>
            No published courses yet.
          </Text>
        </View>
      )}

      {!loading && !error && courses.length > 0 && (() => {
        const renderCard = (course, horizontal) => {
          const catName = course.category?.name || 'General';
          const catColor = CAT_COLORS[catName] || ORANGE;
          const thumb = course.thumbnailImage ? resolveFileUrl(course.thumbnailImage) : null;
          const instructor = course.user?.name || null;

          if (horizontal) {
            // Desktop/tablet: vertical card (image on top)
            return (
              <TouchableOpacity key={course.id}
                style={[styles.courseCard, { width:CARD_W, backgroundColor:cardBg, borderColor:cardBorder }]}
                onPress={() => navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
                activeOpacity={0.85}>
                <View style={[styles.courseThumb, { backgroundColor: catColor+'20' }]}>
                  {thumb ? (
                    <Image source={{ uri:thumb }}
                      style={{ width:'100%', height:'100%', borderTopLeftRadius:14, borderTopRightRadius:14 }}
                      resizeMode="cover" />
                  ) : (
                    <Icon name="book-outline" size={38} color={catColor} />
                  )}
                </View>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingTop:10 }}>
                  <View style={[styles.courseCatBadge, { backgroundColor: catColor+'20', marginBottom:0, paddingHorizontal:0, paddingVertical:0 }]}>
                    <Text style={[styles.courseCatText, { color:catColor }]}>{catName}</Text>
                  </View>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:20, borderWidth:1, backgroundColor: course.creationMode==='ai' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.1)', borderColor: course.creationMode==='ai' ? 'rgba(139,92,246,0.3)' : 'rgba(34,211,238,0.25)' }}>
                    <Icon name={course.creationMode==='ai' ? 'sparkles' : 'person'} size={10} color={course.creationMode==='ai' ? '#8B5CF6' : '#22D3EE'} />
                    <Text style={{ fontSize:10, fontWeight:'700', color: course.creationMode==='ai' ? '#8B5CF6' : '#22D3EE' }}>{course.creationMode==='ai' ? 'AI-Powered' : 'Instructor-Led'}</Text>
                  </View>
                </View>
                <View style={styles.courseInfo}>
                  <Text style={[styles.courseTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>{course.name}</Text>
                  {instructor && (
                    <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:5 }}>
                      <Icon name="person-circle-outline" size={13} color={theme.colors.textSecondary} />
                      <Text style={[styles.courseInstructor, { color: theme.colors.textSecondary }]}>{instructor}</Text>
                    </View>
                  )}
                  <View style={styles.courseFooter}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                      <Icon name="people-outline" size={12} color={theme.colors.textSecondary} />
                      <Text style={[styles.courseEnroll, { color: theme.colors.textSecondary }]}>
                        {(course.enrollmentCount||0).toLocaleString()} enrolled
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.enrollBtn} onPress={() => navigation.navigate('Signup')}>
                      <Text style={styles.enrollBtnText}>Enroll</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          // Mobile: horizontal card (image on left, info on right)
          return (
            <TouchableOpacity key={course.id}
              style={[styles.courseCard, { width:'100%', backgroundColor:cardBg, borderColor:cardBorder, flexDirection:'row', overflow:'hidden' }]}
              onPress={() => navigation.navigate('ExploreCourseDetail', { courseId: course.id, courseName: slugify(course.name) })}
              activeOpacity={0.85}>
              <View style={{ width:110, height:110, backgroundColor: catColor+'20', justifyContent:'center', alignItems:'center', flexShrink:0 }}>
                {thumb ? (
                  <Image source={{ uri:thumb }} style={{ width:'100%', height:'100%' }} resizeMode="cover" />
                ) : (
                  <Icon name="book-outline" size={34} color={catColor} />
                )}
              </View>
              <View style={{ flex:1, padding:12, justifyContent:'space-between' }}>
                <View>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                    <View style={{ backgroundColor: catColor+'20', borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
                      <Text style={{ color:catColor, fontSize:10, fontWeight:'700' }}>{catName}</Text>
                    </View>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:20, borderWidth:1, backgroundColor: course.creationMode==='ai' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.1)', borderColor: course.creationMode==='ai' ? 'rgba(139,92,246,0.3)' : 'rgba(34,211,238,0.25)' }}>
                      <Icon name={course.creationMode==='ai' ? 'sparkles' : 'person'} size={10} color={course.creationMode==='ai' ? '#8B5CF6' : '#22D3EE'} />
                      <Text style={{ fontSize:10, fontWeight:'700', color: course.creationMode==='ai' ? '#8B5CF6' : '#22D3EE' }}>{course.creationMode==='ai' ? 'AI-Powered' : 'Instructor-Led'}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize:14, fontWeight:'700', color: theme.colors.textPrimary, lineHeight:20 }} numberOfLines={2}>
                    {course.name}
                  </Text>
                  {instructor && (
                    <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:4 }}>
                      <Icon name="person-circle-outline" size={12} color={theme.colors.textSecondary} />
                      <Text style={{ fontSize:11, color: theme.colors.textSecondary }}>{instructor}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                    <Icon name="people-outline" size={12} color={theme.colors.textSecondary} />
                    <Text style={{ fontSize:11, color: theme.colors.textSecondary }}>
                      {(course.enrollmentCount||0).toLocaleString()} enrolled
                    </Text>
                  </View>
                  <TouchableOpacity style={[styles.enrollBtn, { paddingHorizontal:14, paddingVertical:6 }]}
                    onPress={() => navigation.navigate('Signup')}>
                    <Text style={styles.enrollBtnText}>Enroll</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        };

        return isMobile ? (
          <View style={{ gap:12 }}>
            {courses.map((c, i) => (
              <AnimatedReveal key={c.id} delay={i * 90} fromY={24}>
                {renderCard(c, false)}
              </AnimatedReveal>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap:14, paddingBottom:8, paddingHorizontal:2 }}>
            {courses.map((c, i) => (
              <AnimatedReveal key={c.id} delay={i * 100} fromY={24}>
                {renderCard(c, true)}
              </AnimatedReveal>
            ))}
          </ScrollView>
        );
      })()}
    </View>
  );
};

// ─── INSTRUCTOR SPOTLIGHT ─────────────────────────────────────────────────────
const InstructorSpotlightSection = ({ navigation, theme, isDark, isMobile }) => {
  const [instructors, setInstructors] = useState([]);

  useEffect(() => {
    courseAPI.getAll()
      .then(res => {
        const courses = (res.courses || []).filter(c => c.status === 'published' && c.user?.name);
        // Group by instructor name, keep top 4 by course count
        const map = {};
        courses.forEach(c => {
          const key = c.user.name;
          if (!map[key]) map[key] = { name: c.user.name, courses: 0, avatar: c.user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() };
          map[key].courses++;
        });
        const sorted = Object.values(map).sort((a, b) => b.courses - a.courses).slice(0, 4);
        if (sorted.length) setInstructors(sorted);
      })
      .catch(() => {});
  }, []);

  const AVATAR_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899'];

  if (!instructors.length) return null;

  return (
    <View style={{ backgroundColor: isDark ? NAVY2 : '#FFFFFF', paddingVertical: isMobile ? 44 : 64, paddingHorizontal: 20, alignItems: 'center' }}>
      <SectionTitle
        tag="Meet the Experts"
        title="Learn from the Best"
        subtitle="Our instructors are certified professionals with real-world industry experience."
        theme={theme} isMobile={isMobile}
      />
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 16, maxWidth: 900, width: '100%' }}>
        {instructors.map((inst, i) => (
          <AnimatedReveal key={inst.name} delay={i * 80} fromY={22} style={{ flex: 1 }}>
            <TouchableOpacity
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
                borderRadius: 18, borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
                padding: 20, alignItems: 'center',
                flexDirection: isMobile ? 'row' : 'column',
                gap: isMobile ? 14 : 0,
              }}
              onPress={() => navigation.navigate('ExploreCourses')}
              activeOpacity={0.82}
            >
              {/* Avatar */}
              <View style={{
                width: isMobile ? 52 : 68, height: isMobile ? 52 : 68,
                borderRadius: isMobile ? 26 : 34,
                backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] + '22',
                borderWidth: 2, borderColor: AVATAR_COLORS[i % AVATAR_COLORS.length] + '55',
                justifyContent: 'center', alignItems: 'center',
                marginBottom: isMobile ? 0 : 14, flexShrink: 0,
              }}>
                <Text style={{ fontSize: isMobile ? 18 : 22, fontWeight: '800', color: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                  {inst.avatar}
                </Text>
              </View>
              <View style={{ alignItems: isMobile ? 'flex-start' : 'center', flex: isMobile ? 1 : undefined }}>
                <Text style={{ fontSize: isMobile ? 14 : 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4, textAlign: isMobile ? 'left' : 'center' }}>
                  {inst.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="library-outline" size={12} color={ORANGE} />
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>
                    {inst.courses} {inst.courses === 1 ? 'course' : 'courses'}
                  </Text>
                </View>
                {!isMobile && (
                  <View style={{ marginTop: 12, backgroundColor: ORANGE + '18', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE }}>View Courses</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </AnimatedReveal>
        ))}
      </View>
    </View>
  );
};

// ─── 7. TESTIMONIALS (MARQUEE) ────────────────────────────────────────────────
const MARQUEE_CARD_W = 296;
const MARQUEE_GAP    = 14;
const MARQUEE_ITEM_W = MARQUEE_CARD_W + MARQUEE_GAP;

const TESTIMONIALS = [
  { name: 'Aisha Rahman', role: 'Software Developer', avatar: 'AR', avatarColor: '#6366F1', stars: 5, quote: "SkillSphere's AI tutor felt like having a personal mentor. I landed my first dev job within 3 months of completing the web dev course." },
  { name: 'Omar Khalid',  role: 'Data Analyst',       avatar: 'OK', avatarColor: '#10B981', stars: 5, quote: 'The course quality is genuinely world-class. The certificate I earned was recognised immediately by my employer. Absolutely worth it.' },
  { name: 'Fatima Zahra', role: 'UI/UX Designer',     avatar: 'FZ', avatarColor: '#EC4899', stars: 5, quote: 'I tried several platforms before SkillSphere. The AI-powered classroom adapts to how I learn and keeps me genuinely engaged every session.' },
  { name: 'Hassan Ali',   role: 'Full-Stack Dev',     avatar: 'HA', avatarColor: '#F59E0B', stars: 5, quote: 'Completed three courses in two months. The live projects gave me a real portfolio — I got hired before I even finished the last one.' },
  { name: 'Sara Malik',   role: 'Product Manager',    avatar: 'SM', avatarColor: '#8B5CF6', stars: 5, quote: 'The structured learning path made all the difference. I went from zero business knowledge to managing a product team in under a year.' },
];

const MarqueeRow = ({ items, direction, isDark, theme }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const totalWidth  = items.length * MARQUEE_ITEM_W;

  useEffect(() => {
    const start = direction === 'left' ? 0 : -totalWidth;
    const end   = direction === 'left' ? -totalWidth : 0;
    translateX.setValue(start);
    Animated.loop(
      Animated.timing(translateX, {
        toValue: end,
        duration: totalWidth * 28,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    return () => translateX.stopAnimation();
  }, [totalWidth, direction, translateX]);

  const cardBg     = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(26,26,46,0.08)';
  const doubled    = [...items, ...items];

  return (
    <View style={{ overflow: 'hidden', marginBottom: 12 }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
        {doubled.map((t, i) => (
          <View key={i} style={{ width: MARQUEE_CARD_W, marginRight: MARQUEE_GAP, backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor: cardBorder, padding: 20 }}>
            <View style={{ flexDirection: 'row', gap: 3, marginBottom: 10 }}>
              {Array.from({ length: t.stars }).map((_, si) => (
                <Icon key={si} name="star" size={13} color="#F59E0B" />
              ))}
            </View>
            <Text style={{ fontSize: 13, lineHeight: 21, fontStyle: 'italic', color: theme.colors.textPrimary, marginBottom: 14 }} numberOfLines={4}>
              "{t.quote}"
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.avatarColor + '22', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: t.avatarColor + '50' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: t.avatarColor }}>{t.avatar}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>{t.name}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{t.role}</Text>
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const TestimonialsSection = ({ theme, isDark, isMobile }) => {
  const cardBg     = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)';

  return (
    <View style={{ backgroundColor: isDark ? NAVY : '#F8F9FF', paddingVertical: isMobile ? 48 : 72 }}>
      <View style={{ alignItems: 'center', paddingHorizontal: 20, marginBottom: isMobile ? 28 : 40 }}>
        <SectionTitle tag="Success Stories" title="What Our Students Say"
          subtitle="Join thousands of learners who have transformed their careers with SkillSphere."
          theme={theme} isMobile={isMobile} />
        {/* Aggregate rating */}
        <AnimatedReveal fromY={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8, marginBottom: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#F59E0B' + '18', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="star" size={16} color="#F59E0B" />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary }}>
              4.8 <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary }}>out of 5</Text>
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 }}>Based on 2,000+ reviews</Text>
          </View>
        </AnimatedReveal>
      </View>

      {!isMobile ? (
        /* Desktop: two marquee rows */
        <View style={{ gap: 12, paddingVertical: 4 }}>
          <MarqueeRow items={TESTIMONIALS}                    direction="left"  isDark={isDark} theme={theme} />
          <MarqueeRow items={[...TESTIMONIALS].reverse()}     direction="right" isDark={isDark} theme={theme} />
        </View>
      ) : (
        /* Mobile: static cards */
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {TESTIMONIALS.slice(0, 3).map((t, i) => (
            <AnimatedReveal key={t.name} delay={i * 90} fromY={24}>
              <View style={{ backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor: cardBorder, padding: 18 }}>
                <View style={{ flexDirection: 'row', gap: 3, marginBottom: 10 }}>
                  {Array.from({ length: t.stars }).map((_, si) => <Icon key={si} name="star" size={13} color="#F59E0B" />)}
                </View>
                <Text style={{ fontSize: 13, lineHeight: 21, fontStyle: 'italic', color: theme.colors.textPrimary, marginBottom: 14 }}>"{t.quote}"</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.avatarColor + '22', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: t.avatarColor + '50' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: t.avatarColor }}>{t.avatar}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>{t.name}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{t.role}</Text>
                  </View>
                </View>
              </View>
            </AnimatedReveal>
          ))}
        </View>
      )}
    </View>
  );
};

// ─── HELPER: COUNT-UP ─────────────────────────────────────────────────────────
const CountUp = ({ value, style }) => {
  const numStr  = value.replace(/[^0-9]/g, '');
  const suffix  = value.replace(/[0-9,]/g, '');
  const numeric = parseInt(numStr, 10) || 0;
  const [display, setDisplay] = useState('0' + suffix);
  const triggered = useRef(false);
  const [uid] = useState(() => `cu-${Math.random().toString(36).slice(2, 8)}`);

  const trigger = useCallback(() => {
    if (triggered.current) return;
    triggered.current = true;
    const anim = new Animated.Value(0);
    anim.addListener(({ value: v }) => {
      const r = Math.round(v);
      setDisplay((r >= 1000 ? r.toLocaleString() : String(r)) + suffix);
    });
    Animated.timing(anim, {
      toValue: numeric,
      duration: 2200,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start(() => {
      anim.removeAllListeners();
      setDisplay((numeric >= 1000 ? numeric.toLocaleString() : String(numeric)) + suffix);
    });
  }, [numeric, suffix]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => {
      const el = document.getElementById(uid);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { trigger(); obs.disconnect(); } },
        { threshold: 0.3 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, 200);
    return () => clearTimeout(t);
  }, [uid, trigger]);

  return (
    <Text
      nativeID={Platform.OS === 'web' ? uid : undefined}
      onLayout={Platform.OS !== 'web' ? trigger : undefined}
      style={style}
    >
      {display}
    </Text>
  );
};

// ─── 8. STATISTICS (COUNT-UP) ─────────────────────────────────────────────────
const StatisticsSection = ({ isMobile, isDark }) => {
  const [liveStats, setLiveStats] = useState(null);

  useEffect(() => {
    courseAPI.getPublicStats()
      .then(res => { if (res.success) setLiveStats(res.stats); })
      .catch(() => {});
  }, []);

  const fmt = (val, suffix = '+') => {
    if (!val || val <= 0) return null; // let caller use fallback
    if (suffix === '%') return `${val}%`;
    return val >= 1000 ? `${(val / 1000).toFixed(0)}K+` : `${val}${suffix}`;
  };

  const stats = [
    {
      icon: 'people',
      value: fmt(liveStats?.totalStudents) || '10K+',
      label: 'Active Students',
    },
    {
      icon: 'library',
      value: fmt(liveStats?.totalCourses) || '200+',
      label: 'Expert Courses',
    },
    {
      icon: 'school',
      value: fmt(liveStats?.totalInstructors) || '50+',
      label: 'Instructors',
    },
    {
      icon: 'trophy',
      value: fmt(liveStats?.completionRate, '%') || '95%',
      label: 'Completion Rate',
    },
  ];

  return (
    <View style={{ backgroundColor: isDark ? '#0A0A1E' : NAVY, paddingVertical: isMobile ? 44 : 64, paddingHorizontal: 20 }}>
      <View style={[{ flexDirection: 'row', justifyContent: 'center', maxWidth: 900, alignSelf: 'center', width: '100%' }, isMobile && { flexWrap: 'wrap' }]}>
        {stats.map((s, i) => (
          <AnimatedReveal key={s.label} delay={i * 100} fromY={22} style={[{ flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12 }, isMobile && { width: '50%', flex: undefined, marginBottom: 20 }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE, marginBottom: 14, shadowColor: ORANGE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 }} />
            <CountUp
              value={s.value}
              style={{ fontSize: isMobile ? 32 : 42, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, lineHeight: isMobile ? 38 : 50, marginBottom: 6, fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold' }}
            />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>
              {s.label}
            </Text>
          </AnimatedReveal>
        ))}
      </View>
    </View>
  );
};

// ─── 9b. PAYMENT TRUST STRIP ─────────────────────────────────────────────────
const PaymentTrustStrip = ({ isDark, isMobile }) => {
  const items = [
    { icon: 'shield-checkmark',   text: 'SBP-Regulated Gateway' },
    { icon: 'ribbon',             text: 'Rs. 2,000 per Certificate' },
    { icon: 'alert-circle',       text: 'All Certificate Purchases are Non-Refundable' },
  ];
  return (
    <View style={{
      backgroundColor: '#0F0F1E',
      paddingVertical: isMobile ? 16 : 18,
      paddingHorizontal: isMobile ? 20 : 40,
    }}>
      <View style={{
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: isMobile ? 10 : 0,
        maxWidth: 960, alignSelf: 'center', width: '100%',
      }}>
        {/* Safepay logo as first item */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: isMobile ? 0 : 20 }}>
          <Icon name="lock-closed" size={14} color={ORANGE} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Secured by</Text>
          <Image source={SAFEPAY_LOGO_WHITE} style={{ width: 90, height: 27 }} resizeMode="contain" />
        </View>
        {!isMobile && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>|</Text>}
        {items.map((item, i) => (
          <React.Fragment key={item.text}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: isMobile ? 0 : 20 }}>
              <Icon name={item.icon} size={14} color={ORANGE} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
                {item.text}
              </Text>
            </View>
            {!isMobile && i < items.length - 1 && (
              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>|</Text>
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

// ─── 10. FAQ ──────────────────────────────────────────────────────────────────
const FAQItem = ({ faq, isOpen, onPress, theme, isDark, isMobile }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      Animated.timing(anim, { toValue: 1, duration: 210, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true })
        .start(() => setVisible(false));
    }
  }, [isOpen, anim]);

  return (
    <TouchableOpacity
      style={[styles.faqItem, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
        borderColor: isOpen ? ORANGE : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)'),
        marginBottom: 10,
      }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: theme.colors.textPrimary }, isMobile && { fontSize: 14 }]}>
          {faq.q}
        </Text>
        <View style={[styles.faqChevron, {
          backgroundColor: isOpen ? ORANGE + '18' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
        }]}>
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={15}
            color={isOpen ? ORANGE : theme.colors.textSecondary} />
        </View>
      </View>
      {visible && (
        <Animated.View style={{
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }}>
          <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }, isMobile && { fontSize: 13 }]}>
            {faq.a}
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
};

const FAQSection = ({ theme, isDark, isMobile, onLayout }) => {
  const [openIndex, setOpenIndex] = useState(null);
  const faqs = [
    { q: 'Is SkillSphere free to use?', a: 'Yes! You can sign up for free and access a selection of free courses. Premium courses may have fees set by the instructor.' },
    { q: 'How do I get a certificate?', a: "After completing all topics and passing the final quiz with 70%+, you'll automatically receive a personalized certificate to download as a PDF." },
    { q: 'Can I learn on mobile devices?', a: 'Absolutely. SkillSphere works seamlessly on web, Android, and iOS. Your progress is synced across all platforms.' },
    { q: 'What is the AI Assistant feature?', a: 'Our AI Assistant is powered by an advanced language model inside each course. Ask questions about lesson content, get explanations, or request practice exercises.' },
    { q: 'How do instructors apply to teach?', a: 'Experts can register an account and apply to become an instructor. After instructor approval, you can create and publish courses.' },
    { q: 'Is my payment information secure?', a: "Absolutely. All payments are processed by Safepay — an SBP-regulated, PCI-DSS compliant Payment Service Provider. You enter your card details directly on Safepay's secure checkout window. SkillSphere never sees, stores, or processes your card number, bank login, or wallet PIN. Transactions are protected by HTTPS encryption and cryptographic tokenisation." },
  ];

  const left  = faqs.slice(0, 3);
  const right = faqs.slice(3);

  const renderItem = (faq, i, globalIdx) => (
    <AnimatedReveal key={globalIdx} delay={globalIdx * 55} fromY={16}>
      <FAQItem
        faq={faq}
        isOpen={openIndex === globalIdx}
        onPress={() => setOpenIndex(openIndex === globalIdx ? null : globalIdx)}
        theme={theme} isDark={isDark} isMobile={isMobile}
      />
    </AnimatedReveal>
  );

  return (
    <View style={[styles.section, { backgroundColor: isDark ? NAVY : '#F8F9FF', paddingVertical: isMobile ? 48 : 72 }]} onLayout={onLayout}>
      <SectionTitle tag="FAQ" title="Frequently Asked Questions"
        subtitle="Have questions? We've got answers." theme={theme} isMobile={isMobile} />

      {isMobile ? (
        <View style={{ width: '100%' }}>
          {faqs.map((faq, i) => renderItem(faq, i, i))}
        </View>
      ) : (
        /* Desktop: 2-column side by side */
        <View style={{ flexDirection: 'row', gap: 16, maxWidth: 1000, width: '100%', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {left.map((faq, i) => renderItem(faq, i, i))}
          </View>
          <View style={{ flex: 1 }}>
            {right.map((faq, i) => renderItem(faq, i, i + 3))}
          </View>
        </View>
      )}
    </View>
  );
};

// ─── 11. CTA BANNER (BOLD TYPOGRAPHIC) ────────────────────────────────────────
const CTABanner = ({ navigation, isMobile }) => {
  const isWeb = Platform.OS === 'web';

  const Inner = () => (
    <>
      <PulsingBlob style={[styles.ctaBlobLeft,  { backgroundColor: ORANGE + '22' }]} duration={3800} />
      <PulsingBlob style={[styles.ctaBlobRight, { backgroundColor: ORANGE + '12' }]} duration={4400} delay={1200} />

      {/* Watermark word */}
      {isWeb ? (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]} pointerEvents="none">
          <Text style={{ fontSize: isMobile ? 110 : 200, fontWeight: '900', color: 'rgba(255,255,255,0.025)', fontFamily: 'Fredoka', lineHeight: isMobile ? 110 : 200, userSelect: 'none' }}>
            EMPOWER.
          </Text>
        </View>
      ) : (
        <Text style={{ position: 'absolute', fontSize: 100, fontWeight: '900', color: 'rgba(255,255,255,0.025)', fontFamily: 'Fredoka-Bold', alignSelf: 'center', top: '15%' }} pointerEvents="none">
          LEARN.
        </Text>
      )}

      {/* Orange accent line */}
      <AnimatedReveal fromY={16}>
        <View style={{ width: 48, height: 4, backgroundColor: ORANGE, borderRadius: 2, marginBottom: 20, alignSelf: 'center' }} />
      </AnimatedReveal>

      <AnimatedReveal fromY={24}>
        <Text style={[styles.ctaTitle, isMobile && { fontSize: 26, lineHeight: 34 }]}>
          Ready to Start Learning?
        </Text>
      </AnimatedReveal>
      <AnimatedReveal delay={80} fromY={22}>
        <Text style={[styles.ctaSub, isMobile && { fontSize: 14 }]}>
          Join over 10,000 students already building their future on SkillSphere
        </Text>
      </AnimatedReveal>
      <AnimatedReveal delay={130} fromY={16}>
        <Text style={styles.ctaTrustLine}>No credit card required · Start free today</Text>
      </AnimatedReveal>
      <AnimatedReveal delay={200} fromY={22}>
        <View style={[styles.ctaButtons, isMobile && { flexDirection: 'column', width: '100%', paddingHorizontal: 24, gap: 10 }]}>
          <TouchableOpacity
            style={[styles.ctaPrimary, isMobile && { width: '100%', justifyContent: 'center' }]}
            onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.ctaPrimaryText}>Create Free Account</Text>
            <Icon name="rocket-outline" size={17} color={NAVY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctaSecondary, isMobile && { width: '100%', justifyContent: 'center' }]}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.ctaSecondaryText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </AnimatedReveal>
    </>
  );

  if (isWeb) {
    return (
      <View style={[styles.ctaBanner, { paddingVertical: isMobile ? 56 : 80 }]}>
        <View style={[StyleSheet.absoluteFill, { background: 'linear-gradient(135deg, #080814 0%, #1A1A2E 45%, #1E0B02 100%)' }]} pointerEvents="none" />
        <Inner />
      </View>
    );
  }

  const LG = require('react-native-linear-gradient').default;
  return (
    <LG colors={['#080814', '#1A1A2E', '#1E0B02']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.ctaBanner, { paddingVertical: isMobile ? 56 : 80 }]}>
      <Inner />
    </LG>
  );
};

// ─── 12. CONTACT FORM ─────────────────────────────────────────────────────────
const ContactForm = ({ theme, isDark, isMobile, onLayout }) => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSending(true);
    try {
      await contactAPI.send(form);
      setSent(true);
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const inputStyle = [styles.contactInput, {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F2FA',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.12)',
    color: theme.colors.textPrimary,
  }];
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(26,26,46,0.35)';

  const infoItems = [
    { icon: 'mail-outline',     label: 'EMAIL US',       value: 'support@skillsphere.com.pk' },
    { icon: 'time-outline',     label: 'RESPONSE TIME',  value: 'Within 24 hours' },
    { icon: 'location-outline', label: 'BASED IN',       value: 'Pakistan' },
  ];

  const FormPanel = () => (
    <>
      {sent ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: ORANGE + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
            <Icon name="checkmark-circle" size={34} color={ORANGE} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8 }}>Message Sent!</Text>
          <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
            Thank you for reaching out. We'll get back to you within 24 hours.
          </Text>
          <TouchableOpacity style={[styles.sendBtn, { marginTop: 18, width: 150 }]} onPress={() => setSent(false)}>
            <Text style={styles.sendBtnText}>Send Another</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={[styles.contactRow, isMobile && { flexDirection: 'column', gap: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: theme.colors.textSecondary }]}>Your Name</Text>
              <TextInput style={inputStyle} placeholder="John Doe"
                placeholderTextColor={placeholderColor} value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: theme.colors.textSecondary }]}>Email Address</Text>
              <TextInput style={inputStyle} placeholder="john@example.com"
                placeholderTextColor={placeholderColor} keyboardType="email-address"
                value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))} />
            </View>
          </View>
          <Text style={[styles.contactLabel, { color: theme.colors.textSecondary }]}>Message</Text>
          <TextInput style={[inputStyle, styles.contactTextarea]}
            placeholder="Tell us how we can help..."
            placeholderTextColor={placeholderColor} multiline numberOfLines={4}
            value={form.message} onChangeText={v => setForm(p => ({ ...p, message: v }))}
            textAlignVertical="top" />
          <TouchableOpacity style={[styles.sendBtn, { opacity: sending ? 0.7 : 1 }]}
            onPress={handleSend} disabled={sending}>
            {sending ? (
              <Text style={styles.sendBtnText}>Sending...</Text>
            ) : (
              <>
                <Text style={styles.sendBtnText}>Send Message</Text>
                <Icon name="send" size={15} color={NAVY} />
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </>
  );

  return (
    <View style={[styles.section, { backgroundColor: isDark ? NAVY2 : '#FFFFFF', paddingVertical: isMobile ? 48 : 72 }]} onLayout={onLayout}>
      <SectionTitle tag="Contact" title="Get In Touch"
        subtitle="Have a question or feedback? We'd love to hear from you."
        theme={theme} isMobile={isMobile} />

      {/* Info icon cards row */}
      <AnimatedReveal fromY={16} style={{ maxWidth: 760, width: '100%', marginBottom: 28 }}>
        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          {infoItems.map(item => (
            <View key={item.label} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F9FF' }, !isMobile && { flex: 1 }]}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: ORANGE + '18', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Icon name={item.icon} size={18} color={ORANGE} />
              </View>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.8, marginBottom: 3, textTransform: 'uppercase' }}>{item.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </AnimatedReveal>

      {/* Form */}
      <AnimatedReveal delay={80} fromY={24} style={[styles.contactCard, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F9FF',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
        width: '100%', maxWidth: 760, padding: isMobile ? 20 : 28,
      }]}>
        <FormPanel />
      </AnimatedReveal>
    </View>
  );
};

// ─── 13. FOOTER ───────────────────────────────────────────────────────────────
const Footer = ({ navigation, theme, isDark, isMobile, scrollToSection }) => {
  const [topCategories, setTopCategories] = useState([]);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);

  useEffect(() => {
    categoryAPI.getAll()
      .then(res => {
        const cats = (res.categories || []).slice(0, 5);
        if (cats.length) setTopCategories(cats);
      })
      .catch(() => {}); // fail silently — footer falls back to hardcoded list
  }, []);

  const handleFooterLink = (link) => {
    switch (link) {
      case 'About Us':         navigation.navigate('About');          break;
      case 'Blog':             navigation.navigate('Blog');           break;
      case 'Learn With Us':    navigation.navigate('Signup');         break;
      case 'Partners':         navigation.navigate('About');          break;
      case 'Help Center':      navigation.navigate('HelpCenter');     break;
      case 'Privacy Policy':    navigation.navigate('PrivacyPolicy');  break;
      case 'Terms of Service':  navigation.navigate('Terms');          break;
      case 'Cookie Policy':     navigation.navigate('PrivacyPolicy');  break;
      case 'Platform Ownership': navigation.navigate('Ownership');      break;
      case 'Refund Policy':      navigation.navigate('RefundPolicy');   break;
      case 'Contact Us':       scrollToSection?.('contact');          break;
      case 'Community':        navigation.navigate('Community');      break;
      default:
        // dynamic category link
        navigation.navigate('ExploreCourses', { category: link });
    }
  };

  const categoryLinks = topCategories.length > 0
    ? topCategories.map(c => c.name)
    : ['Technology', 'Design', 'Business', 'Data Science', 'Marketing'];

  const cols = [
    { title:'Courses',  links: categoryLinks },
    { title:'Company',  links:['About Us','Blog','Learn With Us','Partners'] },
    { title:'Support',  links:['Help Center','Contact Us','Community'], actions:[{ label:'Verify Certificate', route:'CertificateVerify' }] },
    { title:'Legal',    links:['Privacy Policy','Terms of Service','Cookie Policy','Refund Policy','Platform Ownership'] },
  ];
  const socials = [
    { icon:'x-twitter',      label:'X',         url: 'https://x.com/Skill___Sphere' },
    { icon:'logo-linkedin',  label:'LinkedIn',  url: 'https://www.linkedin.com/in/skill-sphere-pk/' },
    { icon:'logo-instagram', label:'Instagram', url: 'https://www.instagram.com/skill._.sphere/' },
    { icon:'logo-youtube',   label:'YouTube',   url: 'https://www.youtube.com/@SkillSphere-learning' },
  ];
  const BrandBlock = () => (
    <View style={{ marginBottom: isMobile ? 24 : 0 }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
        <Image source={LOGO} style={styles.footerLogoImg} resizeMode="contain" />
        <Text style={styles.footerLogoName}>Skill<Text style={{ color:ORANGE }}>Sphere</Text></Text>
      </View>
      <Text style={[styles.footerTagline, { fontSize: isMobile ? 13 : 13 }]}>
        Empowering learners worldwide with expert knowledge, AI assistance, and industry-recognised certifications.
      </Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:9 }}>
        {socials.map(s => (
          <TouchableOpacity key={s.label} style={styles.socialBtn}
            onPress={() => s.url && Linking.openURL(s.url)}
            activeOpacity={s.url ? 0.7 : 1}>
            {s.icon === 'x-twitter'
              ? <Text style={{ fontSize:15, fontWeight:'800', color: s.url ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', lineHeight:17 }}>𝕏</Text>
              : <Icon name={s.icon} size={17} color={s.url ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)'} />
            }
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const ColsBlock = () => (
    <View style={{ flexDirection:'row', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 0 : 24 }}>
      {cols.map(col => (
        <View key={col.title} style={{ width: isMobile ? '50%' : undefined, flex: isMobile ? undefined : 1, marginBottom:24, paddingRight: isMobile ? 8 : 0 }}>
          <Text style={styles.footerColTitle}>{col.title}</Text>
          {col.links.map(link => (
            <TouchableOpacity key={link} style={{ marginBottom:9 }} onPress={() => handleFooterLink(link)}>
              <Text style={[styles.footerLink, { fontSize: isMobile ? 12 : 12 }]}>{link}</Text>
            </TouchableOpacity>
          ))}
          {(col.actions || []).map(action => (
            <TouchableOpacity key={action.label} style={{ marginBottom:9, flexDirection:'row', alignItems:'center', gap:5 }}
              onPress={() => navigation.navigate(action.route)}>
              <Icon name="shield-checkmark-outline" size={12} color={ORANGE} />
              <Text style={[styles.footerLink, { color:ORANGE, fontWeight:'600', fontSize: isMobile ? 12 : 12 }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.footer, { paddingHorizontal: isMobile ? 20 : 32 }]}>
      {isMobile ? (
        <View style={{ flexDirection:'column', marginBottom:28 }}>
          <BrandBlock />
          <ColsBlock />
        </View>
      ) : (
        <View style={styles.footerGrid}>
          <View style={styles.footerBrand}><BrandBlock /></View>
          <View style={styles.footerCols}><ColsBlock /></View>
        </View>
      )}

      {/* Newsletter strip */}
      <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingVertical: 22, marginBottom: 4 }}>
        {newsletterSent ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="checkmark-circle" size={18} color="#10B981" />
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' }}>
              You're subscribed! We'll send weekly updates.
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 12, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                Get weekly course updates & learning tips
              </Text>
              <TextInput
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFFFFF', fontSize: 13, outlineStyle: 'none' }}
                placeholder="Your email address"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="email-address"
                value={newsletterEmail}
                onChangeText={setNewsletterEmail}
              />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: ORANGE, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, alignItems: 'center', flexShrink: 0, alignSelf: isMobile ? 'stretch' : 'flex-end' }}
              onPress={() => {
                if (newsletterEmail.trim()) {
                  contactAPI.send({ name: 'Newsletter', email: newsletterEmail.trim(), message: 'Newsletter signup' })
                    .catch(() => {});
                  setNewsletterSent(true);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Subscribe</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.footerBottom, { borderTopColor:'rgba(255,255,255,0.1)' }, isMobile && { flexDirection:'column', alignItems:'center', gap:10 }]}>
        <Text style={styles.footerCopy}>© {new Date().getFullYear()} SkillSphere. All rights reserved.</Text>
        <View style={{ flexDirection:'row', gap:20 }}>
          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}><Text style={styles.footerBottomLink}>Privacy</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Terms')}><Text style={styles.footerBottomLink}>Terms</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}><Text style={styles.footerBottomLink}>Cookies</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ─── POSTER BACKGROUND ────────────────────────────────────────────────────────
const PosterBackground = ({ isDark }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !svgRef.current) return;
    const p = isDark ? 'rgba(255,140,66,0.14)' : 'rgba(99,102,241,0.30)';
    const h = isDark ? 'rgba(124,111,205,0.20)'  : 'rgba(232,114,12,0.34)';
    svgRef.current.innerHTML = `<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg"
      style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none">
      <path d="M0,200 L180,200 L180,380 L380,380 L380,140 L580,140 L580,320 L780,320 L780,90 L980,90 L980,280 L1180,280 L1180,160 L1440,160"
        fill="none" stroke="${p}" stroke-width="1.5"/>
      <path d="M0,480 L260,480 L260,660 L520,660 L520,480 L820,480 L820,620 L1100,620 L1100,480 L1440,480"
        fill="none" stroke="${p}" stroke-width="1.5"/>
      <path d="M1440,300 L1260,300 L1260,520 L1060,520 L1060,340 L860,340 L860,560 L660,560 L660,380 L440,380 L440,600 L240,600 L240,420 L0,420"
        fill="none" stroke="${p}" stroke-width="1"/>
      <circle cx="180" cy="200" r="3.5" fill="${p}"/>
      <circle cx="180" cy="380" r="3.5" fill="${p}"/>
      <circle cx="380" cy="380" r="3.5" fill="${p}"/>
      <circle cx="380" cy="140" r="3.5" fill="${p}"/>
      <circle cx="580" cy="140" r="3.5" fill="${p}"/>
      <circle cx="780" cy="320" r="3.5" fill="${p}"/>
      <circle cx="980" cy="90"  r="3.5" fill="${p}"/>
      <circle cx="1180" cy="280" r="3.5" fill="${p}"/>
      <circle cx="260" cy="480" r="3.5" fill="${p}"/>
      <circle cx="520" cy="660" r="3.5" fill="${p}"/>
      <circle cx="820" cy="480" r="3.5" fill="${p}"/>
      <circle cx="1100" cy="620" r="3.5" fill="${p}"/>
      <polygon points="120,60 140,46 160,60 160,88 140,102 120,88" fill="none" stroke="${h}" stroke-width="1.5"/>
      <polygon points="1300,200 1320,186 1340,200 1340,228 1320,242 1300,228" fill="none" stroke="${h}" stroke-width="1.5"/>
      <polygon points="700,720 720,706 740,720 740,748 720,762 700,748" fill="none" stroke="${h}" stroke-width="1.5"/>
      <polygon points="420,40 440,26 460,40 460,68 440,82 420,68" fill="none" stroke="${h}" stroke-width="1.5"/>
      <polygon points="980,780 1000,766 1020,780 1020,808 1000,822 980,808" fill="none" stroke="${h}" stroke-width="1.5"/>
    </svg>`;
  }, [isDark]);

  if (Platform.OS !== 'web') return null;

  const darkGrad = [
    'radial-gradient(ellipse 820px 820px at 20% 10%, rgba(28,22,75,0.88), transparent)',
    'radial-gradient(ellipse 750px 750px at 80% 90%, rgba(28,22,75,0.88), transparent)',
    'radial-gradient(ellipse 460px 460px at 50% 50%, rgba(255,140,66,0.13), transparent)',
    'radial-gradient(ellipse 420px 420px at 82% 8%,  rgba(28,22,75,0.70), transparent)',
    'radial-gradient(ellipse 580px 580px at 12% 58%, rgba(124,111,205,0.28), transparent)',
    'radial-gradient(ellipse 520px 520px at 88% 78%, rgba(255,140,66,0.18), transparent)',
  ].join(', ');

  const lightGrad = [
    'radial-gradient(ellipse 820px 820px at 20% 10%, rgba(99,102,241,0.28), transparent)',
    'radial-gradient(ellipse 750px 750px at 80% 90%, rgba(232,114,12,0.20), transparent)',
    'radial-gradient(ellipse 460px 460px at 50% 50%, rgba(99,102,241,0.16), transparent)',
    'radial-gradient(ellipse 420px 420px at 82% 8%,  rgba(232,114,12,0.18), transparent)',
    'radial-gradient(ellipse 580px 580px at 12% 58%, rgba(99,102,241,0.22), transparent)',
    'radial-gradient(ellipse 520px 520px at 88% 78%, rgba(232,114,12,0.18), transparent)',
  ].join(', ');

  const gridImg = isDark
    ? 'linear-gradient(rgba(255,255,255,0.038) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.038) 1px, transparent 1px)'
    : 'linear-gradient(rgba(99,102,241,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.10) 1px, transparent 1px)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { background: isDark ? darkGrad : lightGrad }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundImage: gridImg, backgroundSize: '55px 55px' }]} />
      <View ref={svgRef} style={StyleSheet.absoluteFill} />
    </View>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const LandingScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const isDesktop = width >= 1024;

  const scrollViewRef    = useRef(null);
  const sectionOffsets   = useRef({});
  const [activeSection, setActiveSection] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const backToTopAnim    = useRef(new Animated.Value(0)).current;


  const registerSection = useCallback((id) => (event) => {
    sectionOffsets.current[id] = event.nativeEvent.layout.y;
  }, []);

  // On web: IntersectionObserver tracks which section is visible while scrolling
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const ids = ['features', 'how', 'courses', 'faq', 'contact'];
    const observers = [];
    const timer = setTimeout(() => {
      ids.forEach(id => {
        const el = document.getElementById('landing-' + id);
        if (!el) return;
        const obs = new IntersectionObserver(
          ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
          { threshold: 0.25 }
        );
        obs.observe(el);
        observers.push(obs);
      });
    }, 400);
    return () => { clearTimeout(timer); observers.forEach(o => o.disconnect()); };
  }, []);

  // ── SEO meta tags (web only) ──────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const setMeta = (name, content, property = false) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    document.title = 'SkillSphere: Learn Smarter with AI-Powered Courses';

    setMeta('description', 'SkillSphere is an AI-powered Learning Management System offering expert-taught courses, certifications, and personalised learning paths for students worldwide.');
    setMeta('keywords', 'online learning, AI courses, LMS, certifications, SkillSphere, e-learning Pakistan, programming courses, skill development');
    setMeta('robots', 'index, follow');

    // Open Graph (Facebook, WhatsApp previews)
    setMeta('og:type',        'website',                                          true);
    setMeta('og:url',         'https://skillsphere.com.pk/',                      true);
    setMeta('og:title',       'SkillSphere: Learn Smarter with AI-Powered Courses', true);
    setMeta('og:description', 'Expert-taught courses, AI tutoring, and industry-recognised certifications. Start learning today.', true);
    setMeta('og:image',       'https://skillsphere.com.pk/og-image.png',          true);
    setMeta('og:site_name',   'SkillSphere',                                      true);

    // Twitter card
    setMeta('twitter:card',        'summary_large_image');
    setMeta('twitter:title',       'SkillSphere: Learn Smarter with AI-Powered Courses');
    setMeta('twitter:description', 'Expert-taught courses, AI tutoring, and industry-recognised certifications.');
    setMeta('twitter:image',       'https://skillsphere.com.pk/og-image.png');

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', 'https://skillsphere.com.pk/');

    // JSON-LD Structured Data
    const existingLd = document.querySelector('script[data-ld="skillsphere"]');
    if (!existingLd) {
      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.setAttribute('data-ld', 'skillsphere');
      ld.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: 'SkillSphere',
        url: 'https://skillsphere.com.pk',
        logo: 'https://skillsphere.com.pk/og-image.png',
        description: 'AI-powered online learning platform offering expert-taught courses, certifications, and personalised learning paths.',
        address: { '@type': 'PostalAddress', addressCountry: 'PK' },
        sameAs: [
          'https://www.linkedin.com/in/skill-sphere-pk/',
          'https://www.instagram.com/skill._.sphere/',
          'https://www.youtube.com/@SkillSphere-learning',
        ],
        offers: {
          '@type': 'Offer',
          category: 'Online Course',
          priceCurrency: 'PKR',
          availability: 'https://schema.org/InStock',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          reviewCount: '2000',
          bestRating: '5',
        },
      });
      document.head.appendChild(ld);
    }
  }, []);

  const scrollToSection = useCallback((id) => {
    setActiveSection(id); // immediate highlight on click
    if (Platform.OS === 'web') {
      const el = document.getElementById('landing-' + id);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    const offset = sectionOffsets.current[id];
    if (offset !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: offset, animated: true });
    }
  }, []);

  // Back-to-top visibility helper
  const updateBackToTop = useCallback((scrollY) => {
    const shouldShow = scrollY > 600;
    if (shouldShow !== showBackToTop) {
      setShowBackToTop(shouldShow);
      Animated.timing(backToTopAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [showBackToTop, backToTopAnim]);

  // Web: track window scroll for back-to-top
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onScroll = () => updateBackToTop(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [updateBackToTop]);

  // Native scroll tracking
  const handleScroll = useCallback((event) => {
    if (Platform.OS === 'web') return;
    const scrollY = event.nativeEvent.contentOffset.y;
    updateBackToTop(scrollY);
    const offsets = sectionOffsets.current;
    let active = null;
    for (const id of ['features','how','courses','faq','contact']) {
      if (offsets[id] !== undefined && scrollY >= offsets[id] - 100) active = id;
    }
    setActiveSection(active);
  }, [updateBackToTop]);

  return (
    <View style={{ flex:1, backgroundColor: isDark ? '#060614' : '#ECEFFE' }}>
      <PosterBackground isDark={isDark} />
      <Helmet>
        <title>SkillSphere - Online Courses &amp; AI Learning Platform Pakistan</title>
        <meta name="description" content="Pakistan's #1 AI-powered online learning platform. Enroll in expert-led courses, learn with AI tutors, earn verified certificates, and master in-demand skills." />
        <link rel="canonical" href="https://skillsphere.com.pk/" />
        <meta property="og:url" content="https://skillsphere.com.pk/" />
        <meta property="og:title" content="SkillSphere - Online Courses & AI Learning Platform Pakistan" />
      </Helmet>
      {/* Hero blobs extended into navbar gap — positioned to match hero section's blob exactly */}
      <PulsingBlob style={{ position:'absolute', width:360, height:360, borderRadius:180, top:-8, left:-100, backgroundColor: ORANGE + (isDark ? '15' : '10') }} duration={4000} />
      <AnnouncementBanner navigation={navigation} />
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <AppHeader
        showBack={false}
        showDateTime={false}
        navItems={NAV_LINKS}
        activeRoute={activeSection}
        onNavigate={(route) => {
          const sectionIds = NAV_LINKS.map(n => n.route);
          if (sectionIds.includes(route)) scrollToSection(route);
          else navigation.navigate(route);
        }}
        leftComponent={isMobile ? (
          <Text style={{ color:'#FFFFFF', fontWeight:'700', fontSize:15, letterSpacing:1 }}>
            SKILL<Text style={{ color: ORANGE }}>SPHERE</Text>
          </Text>
        ) : null}
        rightActions={!isMobile ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:13, paddingVertical:7, borderRadius:10, borderWidth:1.5, borderColor:ORANGE+'60', backgroundColor:ORANGE+'12' }}
              onPress={() => navigation.navigate('CertificateVerify')}
            >
              <Icon name="shield-checkmark-outline" size={14} color={ORANGE} />
              <Text style={{ color:ORANGE, fontSize:13, fontWeight:'600' }}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingHorizontal:16, paddingVertical:8, borderRadius:10, borderWidth:1.5, borderColor:'rgba(255,255,255,0.25)' }}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={{ color:'#FFFFFF', fontSize:13, fontWeight:'600' }}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingHorizontal:16, paddingVertical:8, borderRadius:10, backgroundColor:ORANGE }}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={{ color:'#FFFFFF', fontSize:13, fontWeight:'700' }}>Get Started</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        mobileDropdownFooter={(close) => (
          <>
            <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.1)', marginVertical:4, marginHorizontal:12 }} />
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, marginHorizontal:6, marginVertical:1, borderRadius:12, gap:12 }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('CertificateVerify'), 100); }}
              activeOpacity={0.7}
            >
              <View style={{ width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center', backgroundColor:ORANGE+'18' }}>
                <Icon name="shield-checkmark-outline" size={18} color={ORANGE} />
              </View>
              <Text style={{ flex:1, fontSize:14, fontWeight:'600', color:'rgba(255,255,255,0.85)' }}>Verify Certificate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, marginHorizontal:6, marginVertical:1, borderRadius:12, gap:12 }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('Login'), 100); }}
              activeOpacity={0.7}
            >
              <View style={{ width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(255,255,255,0.08)' }}>
                <Icon name="log-in-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={{ flex:1, fontSize:14, fontWeight:'600', color:'rgba(255,255,255,0.85)' }}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, marginHorizontal:6, marginVertical:1, borderRadius:12, gap:12, backgroundColor:ORANGE+'22' }}
              onPress={() => { close(); setTimeout(() => navigation.navigate('Signup'), 100); }}
              activeOpacity={0.7}
            >
              <View style={{ width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center', backgroundColor:ORANGE+'30' }}>
                <Icon name="rocket-outline" size={18} color={ORANGE} />
              </View>
              <Text style={{ flex:1, fontSize:14, fontWeight:'700', color:ORANGE }}>Get Started</Text>
            </TouchableOpacity>
          </>
        )}
      />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex:1 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <HeroSection navigation={navigation} theme={theme} isDark={isDark} isMobile={isMobile} scrollToSection={scrollToSection} />
        <View nativeID="landing-features" onLayout={registerSection('features')}>
          <FeaturesSection   theme={theme} isDark={isDark} isMobile={isMobile} />
        </View>
        <View nativeID="landing-how" onLayout={registerSection('how')}>
          <HowItWorksSection theme={theme} isDark={isDark} isMobile={isMobile} />
        </View>
        <AIShowcaseSection navigation={navigation} theme={theme} isDark={isDark} isMobile={isMobile} />
        <View nativeID="landing-courses" onLayout={registerSection('courses')}>
          <ExploreSection navigation={navigation} theme={theme} isDark={isDark} isMobile={isMobile} />
        </View>
        <InstructorSpotlightSection navigation={navigation} theme={theme} isDark={isDark} isMobile={isMobile} />
        <TestimonialsSection theme={theme} isDark={isDark} isMobile={isMobile} />
        <StatisticsSection isDark={isDark} isMobile={isMobile} />
        <PaymentTrustStrip isDark={isDark} isMobile={isMobile} />
        <View nativeID="landing-faq" onLayout={registerSection('faq')}>
          <FAQSection        theme={theme} isDark={isDark} isMobile={isMobile} />
        </View>
        <CTABanner         navigation={navigation} isMobile={isMobile} />
        <View nativeID="landing-contact" onLayout={registerSection('contact')}>
          <ContactForm       theme={theme} isDark={isDark} isMobile={isMobile} />
        </View>
        <Footer            navigation={navigation} theme={theme} isDark={isDark} isMobile={isMobile} scrollToSection={scrollToSection} />
      </ScrollView>

      {/* Back-to-top button */}
      <Animated.View style={[styles.backToTop, {
        opacity: backToTopAnim,
        transform: [{ scale: backToTopAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        pointerEvents: showBackToTop ? 'auto' : 'none',
      }]}>
        <TouchableOpacity
          style={[styles.backToTopBtn, { backgroundColor: ORANGE, shadowColor: ORANGE }]}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }
          }}
          activeOpacity={0.85}
        >
          <Icon name="chevron-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Hero
  hero: { paddingTop: 32, paddingBottom: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'flex-start' },
  heroBlobLeft:  { position:'absolute', width:360, height:360, borderRadius:180, top:-80, left:-100 },
  heroBlobRight: { position:'absolute', width:300, height:300, borderRadius:150, bottom:-80, right:-60 },
  heroBadge: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'transparent', borderRadius:20, paddingHorizontal:14, paddingVertical:7, marginBottom:24, borderWidth:1 },
  heroBadgeLive: { width:8, height:8, borderRadius:4, overflow:'visible', justifyContent:'center', alignItems:'center' },
  heroBadgeDot: { width:8, height:8, borderRadius:4 },
  heroBadgeText: { color:ORANGE, fontSize:11, fontWeight:'600', letterSpacing:1.2, textTransform:'uppercase' },
  heroHeadline: { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontSize:48, fontWeight:'900', textAlign:'center', lineHeight:58, marginBottom:18, letterSpacing:-1 },
  heroSub: { fontSize:17, textAlign:'center', lineHeight:29, maxWidth:560, marginBottom:28 },
  heroSearchContainer: { width:'100%', maxWidth:540, marginBottom:28, zIndex:100 },
  heroSearchWrap: { flexDirection:'row', alignItems:'center', gap:10, borderRadius:50, borderWidth:1.5, paddingHorizontal:18, paddingVertical:10, width:'100%', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:4 },
  heroSearchInput: { flex:1, fontSize:15, outlineStyle:'none' },
  heroSearchBtn: { paddingHorizontal:18, paddingVertical:8, borderRadius:9999 },
  heroSearchBtnText: { color:'#fff', fontWeight:'700', fontSize:14 },
  heroDropdown: { borderLeftWidth:1.5, borderRightWidth:1.5, borderBottomWidth:1.5, borderBottomLeftRadius:18, borderBottomRightRadius:18, overflow:'hidden', shadowOffset:{width:0,height:8}, shadowOpacity:0.12, shadowRadius:16, elevation:8 },
  heroDropdownSection: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:16, paddingTop:12, paddingBottom:4 },
  heroDropdownHeading: { fontSize:11, fontWeight:'800', letterSpacing:1, textTransform:'uppercase' },
  heroDropdownItem: { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:16, paddingVertical:11, borderBottomWidth:1 },
  heroDropdownItemText: { fontSize:14, fontWeight:'500' },
  heroDropdownItemMeta: { fontSize:11, marginTop:1 },
  heroDropdownSeeAll: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:12, borderTopWidth:1 },
  heroDropdownSeeAllText: { fontSize:13, fontWeight:'700' },
  heroCTAs: { flexDirection:'row', gap:12, marginBottom:28, alignItems:'center', width:'100%', justifyContent:'center' },
  heroCtaPrimary: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:ORANGE, paddingHorizontal:28, paddingVertical:15, borderRadius:9999, borderWidth:1.5, borderColor:'#E07830', shadowColor:'#C96A24', shadowOffset:{width:0,height:6}, shadowOpacity:0.35, shadowRadius:14, elevation:6 },
  heroCtaPrimaryText: { color:'#FFFFFF', fontSize:15, fontWeight:'800', letterSpacing:0.3 },
  heroCtaSecondary: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:15, borderRadius:9999, borderWidth:1.5 },
  heroCtaSecondaryText: { fontSize:15, fontWeight:'700' },
  // Stats – clean inline row, no card
  heroStatsRow: { flexDirection:'row', alignItems:'center', marginTop:8 },
  heroStatsRowMobile: { width:'100%', justifyContent:'center' },
  statsRowItem: { alignItems:'center', paddingHorizontal:20 },
  statsRowItemMobile: { paddingHorizontal:14 },
  statsRowDivider: { width:1, height:28 },
  statValue: { fontSize:20, fontWeight:'800', marginBottom:2 },
  statLabel: { fontSize:11, fontWeight:'500', letterSpacing:0.2 },

  // Sections
  section: { paddingVertical:72, paddingHorizontal:20, alignItems:'center' },

  // Features
  featuresGrid: { flexDirection:'row', flexWrap:'wrap', gap:16, justifyContent:'center', maxWidth:1100, width:'100%' },
  featureCard: { borderRadius:16, padding:24, borderWidth:1, alignItems:'flex-start', minWidth:220 },
  featureIconBox: { width:48, height:48, borderRadius:13, justifyContent:'center', alignItems:'center', marginBottom:14 },
  featureTitle: { fontSize:16, fontWeight:'700', marginBottom:7 },
  featureDesc: { fontSize:13, lineHeight:21 },

  // How It Works
  stepsRow: { flexDirection:'row', alignItems:'stretch', gap:0, maxWidth:960, width:'100%' },
  stepCard: { borderRadius:18, padding:28, borderWidth:1, alignItems:'center', position:'relative' },
  stepNumBadge: { position:'absolute', top:14, right:14, backgroundColor:ORANGE+'15', borderRadius:7, paddingHorizontal:7, paddingVertical:2 },
  stepNum: { color:ORANGE, fontSize:11, fontWeight:'800', letterSpacing:0.5 },
  stepIconCircle: { width:64, height:64, borderRadius:32, justifyContent:'center', alignItems:'center', marginBottom:16, marginTop:6 },
  stepTitle: { fontSize:17, fontWeight:'700', marginBottom:9, textAlign:'center' },
  stepDesc: { fontSize:13, lineHeight:21, textAlign:'center' },
  stepArrow: { alignSelf:'center', paddingHorizontal:6, paddingTop:10 },

  // Courses
  courseCard: { borderRadius:14, borderWidth:1, overflow:'hidden' },
  courseThumb: { width:'100%', height:120, justifyContent:'center', alignItems:'center' },
  courseCatBadge: { alignSelf:'flex-start', marginHorizontal:12, marginTop:10, paddingHorizontal:9, paddingVertical:3, borderRadius:7 },
  courseCatText: { fontSize:10, fontWeight:'700', letterSpacing:0.4 },
  courseInfo: { padding:12, paddingTop:7 },
  courseTitle: { fontSize:13, fontWeight:'700', lineHeight:19, marginTop:4 },
  courseInstructor: { fontSize:11 },
  courseFooter: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:10 },
  courseEnroll: { fontSize:11 },
  enrollBtn: { backgroundColor:ORANGE, paddingHorizontal:14, paddingVertical:6, borderRadius:9999, borderWidth:1, borderColor:'#E77828' },
  enrollBtnText: { color:'#FFFFFF', fontSize:11, fontWeight:'700', letterSpacing:0.4 },

  // Statistics
  statsSection: { paddingHorizontal:20, alignItems:'center', backgroundColor:NAVY },
  statsGrid: { flexDirection:'row', justifyContent:'center', maxWidth:860, width:'100%' },
  statBlock: { flex:1, alignItems:'center', paddingVertical:16, paddingHorizontal:12 },
  statIconCircle: { width:52, height:52, borderRadius:26, justifyContent:'center', alignItems:'center', marginBottom:12 },
  statBigValue: { fontSize:30, fontWeight:'900', color:'#FFFFFF', marginBottom:4, letterSpacing:-0.5 },
  statBigLabel: { fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:'500', textAlign:'center' },

  // FAQ
  faqItem: { borderRadius:13, borderWidth:1, padding:16, overflow:'hidden' },
  faqHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:10 },
  faqQuestion: { flex:1, fontSize:14, fontWeight:'600', lineHeight:21 },
  faqChevron: { width:28, height:28, borderRadius:7, justifyContent:'center', alignItems:'center' },
  faqAnswer: { fontSize:13, lineHeight:22, marginTop:10 },

  // Testimonials
  testimonialsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', maxWidth: 1100, width: '100%' },
  testimonialCard: { borderRadius: 16, padding: 22, borderWidth: 1 },
  testimonialQuote: { fontSize: 14, lineHeight: 23, fontStyle: 'italic', marginBottom: 18, flex: 1 },
  testimonialAuthor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  testimonialAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  testimonialAvatarText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  testimonialName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  testimonialRole: { fontSize: 11, fontWeight: '500' },

  // CTA Banner
  ctaBanner: { paddingHorizontal:24, alignItems:'center', overflow:'hidden', backgroundColor:NAVY },
  ctaBlobLeft:  { position:'absolute', width:260, height:260, borderRadius:130, top:-70, left:-50 },
  ctaBlobRight: { position:'absolute', width:220, height:220, borderRadius:110, bottom:-50, right:-30 },
  ctaTitle: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 14, letterSpacing: -1, fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', lineHeight: 50 },
  ctaSub: { fontSize:15, color:'rgba(255,255,255,0.7)', textAlign:'center', marginBottom:32 },
  ctaButtons: { flexDirection:'row', gap:12, alignItems:'center' },
  ctaPrimary: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:ORANGE, paddingHorizontal:28, paddingVertical:14, borderRadius:9999, borderWidth:1, borderColor:'#E77828', shadowColor:'#C96A24', shadowOffset:{width:0,height:3}, shadowOpacity:0.16, shadowRadius:6, elevation:3 },
  ctaPrimaryText: { color:NAVY, fontSize:15, fontWeight:'800', letterSpacing:0.1 },
  ctaSecondary: { alignItems:'center', justifyContent:'center', paddingHorizontal:26, paddingVertical:13, borderRadius:9999, borderWidth:1.5, borderColor:'rgba(255,255,255,0.35)' },
  ctaSecondaryText: { color:'#FFFFFF', fontSize:15, fontWeight:'600' },
  ctaTrustLine: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginBottom: 20, letterSpacing: 0.2 },

  // Contact
  contactCard: { borderRadius:18, borderWidth:1, alignSelf:'center' },
  contactSplit: { flexDirection: 'row', borderRadius: 18, borderWidth: 1, overflow: 'hidden', width: '100%', maxWidth: 760, alignSelf: 'center' },
  contactInfoPanel: { width: 260, padding: 28, justifyContent: 'flex-start' },
  contactFormPanel: { flex: 1, padding: 28 },
  contactRow: { flexDirection:'row', gap:14, marginBottom:2 },
  contactLabel: { fontSize:12, fontWeight:'600', marginBottom:6, marginTop:10, letterSpacing:0.2 },
  contactInput: { borderRadius:11, borderWidth:1.5, paddingHorizontal:13, paddingVertical:11, fontSize:13, marginBottom:2 },
  contactTextarea: { minHeight:110, paddingTop:11, marginBottom:16 },
  sendBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:ORANGE, paddingVertical:13, borderRadius:11, borderWidth:1, borderColor:'#E77828', shadowColor:'#C96A24', shadowOffset:{width:0,height:3}, shadowOpacity:0.14, shadowRadius:6, elevation:3 },
  sendBtnText: { color:NAVY, fontSize:14, fontWeight:'800', letterSpacing:0.1 },

  // Back to top
  backToTop: { position: 'absolute', bottom: Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? 60 : 28, right: 24, zIndex: 999 },
  backToTopBtn: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },

  // Footer
  footer: { paddingTop:48, backgroundColor:NAVY },
  footerGrid: { flexDirection:'row', gap:36, marginBottom:36 },
  footerBrand: { flex:1.4, minWidth:200 },
  footerLogoImg: { width:36, height:36, borderRadius:8 },
  footerLogoName: { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', color:'#FFFFFF', fontWeight:'700', fontSize:19, letterSpacing:0.5 },
  footerTagline: { color:'rgba(255,255,255,0.6)', fontSize:13, lineHeight:21, marginBottom:18 },
  footerSocials: { flexDirection:'row', gap:9 },
  socialBtn: { width:36, height:36, borderRadius:9, backgroundColor:'rgba(255,255,255,0.08)', justifyContent:'center', alignItems:'center' },
  footerCols: { flex:3 },
  footerCol: { flex:1, minWidth:90 },
  footerColTitle: { color:'#FFFFFF', fontSize:13, fontWeight:'700', marginBottom:14, letterSpacing:0.3 },
  footerLink: { color:'rgba(255,255,255,0.55)', fontSize:12, lineHeight:17 },
  footerBottom: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:18, borderTopWidth:1, flexWrap:'wrap', gap:10 },
  footerCopy: { color:'rgba(255,255,255,0.4)', fontSize:12 },
  footerBottomLink: { color:'rgba(255,255,255,0.45)', fontSize:12 },
});

export default LandingScreen;
