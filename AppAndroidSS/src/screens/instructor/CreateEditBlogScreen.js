import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { blogAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';

const TAG_PRESETS = [
  // Learning & skills
  { label: 'AI & Learning',    color: '#6366F1' },
  { label: 'Study Tips',       color: ORANGE    },
  { label: 'Instructor Tips',  color: '#EC4899' },
  // Tech & coding
  { label: 'Coding',           color: '#06B6D4' },
  { label: 'Web Development',  color: '#3B82F6' },
  { label: 'Data Science',     color: '#8B5CF6' },
  { label: 'Cybersecurity',    color: '#EF4444' },
  { label: 'DevOps',           color: '#F59E0B' },
  { label: 'Mobile Dev',       color: '#10B981' },
  { label: 'UI / UX',          color: '#F472B6' },
  // Career & growth
  { label: 'Career Growth',    color: '#22C55E' },
  { label: 'Freelancing',      color: '#FB923C' },
  { label: 'Productivity',     color: '#A78BFA' },
  // Platform
  { label: 'Platform News',    color: '#7C6FCD' },
  { label: 'Promotion',        color: '#F59E0B' },
  { label: 'General',          color: '#64748B' },
];

const ICON_PRESETS = [
  // Writing / content
  'newspaper-outline', 'document-text-outline', 'book-outline', 'bookmark-outline', 'library-outline',
  // Ideas / learning
  'bulb-outline', 'brain-outline', 'sparkles-outline', 'school-outline', 'telescope-outline',
  // Tech / AI
  'hardware-chip-outline', 'code-slash-outline', 'terminal-outline', 'laptop-outline', 'desktop-outline',
  // Growth / career
  'trending-up-outline', 'rocket-outline', 'trophy-outline', 'medal-outline', 'ribbon-outline',
  // People / community
  'happy-outline', 'people-outline', 'chatbubbles-outline', 'person-circle-outline', 'hand-left-outline',
  // Tools / build
  'settings-outline', 'construct-outline', 'build-outline', 'hammer-outline', 'color-palette-outline',
  // Data / analytics
  'bar-chart-outline', 'pie-chart-outline', 'analytics-outline', 'stats-chart-outline', 'globe-outline',
  // Misc
  'flash-outline', 'heart-outline', 'shield-outline', 'leaf-outline', 'game-controller-outline',
];

const CreateEditBlogScreen = ({ route }) => {
  const { postId } = route.params || {};
  const isEditing = !!postId;
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const isMobile = width <= 480;
  const isTablet = width > 768;

  const [loading, setLoading]     = useState(isEditing);
  const [saving, setSaving]       = useState(false);
  const [title, setTitle]         = useState('');
  const [excerpt, setExcerpt]     = useState('');
  const [content, setContent]     = useState('');
  const [tag, setTag]             = useState('General');
  const [tagColor, setTagColor]   = useState('#64748B');
  const [author, setAuthor]       = useState('SkillSphere Team');
  const [readTime, setReadTime]   = useState('3 min read');
  const [coverIcon, setCoverIcon] = useState('newspaper-outline');

  // Track cursor/selection for format insertion
  const contentRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const applyFormat = (prefix, suffix = '') => {
    const { start, end } = selectionRef.current;
    const selected = content.slice(start, end);
    const replacement = prefix + (selected || '') + suffix;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    setContent(newContent);
    // Restore cursor after the inserted text
    const newCursor = start + prefix.length + (selected || '').length + suffix.length;
    setTimeout(() => {
      selectionRef.current = { start: newCursor, end: newCursor };
      contentRef.current?.focus?.();
    }, 0);
  };

  const applyLinePrefix = (prefix) => {
    const { start } = selectionRef.current;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newContent = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(newContent);
  };

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

  useEffect(() => {
    if (isEditing) loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      const res = await blogAPI.getPostAdmin(postId);
      if (res.success) {
        const p = res.post;
        setTitle(p.title || '');
        setExcerpt(p.excerpt || '');
        setContent(p.content || '');
        setTag(p.tag || 'General');
        setTagColor(p.tagColor || '#64748B');
        setAuthor(p.author || 'SkillSphere Team');
        setReadTime(p.readTime || '3 min read');
        setCoverIcon(p.coverIcon || 'newspaper-outline');
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load post' });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim())   { Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter a title' }); return; }
    if (!excerpt.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter an excerpt' }); return; }
    if (!content.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter content' }); return; }

    setSaving(true);
    try {
      const data = { title: title.trim(), excerpt: excerpt.trim(), content: content.trim(), tag, tagColor, author, readTime, coverIcon };
      const res = isEditing ? await blogAPI.update(postId, data) : await blogAPI.create(data);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: isEditing ? 'Post updated' : 'Draft created',
          text2: isEditing ? 'Changes saved successfully' : 'Post saved as draft',
        });
        navigation.goBack();
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save post' });
    } finally {
      setSaving(false);
    }
  };

  const styles = getStyles(theme, isDark, isTablet, isMobile);

  const inputBg     = isDark ? 'rgba(255,255,255,0.07)' : '#F8FAFC';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)'  : 'rgba(26,26,46,0.1)';
  const placeholderColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(26,26,46,0.28)';

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
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading post...</Text>
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
        keyboardShouldPersistTaps="handled"
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
              <Icon name={isEditing ? 'create' : 'add-circle'} size={22} color={ORANGE} />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>
                {isEditing ? 'Edit Post' : 'New Post'}
              </Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>
                {isEditing ? 'Update your blog article' : 'Write and save a new draft'}
              </Text>
            </View>
          </View>

          {/* Live preview badge */}
          <View style={[styles.previewPill, { backgroundColor: (tagColor || ORANGE) + '20', borderColor: (tagColor || ORANGE) + '50' }]}>
            <Icon name={coverIcon} size={13} color={tagColor || ORANGE} />
            <Text style={[styles.previewPillTag, { color: tagColor || ORANGE }]}>{tag}</Text>
            <Text style={[styles.previewPillTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {title || 'Untitled post'}
            </Text>
          </View>
        </View>

        {/* Two-column layout on tablet/desktop */}
        <View style={[styles.formGrid, isTablet && styles.formGridRow]}>

          {/* Left column — main content */}
          <View style={[styles.formCol, isTablet && { flex: 3 }]}>
            <View style={[styles.card, {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
            }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Content</Text>

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.textPrimary }]}
                placeholder="Enter post title"
                placeholderTextColor={placeholderColor}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Excerpt *</Text>
              <TextInput
                style={[styles.input, styles.multiline, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.textPrimary }]}
                placeholder="Short summary shown on the blog listing"
                placeholderTextColor={placeholderColor}
                value={excerpt}
                onChangeText={setExcerpt}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Content *</Text>

              {/* Formatting toolbar */}
              <View style={[styles.toolbar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderColor: inputBorder }]}>
                {/* Inline formats */}
                {[
                  { label: 'B',  title: 'Bold',    onPress: () => applyFormat('**', '**') },
                  { label: 'I',  title: 'Italic',  onPress: () => applyFormat('*', '*'), italic: true },
                ].map(btn => (
                  <TouchableOpacity key={btn.label} style={[styles.toolbarBtn, { borderColor: inputBorder }]} onPress={btn.onPress}>
                    <Text style={[styles.toolbarBtnText, { color: theme.colors.textPrimary, fontStyle: btn.italic ? 'italic' : 'normal', fontWeight: btn.label === 'B' ? '800' : '600' }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}

                <View style={[styles.toolbarDivider, { backgroundColor: inputBorder }]} />

                {/* Line-level formats */}
                {[
                  { label: 'H2',  onPress: () => applyLinePrefix('## ')  },
                  { label: 'H3',  onPress: () => applyLinePrefix('### ') },
                ].map(btn => (
                  <TouchableOpacity key={btn.label} style={[styles.toolbarBtn, { borderColor: inputBorder }]} onPress={btn.onPress}>
                    <Text style={[styles.toolbarBtnText, { color: theme.colors.textPrimary, fontSize: 11 }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}

                <View style={[styles.toolbarDivider, { backgroundColor: inputBorder }]} />

                {/* List / structure */}
                <TouchableOpacity style={[styles.toolbarBtn, { borderColor: inputBorder }]} onPress={() => applyLinePrefix('• ')}>
                  <Text style={[styles.toolbarBtnText, { color: theme.colors.textPrimary }]}>•</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toolbarBtn, { borderColor: inputBorder }]} onPress={() => applyLinePrefix('1. ')}>
                  <Text style={[styles.toolbarBtnText, { color: theme.colors.textPrimary, fontSize: 11 }]}>1.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toolbarBtn, { borderColor: inputBorder }]} onPress={() => applyLinePrefix('> ')}>
                  <Icon name="chatbox-outline" size={15} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.toolbarDivider, { backgroundColor: inputBorder }]} />

                {/* Insert divider line */}
                <TouchableOpacity style={[styles.toolbarBtn, { borderColor: inputBorder }]} onPress={() => applyFormat('\n---\n', '')}>
                  <Icon name="remove-outline" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                {/* Markdown hint */}
                <Text style={[styles.toolbarHint, { color: theme.colors.textTertiary }]}>Markdown</Text>
              </View>

              <TextInput
                ref={contentRef}
                style={[styles.input, styles.contentInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.textPrimary, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 }]}
                placeholder="Write your full article here..."
                placeholderTextColor={placeholderColor}
                value={content}
                onChangeText={setContent}
                onSelectionChange={(e) => { selectionRef.current = e.nativeEvent.selection; }}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Right column — metadata */}
          <View style={[styles.formCol, isTablet && { flex: 2 }]}>

            {/* Tag */}
            <View style={[styles.card, {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
            }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Tag</Text>
              <View style={styles.chipRow}>
                {TAG_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.tagChip, {
                      backgroundColor: tag === preset.label ? preset.color : preset.color + '18',
                      borderColor: preset.color + '80',
                    }]}
                    onPress={() => { setTag(preset.label); setTagColor(preset.color); }}
                  >
                    <Text style={[styles.tagChipText, { color: tag === preset.label ? '#fff' : preset.color }]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cover Icon */}
            <View style={[styles.card, {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
              marginTop: 16,
            }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Cover Icon</Text>
              <View style={styles.iconRow}>
                {ICON_PRESETS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconChip, {
                      backgroundColor: coverIcon === icon ? ORANGE + '20' : inputBg,
                      borderColor: coverIcon === icon ? ORANGE : inputBorder,
                    }]}
                    onPress={() => setCoverIcon(icon)}
                  >
                    <Icon name={icon} size={20} color={coverIcon === icon ? ORANGE : theme.colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Author & Read Time */}
            <View style={[styles.card, {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
              marginTop: 16,
            }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Details</Text>

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Author</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.textPrimary }]}
                placeholder="SkillSphere Team"
                placeholderTextColor={placeholderColor}
                value={author}
                onChangeText={setAuthor}
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Read Time</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.textPrimary, marginBottom: 0 }]}
                placeholder="3 min read"
                placeholderTextColor={placeholderColor}
                value={readTime}
                onChangeText={setReadTime}
              />
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Create Draft'}</Text>
                </>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { padding: isMobile ? 16 : 24, paddingBottom: 48 },

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
    pageTitle: {      fontSize: isMobile ? 18 : 22, fontWeight: '700',
      fontFamily: theme.typography?.fontFamily?.bold, marginBottom: 2,
    },
    pageSubtitle: { fontSize: 13, fontFamily: theme.typography?.fontFamily?.regular },

    previewPill: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      borderWidth: 1, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
      alignSelf: isTablet ? 'center' : 'flex-start',
      maxWidth: isTablet ? 260 : '100%',
    },
    previewPillTag: { fontSize: 11, fontWeight: '700' },
    previewPillTitle: { fontSize: 12, fontWeight: '600', flex: 1 },

    // Grid
    formGrid: { gap: 16 },
    formGridRow: { flexDirection: 'row', alignItems: 'flex-start' },
    formCol: {},

    // Card
    card: {
      borderRadius: 16, borderWidth: 1, padding: isMobile ? 16 : 20,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    cardTitle: {      fontSize: 15, fontWeight: '700',
      fontFamily: theme.typography?.fontFamily?.bold,
      marginBottom: 16,
    },

    label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
    input: {
      borderRadius: 10, borderWidth: 1.5,
      paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
      marginBottom: 16,
    },
    multiline:    { minHeight: 80,  paddingTop: 11 },
    contentInput: { minHeight: 280, paddingTop: 11 },

    toolbar: {
      flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2,
      borderWidth: 1.5, borderBottomWidth: 0,
      borderTopLeftRadius: 10, borderTopRightRadius: 10,
      paddingHorizontal: 8, paddingVertical: 6,
    },
    toolbarBtn: {
      minWidth: 32, height: 30, borderRadius: 6, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    },
    toolbarBtnText: { fontSize: 13, fontWeight: '700' },
    toolbarDivider: { width: 1, height: 18, marginHorizontal: 4 },
    toolbarHint: { fontSize: 10, fontWeight: '600', marginLeft: 'auto', paddingRight: 4 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagChip: {
      borderWidth: 1.5, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    tagChipText: { fontSize: 12, fontWeight: '700' },

    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChip: {
      width: 44, height: 44, borderRadius: 10, borderWidth: 1.5,
      justifyContent: 'center', alignItems: 'center',
    },

    saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: ORANGE, borderRadius: 12,
      paddingVertical: 14, marginTop: 16,
      ...(Platform.OS === 'web' && {
        boxShadow: '0 4px 14px rgba(255,140,66,0.35)',
      }),
    },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });

export default CreateEditBlogScreen;
