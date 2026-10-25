import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { blogAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';
const GREEN  = '#10B981';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const BlogManagementScreen = () => {
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const isMobile = width <= 480;
  const isTablet = width > 768;

  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sidebarItems = getSidebarItems(user?.role);

  const handleNavigate = (route) => {
    if (route === 'ManageInstructors') {
      navigation.navigate('ManageUsers', { userType: 'instructor' });
    } else if (route === 'Categories') {
      navigation.navigate('CategoryManagement');
    } else {
      navigation.navigate(route);
    }
  };

  const fetchPosts = useCallback(async () => {
    try {
      const res = await blogAPI.getAllAdmin();
      if (res.success) setPosts(res.posts || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load blog posts' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchPosts();
  }, [fetchPosts]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [fetchPosts]);

  const handleTogglePublish = async (post) => {
    setToggling(post.id);
    try {
      const res = await blogAPI.togglePublish(post.id);
      if (res.success) {
        setPosts(prev => prev.map(p => p.id === post.id ? res.post : p));
        Toast.show({
          type: 'success',
          text1: res.post.isPublished ? 'Published' : 'Unpublished',
          text2: `"${post.title}" is now ${res.post.isPublished ? 'live' : 'a draft'}`,
        });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update post status' });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = (post) => {
    setDeleteTarget(post);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const post = deleteTarget;
    setDeleteTarget(null);
    try {
      await blogAPI.delete(post.id);
      setPosts(prev => prev.filter(p => p.id !== post.id));
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Post removed' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete post' });
    }
  };

  const publishedCount = posts.filter(p => p.isPublished).length;
  const draftCount     = posts.filter(p => !p.isPublished).length;

  const styles = getStyles(theme, isDark, isTablet, isMobile);

  if (loading) {
    return (
      <MainLayout
        showSidebar
        sidebarItems={sidebarItems}
        activeRoute="BlogManagement"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: 'Admin', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading posts...
          </Text>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar
      sidebarItems={sidebarItems}
      activeRoute="BlogManagement"
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
        {/* Page Header Banner */}
        <View style={[styles.pageHeaderBanner, {
          backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
          borderColor: 'rgba(255,140,66,0.15)',
        }]}>
          <View style={styles.bannerLeft}>
            <TouchableOpacity
              style={[styles.backButton, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
              }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.bannerIconCircle}>
              <Icon name="newspaper" size={22} color={ORANGE} />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>
                Blog Management
              </Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>
                Create, edit, and publish blog articles
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => navigation.navigate('CreateEditBlog', {})}
          >
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.newPostBtnText}>New Post</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,140,66,0.12)' }]}>
              <Icon name="newspaper" size={20} color={ORANGE} />
            </View>
            <Text style={[styles.statValue, { color: ORANGE }]}>{posts.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Posts</Text>
          </View>

          <View style={[styles.statCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Icon name="eye" size={20} color={GREEN} />
            </View>
            <Text style={[styles.statValue, { color: GREEN }]}>{publishedCount}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Published</Text>
          </View>

          <View style={[styles.statCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
              <Icon name="document-text" size={20} color="#64748B" />
            </View>
            <Text style={[styles.statValue, { color: '#64748B' }]}>{draftCount}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Drafts</Text>
          </View>
        </View>

        {/* Post List */}
        {posts.length === 0 ? (
          <View style={[styles.emptyCard, {
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.emptyIconCircle, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.05)',
            }]}>
              <Icon name="newspaper-outline" size={36} color={theme.colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No posts yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Create your first blog post to get started
            </Text>
            <TouchableOpacity
              style={styles.newPostBtn}
              onPress={() => navigation.navigate('CreateEditBlog', {})}
            >
              <Icon name="add" size={18} color="#fff" />
              <Text style={styles.newPostBtnText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postList}>
            {posts.map((post, index) => (
              <Animated.View
                key={post.id}
                entering={FadeInDown.duration(400).delay(index * 60)}
              >
                <View style={[styles.postCard, {
                  backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
                }]}>
                  {/* Status strip */}
                  <View style={[styles.statusStrip, {
                    backgroundColor: post.isPublished ? GREEN + '15' : ORANGE + '12',
                  }]}>
                    <View style={[styles.statusDot, { backgroundColor: post.isPublished ? GREEN : ORANGE }]} />
                    <Text style={[styles.statusText, { color: post.isPublished ? GREEN : ORANGE }]}>
                      {post.isPublished ? `Published · ${formatDate(post.publishedAt)}` : 'Draft'}
                    </Text>
                  </View>

                  <View style={styles.postCardBody}>
                    {/* Tag */}
                    <View style={[styles.tagBadge, { backgroundColor: (post.tagColor || ORANGE) + '20' }]}>
                      <Icon name={post.coverIcon || 'newspaper-outline'} size={11} color={post.tagColor || ORANGE} />
                      <Text style={[styles.tagText, { color: post.tagColor || ORANGE }]}>{post.tag || 'General'}</Text>
                    </View>

                    <Text style={[styles.postTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                      {post.title}
                    </Text>
                    <Text style={[styles.postExcerpt, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {post.excerpt}
                    </Text>

                    <View style={styles.metaRow}>
                      <Icon name="person-outline" size={12} color={theme.colors.textTertiary} />
                      <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>{post.author}</Text>
                      <View style={[styles.metaDot, { backgroundColor: theme.colors.textTertiary }]} />
                      <Icon name="time-outline" size={12} color={theme.colors.textTertiary} />
                      <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>{post.readTime}</Text>
                    </View>

                    {/* Action buttons */}
                    <View style={[styles.actionsRow, {
                      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)',
                    }]}>
                      <TouchableOpacity
                        style={[styles.actionBtn, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.05)',
                        }]}
                        onPress={() => navigation.navigate('CreateEditBlog', { postId: post.id })}
                      >
                        <Icon name="create-outline" size={14} color={theme.colors.textPrimary} />
                        <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, {
                          backgroundColor: post.isPublished ? ORANGE + '12' : GREEN + '12',
                        }]}
                        disabled={toggling === post.id}
                        onPress={() => handleTogglePublish(post)}
                      >
                        {toggling === post.id ? (
                          <ActivityIndicator size={14} color={post.isPublished ? ORANGE : GREEN} />
                        ) : (
                          <Icon
                            name={post.isPublished ? 'eye-off-outline' : 'eye-outline'}
                            size={14}
                            color={post.isPublished ? ORANGE : GREEN}
                          />
                        )}
                        <Text style={[styles.actionBtnText, { color: post.isPublished ? ORANGE : GREEN }]}>
                          {post.isPublished ? 'Unpublish' : 'Publish'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.08)' }]}
                        onPress={() => handleDelete(post)}
                      >
                        <Icon name="trash-outline" size={14} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Post"
        message={deleteTarget ? `Delete "${deleteTarget.title}"? This cannot be undone.` : ''}
        confirmText="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { padding: isMobile ? 16 : 24, paddingBottom: 40 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },

    // Banner
    pageHeaderBanner: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isTablet ? 'center' : 'flex-start',
      padding: isMobile ? 16 : 20,
      marginBottom: 24,
      borderRadius: 16,
      borderWidth: 1,
      gap: 12,
    },
    bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: isTablet ? 1 : undefined },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    bannerIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,140,66,0.15)',
      justifyContent: 'center', alignItems: 'center',
    },
    bannerTextGroup: { flex: 1 },
    pageTitle: {      fontSize: isMobile ? 18 : 22,
      fontWeight: '700',
      fontFamily: theme.typography?.fontFamily?.bold,
      marginBottom: 2,
    },
    pageSubtitle: { fontSize: 13, fontFamily: theme.typography?.fontFamily?.regular },

    newPostBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: ORANGE, borderRadius: 10,
      paddingHorizontal: 16, paddingVertical: 10,
      alignSelf: 'flex-start',
    },
    newPostBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    // Stats
    statsRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 16,
      marginBottom: 24,
    },
    statCard: {
      flex: 1, padding: 16, borderRadius: 14, borderWidth: 1,
      alignItems: 'center', gap: 4,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    statValue: { fontSize: isMobile ? 28 : 32, fontWeight: '700', lineHeight: isMobile ? 34 : 38 },
    statLabel: { fontSize: 13, textAlign: 'center' },

    // Empty
    emptyCard: {
      borderRadius: 16, borderWidth: 1,
      padding: isMobile ? 32 : 48,
      alignItems: 'center', gap: 10,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    emptyIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },

    // Post list
    postList: { gap: 14 },
    postCard: {
      borderRadius: 16, borderWidth: 1, overflow: 'hidden',
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    statusStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
    postCardBody: { padding: isMobile ? 14 : 18 },
    tagBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      alignSelf: 'flex-start', borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10,
    },
    tagText: { fontSize: 11, fontWeight: '700' },
    postTitle: { fontSize: isMobile ? 15 : 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
    postExcerpt: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
    metaText: { fontSize: 12 },
    metaDot: { width: 3, height: 3, borderRadius: 2 },
    actionsRow: {
      flexDirection: 'row', gap: 8,
      paddingTop: 14, borderTopWidth: 1,
    },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    },
    actionBtnText: { fontSize: 12, fontWeight: '600' },
  });

export default BlogManagementScreen;
