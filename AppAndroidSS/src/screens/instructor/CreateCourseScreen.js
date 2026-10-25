import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Image,
  Modal,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MainLayout from '../../components/ui/MainLayout';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import AddMaterialModal from '../../components/AddMaterialModal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { uploadAPI } from '../../services/apiClient';
import { resolveFileUrl } from '../../utils/urlHelpers';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';

const CreateCourseScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId, courseData } = route.params || {};
  const { addCourse, updateCourse, categories, courses } = useData();
  const { user, logout } = useAuth();
  const isEditMode = !!courseId;
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  const isAdmin = user?.role === 'admin';

  const sidebarItems = getSidebarItems(user?.role);

  const handleNavigate = (navRoute) => {
    if (isAdmin) {
      if (navRoute === 'ManageInstructors') {
        navigation.navigate('ManageUsers', { userType: 'instructor' });
      } else if (navRoute === 'Categories') {
        navigation.navigate('CategoryManagement');
      } else {
        navigation.navigate(navRoute);
      }
    } else {
      navigation.navigate(navRoute);
    }
  };

  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [language, setLanguage] = useState('English');
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [duration, setDuration] = useState('');
  const [creationMode, setCreationMode] = useState('ai'); // 'ai' | 'manual'
  const [lectureSettings, setLectureSettings] = useState({
    explanationStyle: 'balanced',
    codeDepth: 'moderate',
    visualPreference: 'auto',
    audienceType: 'general',
  });
  const [materials, setMaterials] = useState([]);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [prerequisiteIds, setPrerequisiteIds] = useState([]);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [prereqSearch, setPrereqSearch] = useState('');

  // Rich text refs for description
  const descRef = useRef(null);
  const descSelectionRef = useRef({ start: 0, end: 0 });

  // Available courses for prerequisites: same category, exclude current course
  const availableCourses = courses.filter(c =>
    c.id !== courseId && c.category?.name === category
  );
  const filteredPrereqCourses = useMemo(() =>
    availableCourses.filter(c => c.name.toLowerCase().includes(prereqSearch.toLowerCase())),
    [availableCourses, prereqSearch]
  );

  const categoryNames = categories.map(cat => cat.name);
  const levels = ['Beginner', 'Intermediate', 'Advanced'];
  const languages = ['English', 'Urdu'];

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && courseData) {
      setCourseName(courseData.name || '');
      setDescription(courseData.description || '');
      setLevel(courseData.level || 'Beginner');
      setLanguage(courseData.language || 'English');
      setCategory(courseData.category?.name || categories[0]?.name || '');
      setDuration(courseData.duration || '');
      setCreationMode(courseData.creationMode || 'ai');
      setThumbnailImage(courseData.thumbnailImage || null);
      setMaterials(courseData.materials || []);
      setPrerequisiteIds(courseData.prerequisiteIds || []);
      if (courseData.lectureSettings && typeof courseData.lectureSettings === 'object') {
        setLectureSettings(prev => ({ ...prev, ...courseData.lectureSettings }));
      }
    }
  }, [isEditMode, courseData]);

  const handleAddMaterial = (newMaterial) => {
    setMaterials((prev) => {
      if (prev.some(m => m.type === 'pdf')) {
        Toast.show({ type: 'error', text1: 'Only one outline PDF allowed', text2: 'Remove the existing PDF before adding a new one.' });
        return prev;
      }
      return [...prev, newMaterial];
    });
  };

  const handleRemoveMaterial = (id) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleImagePick = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/jpg';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          await uploadThumbnail(file);
        }
      };
      input.click();
    } else {
      Toast.show({
        type: 'info',
        text1: 'Coming Soon',
        text2: 'Image upload on mobile coming soon',
      });
    }
  };

  const uploadThumbnail = async (file) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await uploadAPI.uploadFile(formData);
      if (response.success) {
        setThumbnailImage(response.file.url);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Thumbnail uploaded!' });
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to upload' });
    } finally {
      setUploadingImage(false);
    }
  };

  const applyDescFormat = (prefix, suffix = '') => {
    const { start, end } = descSelectionRef.current;
    const selected = description.slice(start, end);
    setDescription(description.slice(0, start) + prefix + (selected || '') + suffix + description.slice(end));
  };

  const applyDescLinePrefix = (prefix) => {
    const { start } = descSelectionRef.current;
    const lineStart = description.lastIndexOf('\n', start - 1) + 1;
    setDescription(description.slice(0, lineStart) + prefix + description.slice(lineStart));
  };

  const handleSubmit = async () => {
    if (!courseName || !description || !category || !duration) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill all required fields' });
      return;
    }

    const selectedCategory = categories.find(cat => cat.name === category);
    if (!selectedCategory) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid category selected' });
      return;
    }

    const formattedMaterials = materials.map(m => ({
      type: m.type,
      uri: m.uri,
      title: m.fileName || m.uri,
      description: m.description || '',
    }));

    const payload = {
      name: courseName,
      description,
      level,
      language,
      categoryId: selectedCategory.id,
      duration,
      creationMode,
      materials: formattedMaterials,
      thumbnailImage,
      prerequisiteIds,
      lectureSettings: creationMode === 'ai' ? lectureSettings : null,
    };

    if (isEditMode) {
      const result = await updateCourse(courseId, payload);
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Course updated!' });
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to update' });
      }
    } else {
      const result = await addCourse(payload);
      if (result.success) {
        setCourseName('');
        setDescription('');
        setLevel('Beginner');
        setLanguage('English');
        setCategory(categories[0]?.name || '');
        setDuration('');
        setMaterials([]);
        setThumbnailImage(null);
        setPrerequisiteIds([]);
        setLectureSettings({ explanationStyle: 'balanced', codeDepth: 'moderate', visualPreference: 'auto', audienceType: 'general' });
        Toast.show({ type: 'success', text1: 'Success', text2: 'Course created!' });
        navigation.navigate('AddTopics', { courseId: result.course.id, creationMode });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to create' });
      }
    }
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Courses"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Banner */}
        <View style={{
          backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
          borderColor: 'rgba(255,140,66,0.15)',
          borderRadius: 16,
          borderWidth: 1,
          padding: 20,
          marginBottom: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
              borderRadius: 10,
              padding: 10,
            }}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ backgroundColor: ORANGE + '20', borderRadius: 12, padding: 12 }}>
            <Icon name="create" size={22} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
              {isEditMode ? 'Edit Course' : 'Create New Course'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Fill in course details below</Text>
          </View>
        </View>

        {/* Form Grid */}
        <View style={styles.formGrid}>
          {/* Left Column - Main Info */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.mainColumn}>

            {/* Course Details Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#6366F1' + '18' }]}>
                  <Icon name="book" size={18} color="#6366F1" />
                </View>
                <View style={styles.sectionTitleBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Course Details</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                    Basic information about your course
                  </Text>
                </View>
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.08)' }]} />

              <AppInput
                label="Course Name *"
                value={courseName}
                onChangeText={setCourseName}
                placeholder="Enter course name"
              />

              {/* Description with rich text toolbar */}
              {(() => {
                const bg = isDark ? 'rgba(255,255,255,0.07)' : '#F8FAFC';
                const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)';
                const placeholder = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(26,26,46,0.28)';
                const btnStyle = {
                  paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6,
                  borderWidth: 1, borderColor: border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                };
                const divider = <View style={{ width: 1, height: 18, backgroundColor: border, marginHorizontal: 2 }} />;
                return (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily.semiBold, marginBottom: 6 }}>
                      Description *
                    </Text>
                    {/* Toolbar */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4,
                      paddingHorizontal: 10, paddingVertical: 7,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                      borderWidth: 1, borderColor: border,
                      borderTopLeftRadius: 12, borderTopRightRadius: 12,
                    }}>
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescFormat('**', '**')}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 13 }}>B</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescFormat('*', '*')}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontStyle: 'italic', fontSize: 13 }}>I</Text>
                      </TouchableOpacity>
                      {divider}
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescLinePrefix('## ')}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 11 }}>H2</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescLinePrefix('### ')}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 11 }}>H3</Text>
                      </TouchableOpacity>
                      {divider}
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescLinePrefix('• ')}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 15, lineHeight: 18 }}>•</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescLinePrefix('1. ')}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 11 }}>1.</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescLinePrefix('> ')}>
                        <Icon name="chatbox-outline" size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      {divider}
                      <TouchableOpacity style={btnStyle} onPress={() => applyDescFormat('\n---\n', '')}>
                        <Icon name="remove-outline" size={16} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <Text style={{ marginLeft: 4, fontSize: 10, color: theme.colors.textTertiary, fontStyle: 'italic' }}>Markdown</Text>
                    </View>
                    <TextInput
                      ref={descRef}
                      style={{
                        backgroundColor: bg, borderWidth: 1, borderColor: border,
                        borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                        color: theme.colors.textPrimary, fontSize: 14, padding: 14,
                        fontFamily: theme.typography.fontFamily.regular,
                        minHeight: 130, textAlignVertical: 'top',
                      }}
                      placeholder="Enter course description... (supports **bold**, *italic*, ## Heading)"
                      placeholderTextColor={placeholder}
                      value={description}
                      onChangeText={setDescription}
                      onSelectionChange={(e) => { descSelectionRef.current = e.nativeEvent.selection; }}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                );
              })()}

              <SearchableDropdown
                label="Category *"
                options={categoryNames}
                selectedValue={category}
                onSelect={(val) => { setCategory(val); setPrerequisiteIds([]); }}
                placeholder="Select a category"
              />

              <AppInput
                label="Duration *"
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g., 4 weeks, 10 hours"
              />
            </View>

            {/* Prerequisites Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#10B981' + '18' }]}>
                  <Icon name="git-branch" size={18} color="#10B981" />
                </View>
                <View style={styles.sectionTitleBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Prerequisites</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                    Student must complete this course first (optional)
                  </Text>
                </View>
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#10B981' + '12' }]} />

              <TouchableOpacity
                style={[styles.prereqDropdownBtn, {
                  borderColor: prerequisiteIds.length > 0 ? '#10B981' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.10)'),
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                }]}
                onPress={() => setShowPrereqModal(true)}
              >
                <Text style={[styles.prereqDropdownText, { color: prerequisiteIds.length > 0 ? '#10B981' : theme.colors.placeholder }]}>
                  {prerequisiteIds.length === 0
                    ? 'No prerequisite'
                    : (availableCourses.find(x => x.id === prerequisiteIds[0])?.name || 'Selected')}
                </Text>
                <Icon name="chevron-down" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {/* Clear button */}
              {prerequisiteIds.length > 0 && (
                <TouchableOpacity
                  style={styles.prereqClearBtn}
                  onPress={() => setPrerequisiteIds([])}
                >
                  <Icon name="close-circle" size={14} color="#EF4444" />
                  <Text style={styles.prereqClearText}>Remove prerequisite</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Prerequisites Multi-Select Modal */}
            <Modal
              visible={showPrereqModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowPrereqModal(false)}
            >
              <SafeAreaView style={[styles.prereqModalOverlay,
                Platform.OS === 'web' && { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }
              ]}>
                <View style={[styles.prereqModalContent, {
                  backgroundColor: isDark ? 'rgba(15,15,30,0.97)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.08)',
                }]}>
                  <View style={styles.prereqModalHeader}>
                    <Text style={[styles.prereqModalTitle, { color: theme.colors.textPrimary }]}>Select Prerequisite</Text>
                    <TouchableOpacity onPress={() => { setShowPrereqModal(false); setPrereqSearch(''); }}>
                      <Icon name="close-circle" size={28} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.prereqSearchInput, {
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.10)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                      color: theme.colors.textPrimary,
                    }]}
                    placeholder="Search courses..."
                    placeholderTextColor={theme.colors.placeholder}
                    value={prereqSearch}
                    onChangeText={setPrereqSearch}
                  />

                  {/* None option */}
                  <TouchableOpacity
                    style={[styles.prereqModalItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' }]}
                    onPress={() => { setPrerequisiteIds([]); setShowPrereqModal(false); setPrereqSearch(''); }}
                  >
                    <Text style={[styles.prereqModalItemText, { color: prerequisiteIds.length === 0 ? '#10B981' : theme.colors.textPrimary }]}>
                      No prerequisite
                    </Text>
                    {prerequisiteIds.length === 0 && <Icon name="checkmark-circle" size={20} color="#10B981" />}
                  </TouchableOpacity>

                  <FlatList
                    data={filteredPrereqCourses}
                    keyExtractor={item => String(item.id)}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const selected = prerequisiteIds[0] === item.id;
                      return (
                        <TouchableOpacity
                          style={[styles.prereqModalItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' }]}
                          onPress={() => { setPrerequisiteIds([item.id]); setShowPrereqModal(false); setPrereqSearch(''); }}
                        >
                          <Text style={[styles.prereqModalItemText, { color: selected ? '#10B981' : theme.colors.textPrimary }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {selected && <Icon name="checkmark-circle" size={20} color="#10B981" />}
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={[styles.prereqEmpty, { color: theme.colors.textTertiary }]}>No courses found</Text>
                    }
                  />

                  <TouchableOpacity
                    style={[styles.prereqDoneBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => { setShowPrereqModal(false); setPrereqSearch(''); }}
                  >
                    <Text style={styles.prereqDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </Modal>

            {/* Settings Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: ORANGE + '18' }]}>
                  <Icon name="settings" size={18} color={ORANGE} />
                </View>
                <View style={styles.sectionTitleBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Settings</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                    Configure level and language
                  </Text>
                </View>
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : ORANGE + '12' }]} />

              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, { color: theme.colors.textSecondary }]}>Level *</Text>
                <View style={styles.optionsRow}>
                  {levels.map((lvl) => (
                    <TouchableOpacity
                      key={lvl}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: level === lvl ? ORANGE : (isDark ? theme.colors.card : theme.colors.surface),
                          borderColor: level === lvl ? ORANGE : theme.colors.border,
                        }
                      ]}
                      onPress={() => setLevel(lvl)}
                    >
                      <Text style={[
                        styles.optionChipText,
                        { color: level === lvl ? '#FFFFFF' : theme.colors.textSecondary }
                      ]}>
                        {lvl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, { color: theme.colors.textSecondary }]}>Language *</Text>
                <View style={styles.optionsRow}>
                  {languages.map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: language === lang ? ORANGE : (isDark ? theme.colors.card : theme.colors.surface),
                          borderColor: language === lang ? ORANGE : theme.colors.border,
                        }
                      ]}
                      onPress={() => setLanguage(lang)}
                    >
                      <Text style={[
                        styles.optionChipText,
                        { color: language === lang ? '#FFFFFF' : theme.colors.textSecondary }
                      ]}>
                        {lang}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* AI Lecture Settings — only shown for AI courses */}
            {creationMode === 'ai' && (
              <View style={styles.formCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#8B5CF6' + '18' }]}>
                    <Icon name="bulb" size={18} color="#8B5CF6" />
                  </View>
                  <View style={styles.sectionTitleBlock}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>AI Lecture Settings</Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                      Customize how AI generates lecture content
                    </Text>
                  </View>
                </View>

                <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#8B5CF6' + '12' }]} />

                {/* Explanation Style */}
                <View style={styles.optionGroup}>
                  <Text style={[styles.optionLabel, { color: theme.colors.textSecondary }]}>Explanation Style</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { value: 'balanced', label: 'Balanced' },
                      { value: 'step_by_step', label: 'Step-by-Step' },
                      { value: 'example_first', label: 'Example First' },
                      { value: 'analogy_driven', label: 'Analogy Driven' },
                      { value: 'concise', label: 'Concise' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.optionChip, {
                          backgroundColor: lectureSettings.explanationStyle === opt.value ? '#8B5CF6' : (isDark ? theme.colors.card : theme.colors.surface),
                          borderColor: lectureSettings.explanationStyle === opt.value ? '#8B5CF6' : theme.colors.border,
                        }]}
                        onPress={() => setLectureSettings(prev => ({ ...prev, explanationStyle: opt.value }))}
                      >
                        <Text style={[styles.optionChipText, { color: lectureSettings.explanationStyle === opt.value ? '#FFFFFF' : theme.colors.textSecondary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Code Depth */}
                <View style={styles.optionGroup}>
                  <Text style={[styles.optionLabel, { color: theme.colors.textSecondary }]}>Code Depth</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { value: 'none', label: 'None' },
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'moderate', label: 'Moderate' },
                      { value: 'heavy', label: 'Heavy' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.optionChip, {
                          backgroundColor: lectureSettings.codeDepth === opt.value ? '#8B5CF6' : (isDark ? theme.colors.card : theme.colors.surface),
                          borderColor: lectureSettings.codeDepth === opt.value ? '#8B5CF6' : theme.colors.border,
                        }]}
                        onPress={() => setLectureSettings(prev => ({ ...prev, codeDepth: opt.value }))}
                      >
                        <Text style={[styles.optionChipText, { color: lectureSettings.codeDepth === opt.value ? '#FFFFFF' : theme.colors.textSecondary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Visual Preference */}
                <View style={styles.optionGroup}>
                  <Text style={[styles.optionLabel, { color: theme.colors.textSecondary }]}>Visual Preference</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { value: 'auto', label: 'Auto' },
                      { value: 'diagrams', label: 'Diagrams' },
                      { value: 'flowcharts', label: 'Flowcharts' },
                      { value: 'slides', label: 'Slides' },
                      { value: 'whiteboards', label: 'Whiteboards' },
                      { value: 'code', label: 'Code' },
                      { value: 'mixed', label: 'Mixed' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.optionChip, {
                          backgroundColor: lectureSettings.visualPreference === opt.value ? '#8B5CF6' : (isDark ? theme.colors.card : theme.colors.surface),
                          borderColor: lectureSettings.visualPreference === opt.value ? '#8B5CF6' : theme.colors.border,
                        }]}
                        onPress={() => setLectureSettings(prev => ({ ...prev, visualPreference: opt.value }))}
                      >
                        <Text style={[styles.optionChipText, { color: lectureSettings.visualPreference === opt.value ? '#FFFFFF' : theme.colors.textSecondary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Audience Type */}
                <View style={[styles.optionGroup, { marginBottom: 0 }]}>
                  <Text style={[styles.optionLabel, { color: theme.colors.textSecondary }]}>Audience</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { value: 'general', label: 'General' },
                      { value: 'professional', label: 'Professional' },
                      { value: 'academic', label: 'Academic' },
                      { value: 'kids', label: 'Kids' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.optionChip, {
                          backgroundColor: lectureSettings.audienceType === opt.value ? '#8B5CF6' : (isDark ? theme.colors.card : theme.colors.surface),
                          borderColor: lectureSettings.audienceType === opt.value ? '#8B5CF6' : theme.colors.border,
                        }]}
                        onPress={() => setLectureSettings(prev => ({ ...prev, audienceType: opt.value }))}
                      >
                        <Text style={[styles.optionChipText, { color: lectureSettings.audienceType === opt.value ? '#FFFFFF' : theme.colors.textSecondary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Right Column - Media & Materials */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.sideColumn}>

            {/* Creation Mode Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#8B5CF6' + '18' }]}>
                  <Icon name="sparkles" size={18} color="#8B5CF6" />
                </View>
                <View style={styles.sectionTitleBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Creation Mode</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                    How will content be created?
                  </Text>
                </View>
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#8B5CF6' + '12' }]} />

              <TouchableOpacity
                style={[
                  styles.modeOption,
                  creationMode === 'ai' && { borderColor: '#8B5CF6', backgroundColor: '#8B5CF6' + '10' },
                  creationMode !== 'ai' && { borderColor: theme.colors.border },
                ]}
                onPress={() => setCreationMode('ai')}
              >
                <View style={[styles.modeIconWrap, { backgroundColor: creationMode === 'ai' ? '#8B5CF6' : theme.colors.surface }]}>
                  <Icon name="sparkles" size={20} color={creationMode === 'ai' ? '#fff' : theme.colors.textSecondary} />
                </View>
                <View style={styles.modeTextWrap}>
                  <Text style={[styles.modeTitle, { color: theme.colors.textPrimary }]}>AI Generated</Text>
                  <Text style={[styles.modeSubtitle, { color: theme.colors.textSecondary }]}>
                    Enter topic names — AI generates content automatically
                  </Text>
                </View>
                {creationMode === 'ai' && (
                  <Icon name="checkmark-circle" size={22} color="#8B5CF6" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeOption,
                  { marginTop: 10 },
                  creationMode === 'manual' && { borderColor: ORANGE, backgroundColor: ORANGE + '10' },
                  creationMode !== 'manual' && { borderColor: theme.colors.border },
                ]}
                onPress={() => setCreationMode('manual')}
              >
                <View style={[styles.modeIconWrap, { backgroundColor: creationMode === 'manual' ? ORANGE : theme.colors.surface }]}>
                  <Icon name="videocam" size={20} color={creationMode === 'manual' ? '#fff' : theme.colors.textSecondary} />
                </View>
                <View style={styles.modeTextWrap}>
                  <Text style={[styles.modeTitle, { color: theme.colors.textPrimary }]}>Manual (Videos)</Text>
                  <Text style={[styles.modeSubtitle, { color: theme.colors.textSecondary }]}>
                    Upload YouTube links, PDFs and files yourself
                  </Text>
                </View>
                {creationMode === 'manual' && (
                  <Icon name="checkmark-circle" size={22} color={ORANGE} />
                )}
              </TouchableOpacity>
            </View>

            {/* Media / Thumbnail Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#EC4899' + '18' }]}>
                  <Icon name="image" size={18} color="#EC4899" />
                </View>
                <View style={styles.sectionTitleBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Course Thumbnail</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                    Upload a cover image for your course
                  </Text>
                </View>
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EC4899' + '12' }]} />

              {thumbnailImage ? (
                <View style={styles.thumbnailPreviewContainer}>
                  <Image
                    source={{ uri: resolveFileUrl(thumbnailImage) }}
                    style={styles.thumbnailPreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[styles.removeThumbnailBtn, { backgroundColor: theme.colors.error }]}
                    onPress={() => setThumbnailImage(null)}
                  >
                    <Icon name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.uploadPlaceholder,
                    {
                      borderColor: isDark ? 'rgba(255,255,255,0.2)' : ORANGE + '50',
                      backgroundColor: isDark ? 'rgba(255,140,66,0.04)' : 'rgba(255,140,66,0.04)',
                    },
                  ]}
                  onPress={handleImagePick}
                  disabled={uploadingImage}
                >
                  <View style={[styles.uploadIconCircle, { backgroundColor: ORANGE + '18' }]}>
                    <Icon name="camera-outline" size={32} color={ORANGE} />
                  </View>
                  <Text style={[styles.uploadText, { color: theme.colors.textPrimary }]}>
                    {uploadingImage ? 'Uploading...' : 'Click to upload thumbnail'}
                  </Text>
                  <Text style={[styles.uploadHint, { color: theme.colors.textTertiary }]}>
                    PNG, JPG up to 5MB
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Course Outline Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#EF4444' + '18' }]}>
                    <Icon name="document-text" size={18} color="#EF4444" />
                  </View>
                  <View style={styles.sectionTitleBlock}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                      Course Outline
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                      One PDF outline for the whole course
                    </Text>
                  </View>
                </View>
                {!materials.some(m => m.type === 'pdf') && (
                  <TouchableOpacity
                    style={[styles.addMaterialBtn, { backgroundColor: ORANGE + '18', borderColor: ORANGE + '30' }]}
                    onPress={() => setShowAddMaterialModal(true)}
                  >
                    <Icon name="add" size={18} color={ORANGE} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EF4444' + '12' }]} />

              {materials.length === 0 ? (
                <TouchableOpacity
                  style={[styles.emptyMaterials, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.border, borderStyle: 'dashed' }]}
                  onPress={() => setShowAddMaterialModal(true)}
                  activeOpacity={0.7}
                >
                  <Icon name="document-text-outline" size={28} color="#EF4444" style={{ opacity: 0.6 }} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No outline uploaded
                  </Text>
                  <Text style={[styles.emptyHint, { color: theme.colors.textTertiary }]}>
                    Tap to upload your course outline PDF
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.materialsList}>
                  {materials.map((material) => {
                    const isPdf = material.type === 'pdf';
                    const isLegacy = !isPdf;
                    const matColor = isPdf ? '#EF4444' : material.type === 'image' ? '#EC4899' : '#06B6D4';
                    const matIcon = isPdf ? 'document-text-outline' : material.type === 'image' ? 'image-outline' : 'link-outline';
                    return (
                      <View key={material.id}>
                        <View
                          style={[
                            styles.materialItem,
                            {
                              backgroundColor: isDark ? theme.colors.backgroundSecondary : theme.colors.background,
                              borderColor: theme.colors.border,
                              borderLeftColor: matColor,
                            },
                          ]}
                        >
                          <View style={[styles.materialIconWrap, { backgroundColor: matColor + '18' }]}>
                            <Icon name={matIcon} size={18} color={matColor} />
                          </View>
                          <Text style={[styles.materialName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                            {material.fileName || material.title || material.uri || (isPdf ? 'Course Outline' : 'File')}
                          </Text>
                          <TouchableOpacity onPress={() => handleRemoveMaterial(material.id)}>
                            <Icon name="close-circle" size={20} color={theme.colors.error} />
                          </TouchableOpacity>
                        </View>
                        {isLegacy && (
                          <Text style={{ color: theme.colors.textTertiary, fontSize: 11, marginBottom: 6, marginLeft: 4 }}>
                            Legacy file — remove it and upload a PDF outline instead
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.actionSection}>
          <AppButton
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.cancelBtn}
          />
          <AppButton
            title={isEditMode ? 'Update Course' : 'Create Course'}
            onPress={handleSubmit}
            variant="primary"
            style={styles.submitBtn}
            leftIcon={isEditMode ? 'save-outline' : 'checkmark'}
          />
        </Animated.View>
      </ScrollView>

      <AddMaterialModal
        visible={showAddMaterialModal}
        onClose={() => setShowAddMaterialModal(false)}
        onAddMaterial={handleAddMaterial}
        pdfOnly={true}
      />
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isLargeScreen, isTablet, isMobile) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: isMobile ? 16 : 24,
      paddingBottom: 40,
    },

    // Form Grid
    formGrid: {
      flexDirection: isTablet ? 'row' : 'column',
      gap: 20,
    },
    mainColumn: {
      flex: isTablet ? 2 : undefined,
      width: isTablet ? undefined : '100%',
      gap: 20,
    },
    sideColumn: {
      flex: isTablet ? 1 : undefined,
      width: isTablet ? undefined : '100%',
      gap: 20,
    },

    // Form Cards
    formCard: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
      padding: isMobile ? 16 : 20,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 0,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 0,
    },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitleBlock: {
      flex: 1,
    },
    sectionTitle: {      fontSize: 15,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: 1,
    },
    sectionSubtitle: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },
    sectionDivider: {
      height: 1,
      borderRadius: 1,
      marginVertical: 16,
    },

    // Options
    optionGroup: {
      marginBottom: 20,
    },
    optionLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 10,
      fontFamily: theme.typography.fontFamily.medium,
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    optionChip: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    optionChipText: {
      fontSize: 14,
      fontWeight: '500',
      fontFamily: theme.typography.fontFamily.medium,
    },

    // Thumbnail
    thumbnailPreviewContainer: {
      position: 'relative',
      height: 160,
      borderRadius: 12,
      overflow: 'hidden',
    },
    thumbnailPreview: {
      width: '100%',
      height: '100%',
    },
    removeThumbnailBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadPlaceholder: {
      height: 160,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    uploadIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    uploadText: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    uploadHint: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Materials
    addMaterialBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyMaterials: {
      padding: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      gap: 6,
    },
    emptyText: {
      fontSize: 13,
      fontWeight: '500',
      fontFamily: theme.typography.fontFamily.medium,
    },
    emptyHint: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },
    materialsList: {
      gap: 8,
    },
    materialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderLeftWidth: 3,
      gap: 10,
    },
    materialIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    materialName: {
      flex: 1,
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Prerequisites
    prereqDropdownBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      height: 50,
    },
    prereqDropdownText: {
      fontSize: 15,
      fontWeight: '500',
    },
    prereqClearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    prereqClearText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#EF4444',
    },
    prereqTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    prereqTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: '#10B981' + '18',
      borderWidth: 1,
      borderColor: '#10B981' + '40',
    },
    prereqTagText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#10B981',
      maxWidth: 140,
    },
    prereqModalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: 20,
    },
    prereqModalContent: {
      width: '90%',
      maxHeight: '75%',
      borderRadius: 20,
      borderWidth: 1,
      padding: 20,
    },
    prereqModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    prereqModalTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    prereqSearchInput: {
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 15,
      marginBottom: 12,
    },
    prereqModalItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
    },
    prereqModalItemText: {
      fontSize: 15,
      flex: 1,
      marginRight: 8,
    },
    prereqEmpty: {
      fontSize: 13,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 16,
    },
    prereqDoneBtn: {
      marginTop: 16,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
    },
    prereqDoneBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },

    // Creation Mode
    modeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 12,
      gap: 12,
    },
    modeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modeTextWrap: {
      flex: 1,
    },
    modeTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    modeSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },

    // Actions
    actionSection: {
      flexDirection: isMobile ? 'column-reverse' : 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 24,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : theme.colors.border,
    },
    cancelBtn: {
      minWidth: isMobile ? '100%' : 100,
    },
    submitBtn: {
      minWidth: isMobile ? '100%' : 160,
    },
  });

export default CreateCourseScreen;
