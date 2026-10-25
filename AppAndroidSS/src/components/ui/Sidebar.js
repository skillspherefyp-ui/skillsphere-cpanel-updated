import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  PanResponder,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';

// Logo import
const LogoImage = require('../../assets/images/skillsphere-logo.png');

// Section 4 - Sidebar (Hidden by Default – Hover Activated)
// Section 22 - Sidebar Navigation Details
// Section 27 - Global Glassmorphism

const SIDEBAR_WIDTH = 260;       // Section 4.2: Width 260px
const TRIGGER_ZONE = 12;         // Section 4.2: Collapsed trigger zone 12px
const ANIMATION_DURATION = 220;  // Section 22.2: Slide-in duration 220ms

const Sidebar = ({
  items = [],
  activeRoute,
  onNavigate,
  userInfo,
  onLogout,
  onSettings,
  visible: controlledVisible,
  onVisibilityChange,
  isPersistent = false, // For large screens where sidebar is always visible
}) => {
  const { theme, isDark } = useTheme();
  const isWeb = Platform.OS === 'web';
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(isPersistent ? 0 : -SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Use controlled visibility if provided
  const sidebarVisible = controlledVisible !== undefined ? controlledVisible : isVisible;

  // Pan responder for swipe gesture (mobile)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return evt.nativeEvent.pageX < TRIGGER_ZONE * 3;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dx > 10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= SIDEBAR_WIDTH) {
          slideAnim.setValue(-SIDEBAR_WIDTH + gestureState.dx);
          overlayOpacity.setValue(gestureState.dx / SIDEBAR_WIDTH * 0.5);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > SIDEBAR_WIDTH / 3) {
          showSidebar();
        } else {
          hideSidebar();
        }
      },
    })
  ).current;

  const showSidebar = () => {
    setIsVisible(true);
    onVisibilityChange?.(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.5,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideSidebar = () => {
    if (isPersistent) return; // Don't hide if persistent

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      onVisibilityChange?.(false);
    });
  };

  useEffect(() => {
    if (isPersistent) {
      slideAnim.setValue(0);
      return;
    }

    if (controlledVisible !== undefined) {
      if (controlledVisible) {
        showSidebar();
      } else {
        hideSidebar();
      }
    }
  }, [controlledVisible, isPersistent]);

  const handleMouseEnter = () => {
    if (isWeb && !isPersistent) showSidebar();
  };

  const handleMouseLeave = () => {
    if (isWeb && !isPersistent) hideSidebar();
  };

  const handleItemPress = (item) => {
    onNavigate?.(item.route);
    if (!isWeb && !isPersistent) hideSidebar();
  };

  const styles = getStyles(theme, isDark, isWeb, isPersistent);

  // Glassmorphism background style
  const getGlassBackground = () => {
    if (isWeb) {
      return {
        backgroundColor: isPersistent ? '#1A1A2E' : 'rgba(15,15,35,0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      };
    }
    return {
      backgroundColor: isPersistent ? '#1A1A2E' : 'rgba(15,15,35,0.9)',
    };
  };

  const SidebarContent = () => (
    <View style={[styles.sidebarInner, getGlassBackground()]}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <View style={styles.logoContainer}>
          <Image
            source={LogoImage}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <Text style={[styles.logoText, { color: '#FFFFFF' }]}>
            SKILL<Text style={{ color: '#FF8C42' }}>SPHERE</Text>
          </Text>
        </View>
      </View>

      {/* Navigation Items */}
      <View style={styles.navSection}>
        {items.map((item, index) => {
          const isActive = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.route || index}
              style={[
                styles.navItem,
                isActive && styles.navItemActive,
              ]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              {isActive && <View style={styles.activeIndicator} />}
              {item.iconLib === 'mci'
                ? <MCIcon name={isActive ? item.iconActive || item.icon : item.icon} size={24} color={isActive ? '#1A1A2E' : 'rgba(255,255,255,0.6)'} style={styles.navIcon} />
                : <Icon name={isActive ? item.iconActive || item.icon : item.icon} size={24} color={isActive ? '#1A1A2E' : 'rgba(255,255,255,0.6)'} style={styles.navIcon} />
              }
              <Text style={[
                styles.navLabel,
                isActive && styles.navLabelActive,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={onSettings}
          activeOpacity={0.7}
        >
          <Icon
            name="settings-outline"
            size={24}
            color={'rgba(255,255,255,0.6)'}
            style={styles.navIcon}
          />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>

        {userInfo && (
          <View style={styles.userSection}>
            <View style={styles.userInfo}>
              {userInfo.avatar ? (
                <Image source={{ uri: userInfo.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {userInfo.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.userDetails}>
                <Text style={styles.userName} numberOfLines={1}>{userInfo.name}</Text>
                <Text style={styles.userRole} numberOfLines={1}>{userInfo.role}</Text>
              </View>
              <TouchableOpacity
                onPress={onLogout}
                style={styles.logoutButton}
                activeOpacity={0.7}
              >
                <Icon name="log-out-outline" size={20} color={'rgba(255,255,255,0.65)'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  // Persistent sidebar (for large screens)
  if (isPersistent) {
    return (
      <View style={styles.persistentContainer}>
        <SidebarContent />
      </View>
    );
  }

  // Web: render with hover trigger zone
  if (isWeb) {
    return (
      <>
        {/* Hover trigger zone */}
        <View
          style={styles.triggerZone}
          onMouseEnter={handleMouseEnter}
        />

        {/* Sidebar */}
        <Animated.View
          style={[
            styles.sidebar,
            { transform: [{ translateX: slideAnim }] },
          ]}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <SidebarContent />
        </Animated.View>
      </>
    );
  }

  // Mobile: render with pan responder and overlay
  return (
    <View style={styles.mobileContainer} {...panResponder.panHandlers}>
      {/* Trigger zone */}
      <View style={styles.triggerZone} />

      {/* Overlay */}
      {sidebarVisible && (
        <Animated.View
          style={[
            styles.overlay,
            { opacity: overlayOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={hideSidebar}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          styles.mobileSidebar,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <SidebarContent />
      </Animated.View>
    </View>
  );
};

const getStyles = (theme, isDark, isWeb, isPersistent) => StyleSheet.create({
  persistentContainer: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    ...(isWeb && {
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
    }),
  },
  mobileContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  triggerZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: TRIGGER_ZONE,
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 1001,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  mobileSidebar: {
    position: 'absolute',
  },
  sidebarInner: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,140,66,0.2)',
  },
  logoSection: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : isWeb ? 24 : 48,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold',
  },
  navSection: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    position: 'relative',
    gap: 0,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
    backgroundColor: '#FF8C42',
    borderRadius: 2,
  },
  navIcon: {
    marginRight: 16,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    fontFamily: theme.typography.fontFamily.medium,
  },
  navLabelActive: {
    color: '#1A1A2E',
    fontWeight: '700',
  },
  bottomSection: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  userSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  userRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
});

export default Sidebar;
