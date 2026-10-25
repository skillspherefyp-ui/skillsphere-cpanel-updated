import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import EmptyState from '../../components/ui/EmptyState';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';
const RED = '#EF4444';

const NotificationsScreen = () => {
  const {
    notifications,
    fetchMyNotifications,
    markAllNotificationsAsRead,
    deleteMultipleNotifications,
  } = useData();
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchMyNotifications();
  }, []);

  const role = user?.role;
  const sidebarItems = getSidebarItems(role);

  const handleNavigate = (route) => navigation.navigate(route);

  const isWeb = Platform.OS === 'web';
  const maxWidth = isWeb && width > 1200 ? 1200 : '100%';
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;

  const enterSelectMode = useCallback((id) => {
    setSelectMode(true);
    setSelectedIds([id]);
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map((n) => n.id));
    }
  }, [allSelected, notifications]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    await deleteMultipleNotifications(selectedIds);
    exitSelectMode();
  }, [selectedIds, deleteMultipleNotifications, exitSelectMode]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'course': return 'book';
      case 'quiz': return 'help-circle';
      case 'certificate': return 'ribbon';
      default: return 'notifications';
    }
  };

  const renderNotification = ({ item, index }) => {
    const isSelected = selectedIds.includes(item.id);

    return (
      <Animated.View entering={FadeInDown.duration(400).delay(index * 50)}>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => !selectMode && enterSelectMode(item.id)}
          onPress={() => {
            if (selectMode) {
              toggleSelect(item.id);
            } else {
              navigation.navigate('NotificationDetail', { notification: item });
            }
          }}
        >
          <AppCard
            style={[
              styles.notificationCard,
              !item.isRead && { backgroundColor: theme.colors.primary + '10' },
              isSelected && { backgroundColor: ORANGE + '18', borderLeftColor: ORANGE },
            ]}
          >
            {/* Checkbox / icon column */}
            {selectMode ? (
              <View style={styles.checkboxContainer}>
                <View style={[
                  styles.checkbox,
                  { borderColor: isSelected ? ORANGE : theme.colors.border },
                  isSelected && { backgroundColor: ORANGE },
                ]}>
                  {isSelected && <Icon name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </View>
            ) : (
              <View style={[styles.notificationIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Icon name={getNotificationIcon(item.type)} size={24} color={theme.colors.primary} />
              </View>
            )}

            <View style={styles.notificationContent}>
              <Text style={[styles.notificationTitle, { color: theme.colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.notificationMessage, { color: theme.colors.textSecondary }]} numberOfLines={3}>{item.message}</Text>
              <Text style={[styles.notificationDate, { color: theme.colors.textTertiary }]}>
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : item.date}
              </Text>
            </View>

            {!selectMode && !item.isRead && (
              <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
            )}
          </AppCard>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.pageHeaderBanner, {
      backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
      borderColor: selectMode ? ORANGE + '40' : 'rgba(255,140,66,0.15)',
    }]}>
      <View style={styles.bannerLeft}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
          onPress={selectMode ? exitSelectMode : () => navigation.goBack()}
        >
          <Icon name={selectMode ? 'close' : 'arrow-back'} size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.bannerIconCircle, { backgroundColor: selectMode ? RED + '20' : ORANGE + '20' }]}>
          <Icon name={selectMode ? 'trash-outline' : 'notifications'} size={22} color={selectMode ? RED : ORANGE} />
        </View>
        <View style={styles.bannerTextGroup}>
          <Text style={[styles.bannerTitle, { color: theme.colors.textPrimary }]}>
            {selectMode ? `${selectedIds.length} selected` : 'Notifications'}
          </Text>
          <Text style={[styles.bannerSubtitle, { color: theme.colors.textSecondary }]}>
            {selectMode ? 'Long press to select, tap to toggle' : 'Stay up to date with your learning'}
          </Text>
        </View>
      </View>

      {/* Right-side actions */}
      {selectMode ? (
        <View style={styles.bannerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' }]}
            onPress={toggleSelectAll}
          >
            <Icon name={allSelected ? 'checkbox' : 'square-outline'} size={18} color={theme.colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.deleteBtn,
              selectedIds.length === 0 && styles.deleteBtnDisabled,
            ]}
            onPress={handleDeleteSelected}
            disabled={selectedIds.length === 0}
          >
            <Icon name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllBtn, { backgroundColor: ORANGE + '15', borderColor: ORANGE + '40' }]}
            onPress={markAllNotificationsAsRead}
          >
            <Icon name="checkmark-done-outline" size={16} color={ORANGE} />
            <Text style={[styles.markAllText, { color: ORANGE }]}>Mark all read</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Dashboard"
      onNavigate={handleNavigate}
    >
      <View style={[styles.content, { maxWidth, alignSelf: 'center', width: '100%' }]}>
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              subtitle="You're all caught up! New notifications will appear here"
            />
          }
        />
      </View>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  pageHeaderBanner: {
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
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {    fontSize: 20,
    fontWeight: '800',
  },
  bannerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: RED,
  },
  deleteBtnDisabled: {
    opacity: 0.4,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF8C42',
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkboxContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  notificationDate: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'center',
  },
});

export default NotificationsScreen;
