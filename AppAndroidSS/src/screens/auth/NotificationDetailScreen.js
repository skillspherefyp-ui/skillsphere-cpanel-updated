import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'course': return 'book';
    case 'quiz': return 'help-circle';
    case 'certificate': return 'ribbon';
    default: return 'notifications';
  }
};

const NotificationDetailScreen = () => {
  const { theme, isDark } = useTheme();
  const { markNotificationAsRead } = useData();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const { notification } = route.params;

  // Auto-mark as read when screen opens
  useEffect(() => {
    if (notification && !notification.isRead) {
      markNotificationAsRead(notification.id);
    }
  }, []);

  const role = user?.role;
  const sidebarItems = getSidebarItems(role);

  const handleNavigate = (r) => navigation.navigate(r);

  const isWeb = Platform.OS === 'web';
  const maxWidth = isWeb && width > 1200 ? 1200 : '100%';

  const formattedDate = notification?.createdAt
    ? new Date(notification.createdAt).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : notification?.date || '';

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Dashboard"
      onNavigate={handleNavigate}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { maxWidth, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header banner — matches NotificationsScreen style */}
        <View style={[styles.headerBanner, {
          backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
          borderColor: 'rgba(255,140,66,0.15)',
        }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={[styles.iconCircle, { backgroundColor: ORANGE + '20' }]}>
              <Icon name={getNotificationIcon(notification?.type)} size={22} color={ORANGE} />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
                Notification
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                Full message
              </Text>
            </View>
          </View>
        </View>

        {/* Content card */}
        <AppCard style={[styles.card, { borderLeftColor: ORANGE }]}>
          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {notification?.title}
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: ORANGE + '18', borderColor: ORANGE + '40' }]}>
              <Icon name={getNotificationIcon(notification?.type)} size={12} color={ORANGE} />
              <Text style={[styles.typeText, { color: ORANGE }]}>
                {notification?.type || 'info'}
              </Text>
            </View>
            <View style={styles.dateRow}>
              <Icon name="time-outline" size={13} color={theme.colors.textTertiary} />
              <Text style={[styles.dateText, { color: theme.colors.textTertiary }]}>
                {formattedDate}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]} />

          {/* Full message — no line limit */}
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            {notification?.message}
          </Text>
        </AppCard>
      </ScrollView>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 20,
  },
  title: {    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    lineHeight: 26,
  },
});

export default NotificationDetailScreen;
