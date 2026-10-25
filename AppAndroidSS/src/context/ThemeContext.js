
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, { useSharedValue, withTiming, runOnJS, Easing, useAnimatedStyle } from 'react-native-reanimated';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// SkillSphere Modern Learning Platform Theme
// Based on Comprehensive UI Design Guide
// Clean, Modern, Accessible, Professional

// Heading font — Fredoka (rounded display) used for all h1/h2/title-level text
export const HEADING_FONT = Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold';

// Typography configuration - System fonts for best readability
// iOS: San Francisco, Android: Roboto, Web: system-ui
const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
    heading: HEADING_FONT,
  },
  weights: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
  },
  sizes: {
    caption: 13,      // Caption: 13px (+3)
    xs: 15,           // Extra Small: 15px (+3)
    sm: 17,           // Small: 17px (+3)
    base: 15,         // Base: 15px (+3)
    lg: 21,           // Large: 21px (+3)
    xl: 23,           // Extra Large: 23px (+3)
    '2xl': 27,        // 2XL: 27px (+3)
    '3xl': 33,        // 3XL: 33px (+3)
    '4xl': 39,        // 4XL: 39px (+3)
    '5xl': 51,        // 5XL: 51px (+3)
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,      // Line Height: 1.5x as per guide
    relaxed: 1.75,
  },
};

// Spacing System - 4px based as per guide
const spacing = {
  micro: 4,   // 4px - Micro spacing (icon gaps)
  xs: 8,      // 8px - Small spacing (labels, inline elements)
  sm: 12,     // 12px - Compact padding
  md: 16,     // 16px - Default padding (cards, sections)
  lg: 24,     // 24px - Section spacing
  xl: 32,     // 32px - Page-level spacing
  '2xl': 48,  // 48px - Major section breaks
  '3xl': 64,
};

// Border Radius as per guide
const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,      // Forms & Inputs: 12px
  xl: 14,      // Toast notifications: 14px
  '2xl': 16,   // Cards: 16px as per guide
  '3xl': 20,
  full: 9999,
};

// Button config — single source of truth for all button styling
const buttonConfig = {
  borderRadius: 9999,   // pill shape
  letterSpacing: 0.5,
  fontWeight: '700',
  sizes: {
    sm: { height: 34, paddingHorizontal: 16, fontSize: 12 },
    md: { height: 44, paddingHorizontal: 22, fontSize: 14 },
    lg: { height: 52, paddingHorizontal: 28, fontSize: 16 },
  },
};

// Light Theme - EduView Orange / Navy palette
const lightTheme = {
  mode: 'light',
  colors: {
    // Primary Palette — warm orange
    primary: '#FF8C42',
    primaryDark: '#E87532',
    primaryLight: '#F5A53A',
    primaryMuted: '#FFB380',

    // Secondary Colors — purple
    secondary: '#7C6FCD',
    secondaryDark: '#6455B0',
    secondaryLight: '#9B8DE0',
    secondaryMuted: '#BDB0F0',

    // Accent Colors — yellow
    accent: '#F5C842',
    accentHover: '#E0B530',

    // Gradient Colors
    gradientStart: '#FF8C42',
    gradientMid: '#F5A53A',
    gradientEnd: '#F5C842',

    // Hero/Navbar Gradient — navy
    heroGradientStart: '#1A1A2E',
    heroGradientMid: '#1E1E38',
    heroGradientEnd: '#252540',

    // Button Gradients
    buttonGradientStart: '#FF8C42',
    buttonGradientEnd: '#F5A53A',

    // Background Colors (Section 5.2 - Light Theme)
    background: '#F9FAFB',        // Background: #F9FAFB
    backgroundSecondary: '#F3F4F6',
    backgroundTertiary: '#E5E7EB',
    surface: '#FFFFFF',           // Surface/Card: #FFFFFF

    // Card Colors
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    cardBackground: '#FFFFFF',
    cardGlass: 'rgba(255, 255, 255, 0.65)',  // Glass Effect (Section 27.2)
    cardBorder: '#E5E7EB',        // Border: #E5E7EB
    cardBorderHover: '#4F46E5',

    // Text Colors (Section 5.2)
    text: '#111827',              // Text Primary: #111827
    textPrimary: '#111827',
    textSecondary: '#6B7280',     // Text Secondary: #6B7280
    textTertiary: '#9CA3AF',
    textMuted: '#D1D5DB',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',

    // Border Colors
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderFocus: '#FF8C42',
    divider: '#E5E7EB',

    // Interactive States
    link: '#FF8C42',
    linkHover: '#E87532',
    placeholder: '#9CA3AF',
    disabled: '#D1D5DB',
    disabledText: '#9CA3AF',

    // Status Colors (consistent with guide)
    success: '#10B981',
    successLight: '#D1FAE5',
    successDark: '#059669',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    errorDark: '#DC2626',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    warningDark: '#D97706',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    infoDark: '#2563EB',

    // Shadow Colors (Section 7.2)
    shadow: 'rgba(0,0,0,0.08)',   // Light: 0 8px 24px rgba(0,0,0,0.08)
    shadowMedium: 'rgba(0,0,0,0.12)',
    shadowStrong: 'rgba(0,0,0,0.18)',
    shadowPrimary: 'rgba(255, 140, 66, 0.25)',

    // Overlay
    overlay: 'rgba(17, 24, 39, 0.5)',
    overlayLight: 'rgba(17, 24, 39, 0.3)',

    // Glow Effects
    primaryGlow: 'rgba(255, 140, 66, 0.2)',
    secondaryGlow: 'rgba(124, 111, 205, 0.2)',
    successGlow: 'rgba(16, 185, 129, 0.15)',
    errorGlow: 'rgba(239, 68, 68, 0.15)',

    // Input Colors
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E7EB',
    inputBorderFocus: '#FF8C42',
    inputText: '#111827',
    inputPlaceholder: '#9CA3AF',

    // Navbar specific
    navbarBackground: 'linear-gradient(135deg, #1A1A2E 0%, #252540 100%)',
    navbarText: '#FFFFFF',
    navbarTextHover: 'rgba(255, 255, 255, 0.8)',

    // Sidebar / surface extras
    sidebarGradientTop: '#1A1A2E',
    sidebarGradientBottom: '#252540',

    // Tab Bar
    tabBarBackground: '#FFFFFF',
    tabBarActiveTint: '#FF8C42',
    tabBarInactiveTint: '#9CA3AF',
    tabBarBorder: '#E5E7EB',
  },

  // Glassmorphism config
  glass: {
    background: 'rgba(255, 255, 255, 0.65)',
    backdropBlur: 12,
    border: 'rgba(255, 255, 255, 0.3)',
    borderHover: 'rgba(255, 140, 66, 0.3)',
  },

  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 30,
      elevation: 8,
    },
    glow: {
      shadowColor: '#FF8C42',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  borderRadius,
  spacing,
  typography,
  button: buttonConfig,

  // Animation durations (Section 11)
  animation: {
    fast: 150,     // 150-250ms
    normal: 250,
    slow: 300,     // Smooth animated transition: 300ms
  },

  // Layout (Section 2 & 3)
  layout: {
    headerHeight: 64,        // Web: 64px
    headerHeightMobile: 56,  // Mobile App: 56px
    sidebarWidth: 260,       // Width: 260px
    sidebarTriggerZone: 12,  // Collapsed trigger zone: 12px
    maxContentWidth: 1440,   // Max width: 1440px
    gutter: 24,              // Gutter: 24px
    margin: 32,              // Margin: 32px
  },
};

// Dark Theme — navy + orange palette
const darkTheme = {
  mode: 'dark',
  colors: {
    // Primary Colors — orange consistent across themes
    primary: '#FF8C42',
    primaryDark: '#E87532',
    primaryLight: '#F5A53A',
    primaryMuted: '#C06820',

    // Secondary Colors — purple
    secondary: '#9B8DE0',
    secondaryDark: '#7C6FCD',
    secondaryLight: '#BDB0F0',
    secondaryMuted: '#6455B0',

    // Accent Colors
    accent: '#F5C842',
    accentHover: '#E0B530',

    // Gradient Colors
    gradientStart: '#FF8C42',
    gradientMid: '#F5A53A',
    gradientEnd: '#F5C842',

    // Hero/Navbar Gradient
    heroGradientStart: '#1A1A2E',
    heroGradientMid: '#1E1E38',
    heroGradientEnd: '#252540',

    // Button Gradients
    buttonGradientStart: '#FF8C42',
    buttonGradientEnd: '#F5A53A',

    // Background Colors — navy dark
    background: '#0D0D1E',
    backgroundSecondary: '#1A1A2E',
    backgroundTertiary: '#252540',
    surface: '#1A1A2E',

    // Card Colors
    card: '#1A1A2E',
    cardElevated: '#252540',
    cardBackground: '#1A1A2E',
    cardGlass: 'rgba(26, 26, 46, 0.85)',
    cardBorder: 'rgba(255,255,255,0.08)',
    cardBorderHover: '#FF8C42',

    // Text Colors
    text: '#F8FAFC',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textMuted: '#475569',
    textInverse: '#0D0D1E',
    textOnPrimary: '#FFFFFF',

    // Border Colors
    border: 'rgba(255,255,255,0.1)',
    borderLight: 'rgba(255,255,255,0.06)',
    borderFocus: '#FF8C42',
    divider: 'rgba(255,255,255,0.08)',

    // Interactive States
    link: '#FF8C42',
    linkHover: '#F5A53A',
    placeholder: '#64748B',
    disabled: '#374151',
    disabledText: '#6B7280',

    // Status Colors
    success: '#34D399',
    successLight: 'rgba(52, 211, 153, 0.15)',
    successDark: '#10B981',
    error: '#F87171',
    errorLight: 'rgba(248, 113, 113, 0.15)',
    errorDark: '#EF4444',
    warning: '#FBBF24',
    warningLight: 'rgba(251, 191, 36, 0.15)',
    warningDark: '#F59E0B',
    info: '#60A5FA',
    infoLight: 'rgba(96, 165, 250, 0.15)',
    infoDark: '#3B82F6',

    // Shadow Colors
    shadow: 'rgba(0,0,0,0.5)',
    shadowMedium: 'rgba(0,0,0,0.6)',
    shadowStrong: 'rgba(0,0,0,0.7)',
    shadowPrimary: 'rgba(255, 140, 66, 0.3)',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',

    // Tab Bar
    tabBarBackground: '#1A1A2E',
    tabBarActiveTint: '#FF8C42',
    tabBarInactiveTint: 'rgba(255,255,255,0.4)',
    tabBarBorder: 'rgba(255,255,255,0.08)',

    // Glow Effects
    primaryGlow: 'rgba(255, 140, 66, 0.3)',
    secondaryGlow: 'rgba(155, 141, 224, 0.3)',
    successGlow: 'rgba(52, 211, 153, 0.3)',
    errorGlow: 'rgba(248, 113, 113, 0.3)',

    // Input Colors
    inputBackground: '#252540',
    inputBorder: 'rgba(255,255,255,0.12)',
    inputBorderFocus: '#FF8C42',
    inputText: '#F8FAFC',
    inputPlaceholder: '#64748B',

    // Navbar specific
    navbarBackground: 'linear-gradient(135deg, #1A1A2E 0%, #252540 100%)',
    navbarText: '#FFFFFF',
    navbarTextHover: 'rgba(255, 255, 255, 0.8)',

    // Sidebar
    sidebarGradientTop: '#1A1A2E',
    sidebarGradientBottom: '#252540',
  },

  // Glassmorphism config — dark mode
  glass: {
    background: 'rgba(26, 26, 46, 0.85)',
    backdropBlur: 16,
    border: 'rgba(255, 255, 255, 0.1)',
    borderHover: 'rgba(255, 140, 66, 0.4)',
  },

  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 6,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 30,
      elevation: 8,
    },
    glow: {
      shadowColor: '#FF8C42',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 8,
    },
    glowPurple: {
      shadowColor: '#9B8DE0',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 8,
    },
  },

  borderRadius,
  spacing,
  typography,
  button: buttonConfig,

  // Animation durations
  animation: {
    fast: 150,
    normal: 250,
    slow: 300,
  },

  // Layout
  layout: {
    headerHeight: 64,
    headerHeightMobile: 56,
    sidebarWidth: 260,
    sidebarTriggerZone: 12,
    maxContentWidth: 1440,
    gutter: 24,
    margin: 32,
  },
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  const { width, height } = Dimensions.get('window');
  const isAnimating = useRef(false);

  // Ripple animation — solid fill + neon ring racing ahead of it
  const rippleScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const [ripple, setRipple] = useState(null); // { x, y, radius, color, accent }

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
  }));

  // Ring uses same scale so its edge stays RING_OFFSET px ahead of the fill edge
  const ringAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: ringOpacity.value,
  }));

  useEffect(() => { loadTheme(); }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('themeMode');
      setThemeMode(saved || systemColorScheme || 'light');
    } catch {
      setThemeMode('light');
    } finally {
      setIsLoading(false);
    }
  };

  // Called on JS thread after ripple fully expands
  const applyTheme = (newMode) => {
    setThemeMode(newMode);
    AsyncStorage.setItem('themeMode', newMode).catch(() => {});
    setRipple(null);
    rippleScale.value = 0;
    ringOpacity.value = 0;
    isAnimating.current = false;
  };

  /**
   * Circular ripple reveal:
   *   1. A circle (new theme bg colour) appears at the press position.
   *   2. Expands (scale 0 → 1) to cover the full screen/viewport.
   *   3. Theme switches + ripple removed → new theme visible underneath.
   *
   * On web the ripple uses position:'fixed' so it is always viewport-relative
   * regardless of how far the page is scrolled.
   * originX / originY come from the press event (pageX / pageY) — always
   * viewport coordinates on both native and web.
   */
  const animateThemeSwitch = (newMode, originX, originY) => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    // Use viewport dimensions for the radius calculation (covers visible area)
    const vw = width;
    const vh = height;
    const ox = originX ?? vw / 2;
    const oy = originY ?? vh / 2;

    const newThemeObj = newMode === 'dark' ? darkTheme : lightTheme;

    // Radius reaches the farthest viewport corner from the press point
    const radius = Math.ceil(
      Math.sqrt(
        Math.max(ox, vw - ox) ** 2 +
        Math.max(oy, vh - oy) ** 2,
      ),
    ) + 4;

    rippleScale.value = 0;
    ringOpacity.value = 1;
    setRipple({ x: ox, y: oy, radius, color: newThemeObj.colors.background, accent: '#FF8C42' });

    // Give React one tick to mount the ripple, then animate
    setTimeout(() => {
      // Fill expands, ring fades out — both driven by the same scale clock
      rippleScale.value = withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        'worklet';
        if (finished) runOnJS(applyTheme)(newMode);
      });
      // Ring glows bright then dissolves as it outruns the fill
      ringOpacity.value = withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) });
    }, 16);
  };

  const toggleTheme = (originX, originY) => {
    animateThemeSwitch(themeMode === 'light' ? 'dark' : 'light', originX, originY);
  };

  const setTheme = (mode, originX, originY) => {
    if (mode !== themeMode) animateThemeSwitch(mode, originX, originY);
  };

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const value = {
    theme,
    themeMode,
    toggleTheme,
    setTheme,
    isLoading,
    isDark: themeMode === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      <View style={themeProviderStyles.root}>
        {children}

        {/* Expanding ripple circle — fixed to viewport so scroll position doesn't matter */}
        {ripple && (() => {
          const pos = Platform.OS === 'web' ? 'fixed' : 'absolute';
          // Ring is 50px larger in radius so its border edge leads the fill
          const RING_OFFSET = 50;
          const rr = ripple.radius + RING_OFFSET;
          return (
            <>
              {/* Solid fill — new theme bg colour sweeps across screen */}
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position:        pos,
                    left:            ripple.x - ripple.radius,
                    top:             ripple.y - ripple.radius,
                    width:           ripple.radius * 2,
                    height:          ripple.radius * 2,
                    borderRadius:    ripple.radius,
                    backgroundColor: ripple.color,
                    zIndex:          99998,
                  },
                  rippleStyle,
                ]}
              />
              {/* Neon ring — glowing shockwave racing ahead of the fill */}
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position:        pos,
                    left:            ripple.x - rr,
                    top:             ripple.y - rr,
                    width:           rr * 2,
                    height:          rr * 2,
                    borderRadius:    rr,
                    backgroundColor: 'transparent',
                    borderWidth:     6,
                    borderColor:     ripple.accent,
                    zIndex:          99999,
                    // Glow — web uses boxShadow, native uses shadow* props
                    ...(Platform.OS === 'web'
                      ? { boxShadow: `0 0 18px 8px rgba(255,140,66,0.65), inset 0 0 12px 4px rgba(255,140,66,0.35)` }
                      : {
                          shadowColor:   '#FF8C42',
                          shadowOffset:  { width: 0, height: 0 },
                          shadowOpacity: 0.9,
                          shadowRadius:  18,
                          elevation:     20,
                        }),
                  },
                  ringAnimStyle,
                ]}
              />
            </>
          );
        })()}
      </View>
    </ThemeContext.Provider>
  );
};

const themeProviderStyles = StyleSheet.create({
  root: { flex: 1 },
});

