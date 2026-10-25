import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  useWindowDimensions,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MainLayout from '../../components/ui/MainLayout';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import AddMaterialModal from '../../components/AddMaterialModal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resolveFileUrl } from '../../utils/urlHelpers';
import { aiTutorAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';
import AppHeader from '../../components/ui/AppHeader';

const ORANGE = '#FF8C42';

const VM_INFO = {
  comparison_table: { label: 'Comparison Table', icon: 'grid-outline', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  whiteboard:       { label: 'Whiteboard', icon: 'easel-outline', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  code_editor:      { label: 'Code Editor', icon: 'code-slash-outline', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  image_board:      { label: 'Image Board', icon: 'image-outline', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
  guided_steps:     { label: 'Guided Steps', icon: 'footsteps-outline', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  narration:        { label: 'Narration', icon: 'mic-outline', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
  slide_summary:    { label: 'Slide Summary', icon: 'albums-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
};
const getVmInfo = (vm) =>
  VM_INFO[vm] || { label: vm || 'Slide', icon: 'albums-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };

// Mirror the backend resolveClassroomMode logic so the instructor sees the
// same visual the student will actually get during playback.
const resolveStudentVisualMode = (chunk) => {
  const stored = chunk.visualMode || 'none';
  // Diagram: actual nodes present (highest signal)
  if (chunk.diagramData?.nodes?.length) return 'diagram';
  if (stored === 'diagram' || stored === 'mixed') return 'diagram';
  // Code: explicit flag OR real snippet in visualData
  const hasCode = chunk.visualData?.codeExample?.snippet || chunk.visualData?.snippetData?.codeSnippet;
  if (stored === 'code' || hasCode) return 'code';
  // Flowchart / comparison / whiteboard / slide — honour stored value
  if (stored === 'flowchart') return 'flowchart';
  if (stored === 'comparison_table') return 'comparison_table';
  if (stored === 'whiteboard') return 'whiteboard';
  if (stored === 'slide' || stored === 'slide_summary') return 'slide';
  return stored || 'slide';
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
};

// Calculate actual speech duration from word count (130 wpm) — more accurate than GPT's estimate
const calcChunkDuration = (chunk) => {
  const text = chunk.spokenExplanation || '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words > 0) return Math.round(words / 130 * 60);
  return chunk.estimatedDurationSeconds || 0;
};

// Color palette for topic cards
const TOPIC_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#F59E0B', // Amber
];

const AddTopicsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId: rawCourseId, creationMode: routeCreationMode } = route.params;
  const courseId = typeof rawCourseId === 'string' ? parseInt(rawCourseId, 10) : rawCourseId;
  const { courses, addTopic, updateTopic, deleteTopic, fetchCourses, getCourseById } = useData();
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [localCourse, setLocalCourse] = useState(null);
  const course = localCourse || courses.find(c => c.id === courseId || c.id === rawCourseId);
  const creationMode = routeCreationMode || course?.creationMode || 'ai';
  const isManualMode = creationMode === 'manual';

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  // Check permissions
  const isOwner = course?.user?.id === user?.id;
  const isAdmin = user?.role === 'admin';
  const canManageAllCourses = user?.permissions?.canManageAllCourses === true;
  const canAddTopics = isOwner || isAdmin || canManageAllCourses;

  // State
  const [topicTitle, setTopicTitle] = useState('');
  const [topicMaterials, setTopicMaterials] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [selectedTopicMaterials, setSelectedTopicMaterials] = useState(null);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  const [showGenerationReportModal, setShowGenerationReportModal] = useState(false);
  const [generationReport, setGenerationReport] = useState([]);
  const [lectureMetaByTopic, setLectureMetaByTopic] = useState({});
  const [chunkModalTopic, setChunkModalTopic] = useState(null);
  const [chunkModalPackage, setChunkModalPackage] = useState(null);
  const [chunkModalLoading, setChunkModalLoading] = useState(false);
  const [topicPrompts, setTopicPrompts] = useState({});
  const [topicChunkCounts, setTopicChunkCounts] = useState({});
  const [topicChunkDurations, setTopicChunkDurations] = useState({});
  const [topicPromptModalTopic, setTopicPromptModalTopic] = useState(null);
  const [creatingFromOutline, setCreatingFromOutline] = useState(false);
  const [showOutlineConfirmDialog, setShowOutlineConfirmDialog] = useState(false);

  const topics = course?.topics || [];

  // Fetch this specific course directly so topics are always up-to-date
  // (DataContext courses array may not contain this course if pagination is active)
  const refreshCourse = async () => {
    const res = await getCourseById(courseId);
    if (res.success && res.course) setLocalCourse(res.course);
  };

  useEffect(() => {
    refreshCourse();
  }, [courseId]);

  useEffect(() => {
    let active = true;

    const loadLectureMeta = async () => {
      if (!courseId || isManualMode) return;

      try {
        const response = await aiTutorAPI.listLectures(courseId);
        if (!active || !response.success) return;

        setLectureMetaByTopic(
          (response.lectures || []).reduce((acc, lecture) => {
            acc[lecture.topicId] = lecture;
            return acc;
          }, {})
        );
      } catch (_) {
      }
    };

    loadLectureMeta();
    return () => {
      active = false;
    };
  }, [courseId, isManualMode, topics.length]);

  // Sidebar navigation items based on user role
  const sidebarItems = getSidebarItems(user?.role);

  // Calculate stats
  const stats = useMemo(() => {
    const totalTopics = topics.length;
    const totalMaterials = topics.reduce((acc, topic) => acc + (topic.materials?.length || 0), 0);
    const completedTopics = topics.filter(t => t.status === 'completed').length;
    return { totalTopics, totalMaterials, completedTopics };
  }, [topics]);

  // Get color for topic based on index
  const getTopicColor = (index) => {
    return TOPIC_COLORS[index % TOPIC_COLORS.length];
  };

  const normalizeQuizQuestions = (rawQuestions) => {
    if (Array.isArray(rawQuestions)) return rawQuestions;
    if (typeof rawQuestions === 'string') {
      try {
        const parsed = JSON.parse(rawQuestions);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  };

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

  const handleAddTopicMaterial = (newMaterial) => {
    setTopicMaterials((prev) => [...prev, newMaterial]);
  };

  const handleRemoveTopicMaterial = (id) => {
    setTopicMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleOpenAddModal = () => {
    setEditingTopic(null);
    setTopicTitle('');
    setTopicMaterials([]);
    setQuizQuestions([]);
    setShowAddModal(true);
  };

  const handleEditTopic = (topic) => {
    setEditingTopic(topic);
    setTopicTitle(topic.title);
    setTopicMaterials(topic.materials || []);
    const existingQuestions = normalizeQuizQuestions(topic.quizzes?.[0]?.questions);
    setQuizQuestions(
      existingQuestions.map((question, index) => ({
        id: question.id?.toString() || `${topic.id}-${index + 1}`,
        question: question.question || question.prompt || '',
        options: Array.isArray(question.options) ? question.options : ['', '', '', ''],
        correctAnswer: Number.isInteger(question.correctAnswer) ? question.correctAnswer : 0,
      }))
    );
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingTopic(null);
    setTopicTitle('');
    setTopicMaterials([]);
    setQuizQuestions([]);
  };

  // MCQ question helpers
  const handleAddQuestion = () => {
    setQuizQuestions(prev => [...prev, {
      id: Date.now().toString(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
    }]);
  };

  const handleUpdateQuestion = (qId, value) => {
    setQuizQuestions(prev => prev.map(q => q.id === qId ? { ...q, question: value } : q));
  };

  const handleUpdateOption = (qId, optIdx, value) => {
    setQuizQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const opts = [...q.options];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const handleSetCorrectAnswer = (qId, optIdx) => {
    setQuizQuestions(prev => prev.map(q => q.id === qId ? { ...q, correctAnswer: optIdx } : q));
  };

  const handleRemoveQuestion = (qId) => {
    setQuizQuestions(prev => prev.filter(q => q.id !== qId));
  };

  const handleViewMaterials = (topic) => {
    setSelectedTopicMaterials({
      title: topic.title,
      materials: topic.materials || [],
    });
    setShowMaterialsModal(true);
  };

  const handleOpenMaterial = (material) => {
    const fileUrl = resolveFileUrl(material.uri);

    if (Platform.OS === 'web') {
      window.open(fileUrl, '_blank');
    } else {
      Linking.openURL(fileUrl);
    }
  };

  const syncOutline = async (topicId, outlineText) => {
    if (!topicId || !outlineText?.trim() || isManualMode) {
      return;
    }

    try {
      await aiTutorAPI.updateOutline(topicId, outlineText.trim());
    } catch (error) {
      Toast.show({
        type: 'info',
        text1: 'Outline Not Synced',
        text2: error.message || 'The topic was saved, but the AI outline could not be updated yet.',
      });
    }
  };

  const handleSaveTopic = async () => {
    if (!topicTitle.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a topic title' });
      return;
    }

    if (isManualMode) {
      if (quizQuestions.length === 0) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Please add at least one quiz question' });
        return;
      }
      for (const q of quizQuestions) {
        if (!q.question.trim()) {
          Toast.show({ type: 'error', text1: 'Error', text2: 'All quiz questions must have text' });
          return;
        }
        if (q.options.some(opt => !opt.trim())) {
          Toast.show({ type: 'error', text1: 'Error', text2: 'All answer options must be filled in' });
          return;
        }
      }
    }

    const formattedMaterials = topicMaterials.map(material => ({
      type: material.type,
      uri: material.uri,
      title: material.fileName || material.uri,
      description: material.description || '',
    }));

    const formattedQuestions = isManualMode ? quizQuestions.map((q, i) => ({
      id: q.id || (i + 1).toString(),
      question: q.question.trim(),
      prompt: q.question.trim(),
      options: q.options.map(o => o.trim()),
      correctAnswer: q.correctAnswer,
    })) : undefined;

    if (editingTopic) {
      const result = await updateTopic(editingTopic.id, {
        title: topicTitle,
        materials: formattedMaterials,
        questions: formattedQuestions,
      });
      if (result.success) {
        await syncOutline(editingTopic.id, topicTitle);
        handleCloseModal();
        Toast.show({ type: 'success', text1: 'Success', text2: 'Topic updated successfully!' });
        await refreshCourse();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to update topic' });
      }
    } else {
      const result = await addTopic({
        courseId: courseId,
        title: topicTitle,
        materials: formattedMaterials,
        questions: formattedQuestions,
      });

      if (result.success) {
        await syncOutline(result.topic?.id, topicTitle);
        handleCloseModal();
        Toast.show({ type: 'success', text1: 'Success', text2: 'Topic added successfully!' });
        await refreshCourse();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to add topic' });
      }
    }
  };

  const handleDeleteClick = (topic) => {
    setTopicToDelete(topic);
    setShowDeleteDialog(true);
  };

  const confirmDeleteTopic = async () => {
    setShowDeleteDialog(false);
    if (topicToDelete) {
      const result = await deleteTopic(topicToDelete.id);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Topic deleted successfully!',
        });
        await refreshCourse();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.error || 'Failed to delete topic',
        });
      }
      setTopicToDelete(null);
    }
  };

  const handleTopicCardPress = async (topic) => {
    setChunkModalTopic(topic);
    setChunkModalPackage(null);
    setChunkModalLoading(true);
    try {
      const data = await aiTutorAPI.getLecturePackage(topic.id);
      setChunkModalPackage(data);
    } catch (_) {
      Toast.show({ type: 'error', text1: 'Failed to load topic content' });
    } finally {
      setChunkModalLoading(false);
    }
  };

  const handleGenerateTopic = (topic) => {
    const parts = [];
    const chunkCount = topicChunkCounts[topic.id];
    const durationMin = topicChunkDurations[topic.id];
    if (chunkCount) parts.push(`Generate exactly ${chunkCount} chunks total across all sections.`);
    if (durationMin) parts.push(`Make each chunk ${durationMin} minute${durationMin !== 1 ? 's' : ''} long.`);
    const extraText = topicPrompts[topic.id]?.trim();
    if (extraText) parts.push(extraText);
    const customPrompt = parts.length > 0 ? parts.join(' ') : null;
    navigation.navigate('GenerationLogs', {
      courseId,
      courseTitle: course?.name || 'Course',
      topicId: topic.id,
      topicTitle: topic.title,
      customPrompt,
    });
  };

  const handleGenerateWithPrompt = () => {
    if (!topicPromptModalTopic) return;
    const topic = topicPromptModalTopic;
    setTopicPromptModalTopic(null);
    handleGenerateTopic(topic);
  };

  const handleCreateTopicsFromOutline = () => {
    if (topics.length > 0) {
      setShowOutlineConfirmDialog(true);
    } else {
      runCreateTopicsFromOutline();
    }
  };

  const runCreateTopicsFromOutline = () => {
    navigation.navigate('GenerationLogs', {
      courseId,
      courseTitle: course?.name || 'Course',
      fromOutline: true,
    });
  };


  const handleSubmitForAI = () => {
    if (topics.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please add at least one topic',
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmSubmitForAI = () => {
    setShowConfirmDialog(false);
    navigation.navigate('GenerationLogs', {
      courseId,
      courseTitle: course?.name || 'Course',
    });
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile, isManualMode);

  const renderTopicCard = (topic, index) => {
    const color = getTopicColor(index);
    const materialsCount = topic.materials?.length || 0;
    const lectureMeta = lectureMetaByTopic[topic.id];

    const cardContent = (
      <View
        style={[
          styles.topicCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
            borderLeftColor: color,
            borderLeftWidth: 3,
          },
        ]}
      >
          {/* Top Right Section - Materials Count & Actions */}
          <View style={styles.topRightSection}>
            <View style={[styles.materialsCountBadge, { backgroundColor: color + '15', borderColor: color + '30' }]}>
              <Text style={[styles.materialsCountNumber, { color }]}>
                {materialsCount}
              </Text>
              <Text style={[styles.materialsCountLabel, { color: theme.colors.textSecondary }]}>
                mats
              </Text>
            </View>
            {canAddTopics && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.colors.primary + '15' }]}
                  onPress={(e) => { e.stopPropagation?.(); handleEditTopic(topic); }}
                >
                  <Icon name="create-outline" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: theme.colors.error + '15' }]}
                  onPress={(e) => { e.stopPropagation?.(); handleDeleteClick(topic); }}
                >
                  <Icon name="trash-outline" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Large Topic Number */}
          <View style={[styles.topicNumberContainer, { backgroundColor: color + '15' }]}>
            <Text style={[styles.topicNumberLarge, { color }]}>
              {String(index + 1).padStart(2, '0')}
            </Text>
          </View>

          {/* Per-topic AI generate + prompt buttons */}
          {!isManualMode && canAddTopics && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.generateTopicBtn, { flex: 1, marginTop: 0, backgroundColor: color + '15', borderColor: color + '40' }]}
                onPress={(e) => { e.stopPropagation?.(); handleGenerateTopic(topic); }}
              >
                <Icon name="sparkles-outline" size={14} color={color} />
                <Text style={[styles.generateTopicBtnText, { color }]}>Generate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.generateTopicBtn,
                  { marginTop: 0 },
                  (topicPrompts[topic.id]?.trim() || topicChunkCounts[topic.id] || topicChunkDurations[topic.id])
                    ? { backgroundColor: ORANGE, borderColor: ORANGE }
                    : { backgroundColor: ORANGE + '18', borderColor: ORANGE + '50' },
                ]}
                onPress={(e) => { e.stopPropagation?.(); setTopicPromptModalTopic(topic); }}
              >
                <Icon name="chatbubble-ellipses-outline" size={14} color={(topicPrompts[topic.id]?.trim() || topicChunkCounts[topic.id] || topicChunkDurations[topic.id]) ? '#fff' : ORANGE} />
                <Text style={[styles.generateTopicBtnText, { color: (topicPrompts[topic.id]?.trim() || topicChunkCounts[topic.id] || topicChunkDurations[topic.id]) ? '#fff' : ORANGE }]}>
                  {(topicPrompts[topic.id]?.trim() || topicChunkCounts[topic.id] || topicChunkDurations[topic.id]) ? 'Prompt ✓' : 'Prompt'}
                </Text>
              </TouchableOpacity>
            </View>
          )}


          {/* Topic Title */}
          <Text style={[styles.topicName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
            {topic.title}
          </Text>

          {!isManualMode && lectureMeta?.status === 'ready' && (
            <View style={[styles.viewMaterialsBtn, { backgroundColor: color + '10', borderColor: color + '30', marginBottom: 10 }]}>
              <Icon name="sparkles-outline" size={16} color={color} />
              <Text style={[styles.viewMaterialsText, { color }]}>
                {`${lectureMeta.estimatedDurationMinutes || 0} min AI lecture`}
              </Text>
            </View>
          )}

          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <StatusBadge status={topic.status || 'pending'} />
          </View>

          {/* View Materials Button */}
          {materialsCount > 0 && (
            <TouchableOpacity
              style={[styles.viewMaterialsBtn, { backgroundColor: color + '10', borderColor: color + '30' }]}
              onPress={(e) => { e.stopPropagation?.(); handleViewMaterials(topic); }}
            >
              <Icon name="folder-open-outline" size={16} color={color} />
              <Text style={[styles.viewMaterialsText, { color }]}>
                View Materials
              </Text>
            </TouchableOpacity>
          )}
      </View>
    );

    return (
      <Animated.View
        key={topic.id}
        entering={FadeInDown.duration(400).delay(index * 80)}
        style={styles.topicCardWrapper}
      >
        {!isManualMode ? (
          <TouchableOpacity onPress={() => handleTopicCardPress(topic)} activeOpacity={0.85}>
            {cardContent}
          </TouchableOpacity>
        ) : cardContent}
      </Animated.View>
    );
  };

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
            <Icon name="list" size={22} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
              Add Topics
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
              Build your course curriculum
            </Text>
          </View>
          {canAddTopics && (
            <TouchableOpacity
              style={{
                backgroundColor: ORANGE,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                ...(Platform.OS === 'web' && { boxShadow: '0 2px 12px rgba(255,140,66,0.35)' }),
              }}
              onPress={handleOpenAddModal}
            >
              <Icon name="add" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Add Topic</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Permission Warning */}
        {!canAddTopics && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={[styles.permissionBox, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '30' }]}>
              <Icon name="lock-closed" size={22} color={theme.colors.warning} />
              <Text style={[styles.permissionText, { color: theme.colors.warning }]}>
                You don't have permission to manage topics. Only the course creator or instructors with proper permissions can add/edit topics.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Make Topics Automatically Banner */}
        {canAddTopics && (() => {
          const outlineMaterial = (course?.materials || []).find(m => !m.topicId && m.type === 'pdf' && m.extractedText);
          if (!outlineMaterial) return null;
          return (
            <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 20 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)',
                borderColor: 'rgba(99,102,241,0.25)',
                borderWidth: 1,
                borderRadius: 14,
                padding: 16,
              }}>
                <View style={{ backgroundColor: '#6366F120', borderRadius: 10, padding: 10 }}>
                  <Icon name="document-text-outline" size={22} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                    Course outline detected
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    AI can read your outline PDF and create all topics automatically
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#6366F1',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    opacity: creatingFromOutline ? 0.7 : 1,
                    ...(Platform.OS === 'web' && { boxShadow: '0 2px 10px rgba(99,102,241,0.4)' }),
                  }}
                  onPress={handleCreateTopicsFromOutline}
                  disabled={creatingFromOutline}
                >
                  {creatingFromOutline
                    ? <Icon name="hourglass-outline" size={16} color="#fff" />
                    : <Icon name="sparkles-outline" size={16} color="#fff" />
                  }
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    {creatingFromOutline ? 'Creating...' : 'Make Topics'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })()}

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={[styles.statCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
              <Icon name="list" size={20} color="#6366F1" />
            </View>
            <Text style={[styles.statValue, { color: '#6366F1' }]}>{stats.totalTopics}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Topics</Text>
          </View>
          <View style={[styles.statCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(6,182,212,0.12)' }]}>
              <Icon name="folder-open" size={20} color="#06B6D4" />
            </View>
            <Text style={[styles.statValue, { color: '#06B6D4' }]}>{stats.totalMaterials}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Materials</Text>
          </View>
          <View style={[styles.statCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
          }]}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Icon name="checkmark-circle" size={20} color="#10B981" />
            </View>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.completedTopics}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Completed</Text>
          </View>
        </View>

        {/* Info Banner */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          <View style={[styles.infoBox, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}>
            <Icon name={isManualMode ? 'videocam' : 'sparkles'} size={22} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.primary }]}>
              {isManualMode
                ? 'Manual mode: add YouTube links, PDFs, and files to each topic. Topics unlock sequentially for students.'
                : 'AI mode: add topic titles, then click "Generate Full Course" to auto-generate materials.'}
            </Text>
          </View>
        </Animated.View>

        {/* Topics Grid */}
        {topics.length > 0 ? (
          <View style={styles.topicsGrid}>
            {topics.map((topic, index) => renderTopicCard(topic, index))}
          </View>
        ) : (
          <View style={[styles.emptyContainer, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
          }]}>
            <EmptyState
              icon="list-outline"
              title="No topics yet"
              subtitle="Add your first topic to start building your course"
              actionLabel={canAddTopics ? "Add Topic" : undefined}
              onAction={canAddTopics ? handleOpenAddModal : undefined}
            />
          </View>
        )}

        {/* Bottom Action Button */}
        {topics.length > 0 && canAddTopics && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            {isManualMode ? (
              <AppButton
                title="Finish — Go to Courses"
                onPress={() => navigation.navigate('Courses')}
                variant="primary"
                style={styles.aiButton}
                leftIcon="checkmark-done"
              />
            ) : (
              <AppButton
                title="Generate Full Course"
                onPress={handleSubmitForAI}
                variant="primary"
                style={styles.aiButton}
                leftIcon="sparkles"
              />
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Add/Edit Topic Modal — Glassmorphic */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
        }}>
          <View style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '85%',
            backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            padding: 28,
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
          }}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ backgroundColor: ORANGE + '20', borderRadius: 10, padding: 10 }}>
                  <Icon name="attach" size={20} color={ORANGE} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    {editingTopic ? 'Edit Topic' : 'Add New Topic'}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                    {editingTopic ? 'Update topic details' : 'Create a new topic for your course'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseButton, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                  borderRadius: 10,
                  padding: 8,
                }]}
                onPress={handleCloseModal}
              >
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={[styles.modalBodyScroll, { maxHeight: isManualMode ? 500 : 400 }]} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <AppInput
                  label="Topic Title *"
                  value={topicTitle}
                  onChangeText={setTopicTitle}
                  placeholder="e.g., Introduction to Variables"
                />

                {/* Materials Section */}
                <View style={styles.materialsSection}>
                  <View style={styles.materialHeader}>
                    <Text style={[styles.materialLabel, { color: theme.colors.textPrimary }]}>
                      Materials ({topicMaterials.length})
                    </Text>
                    <TouchableOpacity
                      style={[styles.addMaterialBtn, { backgroundColor: ORANGE + '18', borderColor: ORANGE + '30', borderWidth: 1 }]}
                      onPress={() => setShowAddMaterialModal(true)}
                    >
                      <Icon name="add" size={18} color={ORANGE} />
                      <Text style={[styles.addMaterialText, { color: ORANGE }]}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {topicMaterials.length === 0 ? (
                    <View style={[styles.emptyMaterials, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.border }]}>
                      <Icon name="folder-open-outline" size={24} color={theme.colors.textTertiary} />
                      <Text style={[styles.emptyMaterialsText, { color: theme.colors.textSecondary }]}>
                        No materials added
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.materialsList}>
                      {topicMaterials.map((material) => (
                        <View
                          key={material.id}
                          style={[styles.materialItem, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                          }]}
                        >
                          <Icon
                            name={
                              material.type === 'pdf' ? 'document-text-outline'
                              : material.type === 'image' ? 'image-outline'
                              : material.type === 'link' ? 'logo-youtube'
                              : 'code-slash-outline'
                            }
                            size={18}
                            color={material.type === 'link' ? '#FF0000' : theme.colors.primary}
                          />
                          <Text style={[styles.materialName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                            {material.fileName || material.uri || 'Material'}
                          </Text>
                          <TouchableOpacity onPress={() => handleRemoveTopicMaterial(material.id)}>
                            <Icon name="close-circle" size={20} color={theme.colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* MCQ Quiz Section — Manual Mode Only */}
                {isManualMode && (
                  <View style={styles.mcqSection}>
                    <View style={[styles.mcqSectionHeader, { borderColor: theme.colors.primary + '30', backgroundColor: theme.colors.primary + '08' }]}>
                      <Icon name="help-circle" size={18} color={theme.colors.primary} />
                      <Text style={[styles.mcqSectionTitle, { color: theme.colors.primary }]}>
                        Quiz Questions (Required)
                      </Text>
                      <TouchableOpacity
                        style={[styles.addQuestionBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={handleAddQuestion}
                      >
                        <Icon name="add" size={16} color="#fff" />
                        <Text style={styles.addQuestionBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>

                    {quizQuestions.length === 0 ? (
                      <View style={[styles.emptyMaterials, { borderColor: theme.colors.warning + '50' }]}>
                        <Icon name="alert-circle-outline" size={22} color={theme.colors.warning} />
                        <Text style={[styles.emptyMaterialsText, { color: theme.colors.warning }]}>
                          At least 1 MCQ question required
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.questionsList}>
                        {quizQuestions.map((q, qIdx) => (
                          <View
                            key={q.id}
                            style={[styles.questionCard, {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.03)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                            }]}
                          >
                            <View style={styles.questionCardHeader}>
                              <Text style={[styles.questionCardNum, { color: theme.colors.primary }]}>Q{qIdx + 1}</Text>
                              <TouchableOpacity onPress={() => handleRemoveQuestion(q.id)}>
                                <Icon name="close-circle" size={20} color={theme.colors.error} />
                              </TouchableOpacity>
                            </View>
                            <AppInput
                              value={q.question}
                              onChangeText={(val) => handleUpdateQuestion(q.id, val)}
                              placeholder="Enter question text..."
                              multiline
                              numberOfLines={2}
                            />
                            <Text style={[styles.optionsLabel, { color: theme.colors.textSecondary }]}>
                              Options (tap letter to mark correct answer):
                            </Text>
                            {q.options.map((opt, optIdx) => (
                              <View key={optIdx} style={styles.optionRow}>
                                <TouchableOpacity
                                  style={[
                                    styles.optionLetterBtn,
                                    {
                                      backgroundColor: q.correctAnswer === optIdx ? theme.colors.success : theme.colors.surface,
                                      borderColor: q.correctAnswer === optIdx ? theme.colors.success : theme.colors.border,
                                    }
                                  ]}
                                  onPress={() => handleSetCorrectAnswer(q.id, optIdx)}
                                >
                                  <Text style={[styles.optionLetterText, { color: q.correctAnswer === optIdx ? '#fff' : theme.colors.textSecondary }]}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </Text>
                                </TouchableOpacity>
                                <View style={styles.optionInputWrap}>
                                  <AppInput
                                    value={opt}
                                    onChangeText={(val) => handleUpdateOption(q.id, optIdx, val)}
                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                  />
                                </View>
                              </View>
                            ))}
                            <Text style={[styles.correctHint, { color: theme.colors.success }]}>
                              ✓ Correct: Option {String.fromCharCode(65 + q.correctAnswer)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)' }]}>
              <AppButton
                title="Cancel"
                onPress={handleCloseModal}
                variant="outline"
                style={styles.modalCancelButton}
              />
              <AppButton
                title={editingTopic ? 'Update Topic' : 'Add Topic'}
                onPress={handleSaveTopic}
                variant="primary"
                style={styles.modalCreateButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* View Materials Modal — Glassmorphic */}
      <Modal
        visible={showMaterialsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMaterialsModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
        }}>
          <View style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '85%',
            backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            padding: 28,
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
          }}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ backgroundColor: '#06B6D4' + '20', borderRadius: 10, padding: 10 }}>
                  <Icon name="folder-open" size={20} color="#06B6D4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    Topic Materials
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {selectedTopicMaterials?.title}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseButton, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                  borderRadius: 10,
                  padding: 8,
                }]}
                onPress={() => setShowMaterialsModal(false)}
              >
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Materials List */}
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                {selectedTopicMaterials?.materials?.length > 0 ? (
                  <View style={styles.viewMaterialsList}>
                    {selectedTopicMaterials.materials.map((material, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.viewMaterialItem, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                        }]}
                        onPress={() => handleOpenMaterial(material)}
                      >
                        <View style={[styles.materialIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                          <Icon
                            name={
                              material.type === 'pdf' ? 'document-text'
                              : material.type === 'image' ? 'image'
                              : material.type === 'link' ? 'logo-youtube'
                              : 'code-slash'
                            }
                            size={24}
                            color={material.type === 'link' ? '#FF0000' : theme.colors.primary}
                          />
                        </View>
                        <View style={styles.materialInfo}>
                          <Text style={[styles.materialTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                            {material.title || material.fileName || 'Material'}
                          </Text>
                          <Text style={[styles.materialType, { color: theme.colors.textSecondary }]}>
                            {material.type === 'link' ? (material.isYoutube ? 'YOUTUBE VIDEO' : 'EXTERNAL LINK') : (material.type?.toUpperCase() || 'FILE')}
                          </Text>
                        </View>
                        <View style={[styles.downloadIcon, { backgroundColor: (material.type === 'link' ? theme.colors.primary : theme.colors.success) + '15' }]}>
                          <Icon
                            name={material.type === 'link' ? 'open-outline' : 'download-outline'}
                            size={20}
                            color={material.type === 'link' ? theme.colors.primary : theme.colors.success}
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noMaterialsContainer}>
                    <Icon name="folder-open-outline" size={48} color={theme.colors.textTertiary} />
                    <Text style={[styles.noMaterialsText, { color: theme.colors.textSecondary }]}>
                      No materials available
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)' }]}>
              <AppButton
                title="Close"
                onPress={() => setShowMaterialsModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Material Modal */}
      <AddMaterialModal
        visible={showAddMaterialModal}
        onClose={() => setShowAddMaterialModal(false)}
        onAddMaterial={handleAddTopicMaterial}
        pdfOnly={!isManualMode}
      />

      <Modal
        visible={showGenerationReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGenerationReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.reportModalContent, { backgroundColor: isDark ? theme.colors.card : theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                  AI Generation Report
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                  Exact per-topic generation results for this course.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowGenerationReportModal(false)}
              >
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.reportList}>
                {generationReport.map((item, index) => (
                  <View
                    key={`${item.topicId}-${index}`}
                    style={[
                      styles.reportItem,
                      {
                        backgroundColor: isDark ? theme.colors.backgroundSecondary : theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={styles.reportHeader}>
                      <Text style={[styles.reportTopicTitle, { color: theme.colors.textPrimary }]}>
                        {item.topicTitle || `Topic ${index + 1}`}
                      </Text>
                      <StatusBadge status={item.displayStatus || item.status || 'info'} />
                    </View>
                    <Text style={[styles.reportMessage, { color: theme.colors.textSecondary }]}>
                      {item.displayMessage}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <AppButton
                title="Close"
                onPress={() => setShowGenerationReportModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={showDeleteDialog}
        title="Delete Topic"
        message={`Are you sure you want to delete "${topicToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={confirmDeleteTopic}
        onCancel={() => {
          setShowDeleteDialog(false);
          setTopicToDelete(null);
        }}
      />

      {/* Outline Topic Creation Confirmation */}
      <ConfirmDialog
        visible={showOutlineConfirmDialog}
        title="Replace Existing Topics?"
        message={`This course already has ${topics.length} topic${topics.length !== 1 ? 's' : ''}. All existing topics and their AI-generated content will be permanently deleted and replaced with topics from the outline. This cannot be undone.`}
        confirmText="Delete & Recreate"
        confirmVariant="danger"
        onConfirm={() => { setShowOutlineConfirmDialog(false); runCreateTopicsFromOutline(); }}
        onCancel={() => setShowOutlineConfirmDialog(false)}
      />

      {/* AI Generation Confirmation */}
      <ConfirmDialog
        visible={showConfirmDialog}
        title="Generate with AI"
        message="This will trigger AI content generation for all topics. Continue?"
        confirmText="Generate"
        confirmVariant="primary"
        onConfirm={confirmSubmitForAI}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {/* AI Topic Chunks Detail Modal */}
      <Modal
        visible={!!chunkModalTopic}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setChunkModalTopic(null)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* App Header — same as every other screen */}
          <AppHeader
            navItems={sidebarItems}
            activeRoute="Courses"
            onNavigate={handleNavigate}
            forceShowBack={true}
            onBack={() => setChunkModalTopic(null)}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: isMobile ? 16 : 24, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Page Banner */}
            <View style={{
              backgroundColor: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.05)',
              borderColor: 'rgba(139,92,246,0.18)',
              borderRadius: 16,
              borderWidth: 1,
              padding: 20,
              marginBottom: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}>
              <View style={{ backgroundColor: '#8B5CF6' + '20', borderRadius: 12, padding: 12 }}>
                <Icon name="sparkles" size={22} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800', fontFamily: theme.typography.fontFamily.bold }} numberOfLines={1}>
                  {chunkModalTopic?.title}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.typography.fontFamily.regular }}>
                  AI-Generated Topic Content
                </Text>
              </View>
            </View>

            {/* Topic Info Card */}
            <View style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
              padding: 20,
              marginBottom: 20,
              gap: 16,
              ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
            }}>
              {/* Card section header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#8B5CF6' + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="document-text-outline" size={18} color="#8B5CF6" />
                </View>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold }}>
                  Topic Details
                </Text>
              </View>

              {/* Materials */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Materials ({chunkModalTopic?.materials?.length || 0})
                </Text>
                {chunkModalTopic?.materials?.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {chunkModalTopic.materials.map((mat, mi) => {
                      const isPdf = mat.type === 'pdf';
                      const isLink = mat.type === 'link';
                      const matColor = isPdf ? '#EF4444' : isLink ? '#FF0000' : '#06B6D4';
                      const matIcon = isPdf ? 'document-text-outline' : isLink ? 'logo-youtube' : 'image-outline';
                      return (
                        <TouchableOpacity
                          key={mi}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.03)',
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
                          }}
                          onPress={() => {
                            const url = resolveFileUrl(mat.uri || mat.url);
                            if (url) Platform.OS === 'web' ? window.open(url, '_blank') : Linking.openURL(url);
                          }}
                        >
                          <View style={{ backgroundColor: matColor + '18', borderRadius: 10, padding: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
                            <Icon name={matIcon} size={18} color={matColor} />
                          </View>
                          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: 13, fontFamily: theme.typography.fontFamily.regular }} numberOfLines={1}>
                            {mat.title || mat.fileName || 'Material'}
                          </Text>
                          <View style={{ backgroundColor: matColor + '18', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: matColor, fontSize: 10, fontWeight: '700', fontFamily: theme.typography.fontFamily.semiBold }}>
                              {mat.type?.toUpperCase()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,26,46,0.03)',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.06)',
                    borderStyle: 'dashed',
                  }}>
                    <Icon name="folder-open-outline" size={18} color={theme.colors.textTertiary} />
                    <Text style={{ color: theme.colors.textTertiary, fontSize: 13, fontStyle: 'italic', fontFamily: theme.typography.fontFamily.regular }}>
                      No materials attached
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Chunks Section Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#8B5CF6' + '18', justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="layers-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold }}>
                AI-Generated Chunks
              </Text>
              {chunkModalPackage?.lecture && (() => {
                const totalSecs = (chunkModalPackage.lecture.sections || []).reduce((sum, c) => sum + calcChunkDuration(c), 0);
                const label = totalSecs > 0
                  ? formatDuration(totalSecs)
                  : chunkModalPackage.lecture.estimatedDurationMinutes
                    ? `~${chunkModalPackage.lecture.estimatedDurationMinutes}m`
                    : null;
                if (!label) return null;
                return (
                  <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#8B5CF6' + '18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Icon name="time-outline" size={12} color="#8B5CF6" />
                    <Text style={{ color: '#8B5CF6', fontSize: 12, fontWeight: '700', fontFamily: theme.typography.fontFamily.semiBold }}>
                      {label} total
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Chunks Content */}
            {chunkModalLoading ? (
              <View style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                padding: 48,
                alignItems: 'center',
                gap: 14,
                ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
              }}>
                <View style={{ backgroundColor: '#8B5CF6' + '18', borderRadius: 20, padding: 20 }}>
                  <Icon name="sparkles-outline" size={32} color="#8B5CF6" />
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.typography.fontFamily.regular }}>
                  Loading AI content...
                </Text>
              </View>
            ) : !chunkModalPackage?.lecture ? (
              <View style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                padding: 40,
                alignItems: 'center',
                gap: 12,
                ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
              }}>
                <View style={{ backgroundColor: '#F59E0B' + '18', borderRadius: 16, padding: 18 }}>
                  <Icon name="time-outline" size={32} color="#F59E0B" />
                </View>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold }}>
                  Not Generated Yet
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', fontFamily: theme.typography.fontFamily.regular, lineHeight: 20 }}>
                  Tap "Generate Topic" on the topic card to generate AI content for this topic.
                </Text>
              </View>
            ) : (() => {
              const sections = (chunkModalPackage.lecture.sections || [])
                .slice()
                .sort((a, b) => a.sectionIndex !== b.sectionIndex ? a.sectionIndex - b.sectionIndex : a.chunkIndex - b.chunkIndex);

              if (sections.length === 0) return (
                <View style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                  padding: 32,
                  alignItems: 'center',
                }}>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: 13, fontStyle: 'italic', fontFamily: theme.typography.fontFamily.regular }}>
                    No chunks found in this lecture.
                  </Text>
                </View>
              );

              return sections.map((chunk, ci) => {
                const resolvedMode = resolveStudentVisualMode(chunk);
                const vm = getVmInfo(resolvedMode);
                const storedModeOverridden = resolvedMode !== (chunk.visualMode || 'none');
                const bullets = Array.isArray(chunk.slideBullets) ? chunk.slideBullets : [];
                const hasDivider = bullets.length > 0 || chunk.spokenExplanation || chunk.summary;
                return (
                  <View
                    key={chunk.id || ci}
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
                      borderLeftWidth: 3,
                      borderLeftColor: vm.color,
                      marginBottom: 12,
                      overflow: 'hidden',
                      ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
                    }}
                  >
                    {/* Chunk Header */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 16,
                      borderBottomWidth: hasDivider ? 1 : 0,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)',
                    }}>
                      <View style={{ backgroundColor: vm.bg, borderRadius: 10, padding: 9, width: 38, height: 38, justifyContent: 'center', alignItems: 'center' }}>
                        <Icon name={vm.icon} size={18} color={vm.color} />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, lineHeight: 20 }}>
                          {chunk.title || `Chunk ${ci + 1}`}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <View style={{ backgroundColor: vm.bg, borderWidth: 1, borderColor: vm.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Icon name={vm.icon} size={9} color={vm.color} />
                            <Text style={{ color: vm.color, fontSize: 10, fontWeight: '700', fontFamily: theme.typography.fontFamily.semiBold }}>{vm.label}</Text>
                          </View>
                          {storedModeOverridden && (
                            <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Icon name="swap-horizontal-outline" size={9} color="#6366F1" />
                              <Text style={{ color: '#6366F1', fontSize: 10, fontWeight: '600' }}>was {chunk.visualMode}</Text>
                            </View>
                          )}
                          {bullets.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Icon name="list-outline" size={11} color={theme.colors.textTertiary} />
                              <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontFamily: theme.typography.fontFamily.regular }}>
                                {bullets.length} bullets
                              </Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Icon name="layers-outline" size={11} color={theme.colors.textTertiary} />
                            <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontFamily: theme.typography.fontFamily.regular }}>
                              §{chunk.sectionIndex + 1} · {chunk.chunkIndex + 1}
                            </Text>
                          </View>
                          {!!formatDuration(calcChunkDuration(chunk)) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Icon name="time-outline" size={11} color={theme.colors.textTertiary} />
                              <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontFamily: theme.typography.fontFamily.regular }}>
                                {formatDuration(calcChunkDuration(chunk))}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Key Points / Bullets */}
                    {bullets.length > 0 && (
                      <View style={{
                        padding: 16,
                        gap: 8,
                        borderBottomWidth: (chunk.spokenExplanation || chunk.summary) ? 1 : 0,
                        borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)',
                      }}>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                          Key Points
                        </Text>
                        {bullets.map((b, bi) => (
                          <View key={bi} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: vm.color, marginTop: 7, flexShrink: 0 }} />
                            <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: theme.typography.fontFamily.regular }}>
                              {typeof b === 'string' ? b : b.text || b.content || JSON.stringify(b)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Explanation / Summary */}
                    {(chunk.spokenExplanation || chunk.summary) && (
                      <View style={{ padding: 16, gap: 6 }}>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {chunk.spokenExplanation ? 'Explanation' : 'Summary'}
                        </Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 21, fontStyle: 'italic', fontFamily: theme.typography.fontFamily.regular }}>
                          {chunk.spokenExplanation || chunk.summary}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              });
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* Custom Prompt Modal */}
      <Modal
        visible={!!topicPromptModalTopic}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTopicPromptModalTopic(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
        }}>
          <View style={{
            width: '100%',
            maxWidth: 480,
            backgroundColor: isDark ? 'rgba(15,15,30,0.96)' : 'rgba(255,255,255,0.97)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            padding: 28,
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
          }}>
            {/* Header */}
            <View style={[styles.modalHeader, { marginBottom: 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ backgroundColor: ORANGE + '20', borderRadius: 10, padding: 10 }}>
                  <Icon name="sparkles-outline" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    Generate Topic
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {topicPromptModalTopic?.title || ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                  borderRadius: 10,
                  padding: 8,
                }}
                onPress={() => setTopicPromptModalTopic(null)}
              >
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Chunk Count */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                Number of chunks <Text style={{ fontWeight: '400', color: theme.colors.textTertiary }}>(optional)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (!topicPromptModalTopic) return;
                    const cur = topicChunkCounts[topicPromptModalTopic.id] || 0;
                    setTopicChunkCounts(prev => ({ ...prev, [topicPromptModalTopic.id]: Math.max(0, cur - 1) || undefined }));
                  }}
                  style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.15)', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)' }}
                >
                  <Icon name="remove" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
                    {topicPromptModalTopic && topicChunkCounts[topicPromptModalTopic.id] ? topicChunkCounts[topicPromptModalTopic.id] : '—'}
                  </Text>
                  {topicPromptModalTopic && topicChunkCounts[topicPromptModalTopic.id] ? (
                    <Text style={{ color: theme.colors.textTertiary, fontSize: 11 }}>chunks total</Text>
                  ) : (
                    <Text style={{ color: theme.colors.textTertiary, fontSize: 11 }}>AI decides</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!topicPromptModalTopic) return;
                    const cur = topicChunkCounts[topicPromptModalTopic.id] || 0;
                    setTopicChunkCounts(prev => ({ ...prev, [topicPromptModalTopic.id]: Math.min(20, cur + 1) }));
                  }}
                  style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: ORANGE + '60', alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE + '15' }}
                >
                  <Icon name="add" size={18} color={ORANGE} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Duration per Chunk */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  Duration per chunk <Text style={{ fontWeight: '400', color: theme.colors.textTertiary }}>(optional)</Text>
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98118', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Icon name="checkmark-circle-outline" size={11} color="#10B981" />
                  <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '700' }}>Safe up to 5 min</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (!topicPromptModalTopic) return;
                    const cur = topicChunkDurations[topicPromptModalTopic.id] || 0;
                    setTopicChunkDurations(prev => ({ ...prev, [topicPromptModalTopic.id]: Math.max(0, cur - 1) || undefined }));
                  }}
                  style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.15)', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)' }}
                >
                  <Icon name="remove" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  {topicPromptModalTopic && topicChunkDurations[topicPromptModalTopic.id] ? (
                    <>
                      <Text style={{ color: topicChunkDurations[topicPromptModalTopic.id] >= 5 ? '#F59E0B' : theme.colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
                        {topicChunkDurations[topicPromptModalTopic.id]} min
                      </Text>
                      {topicChunkDurations[topicPromptModalTopic.id] >= 5 && (
                        <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '600' }}>at safe limit</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' }}>—</Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: 11 }}>AI decides</Text>
                    </>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!topicPromptModalTopic) return;
                    const cur = topicChunkDurations[topicPromptModalTopic.id] || 0;
                    setTopicChunkDurations(prev => ({ ...prev, [topicPromptModalTopic.id]: Math.min(5, cur + 1) }));
                  }}
                  style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: ORANGE + '60', alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE + '15' }}
                >
                  <Icon name="add" size={18} color={ORANGE} />
                </TouchableOpacity>
              </View>
              {topicPromptModalTopic && topicChunkDurations[topicPromptModalTopic.id] >= 5 && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#F59E0B15', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F59E0B30' }}>
                  <Icon name="warning-outline" size={13} color="#F59E0B" style={{ marginTop: 1 }} />
                  <Text style={{ color: '#F59E0B', fontSize: 11, flex: 1, lineHeight: 16 }}>
                    5 min is the maximum. Higher values are automatically capped to avoid generation failures caused by GPT output limits.
                  </Text>
                </View>
              )}
            </View>

            {/* Additional Instructions */}
            <View style={{ marginBottom: 4 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                Additional instructions <Text style={{ fontWeight: '400', color: theme.colors.textTertiary }}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.topicPromptInput, {
                  color: theme.colors.textPrimary,
                  borderColor: isDark ? 'rgba(255,140,66,0.35)' : 'rgba(255,140,66,0.3)',
                  backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.04)',
                }]}
                placeholder="e.g. Focus on practical examples, use simple language, include a real-world use case..."
                placeholderTextColor={theme.colors.textSecondary}
                value={topicPromptModalTopic ? (topicPrompts[topicPromptModalTopic.id] || '') : ''}
                onChangeText={(text) => {
                  if (!topicPromptModalTopic) return;
                  setTopicPrompts(prev => ({ ...prev, [topicPromptModalTopic.id]: text }));
                }}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Footer */}
            <View style={[styles.modalFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)', marginTop: 20 }]}>
              <TouchableOpacity
                style={[styles.modalCancelButton, {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.15)',
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                }]}
                onPress={() => setTopicPromptModalTopic(null)}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: ORANGE,
                  borderRadius: 12,
                  paddingVertical: 13,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={handleGenerateWithPrompt}
              >
                <Icon name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </MainLayout>
  );
};

const getStyles = (theme, isDark, isLargeScreen, isTablet, isMobile, isManualMode) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: isMobile ? 16 : 24,
      paddingBottom: 40,
    },

    // Permission Box
    permissionBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      gap: 12,
    },
    permissionText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },

    // Stats Section
    statsSection: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 12 : 16,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      minWidth: isMobile ? '100%' : 120,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      gap: 4,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    statIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    statValue: {
      fontSize: isMobile ? 28 : 32,
      fontWeight: '700',
      fontFamily: theme.typography?.fontFamily?.bold,
      lineHeight: isMobile ? 34 : 38,
    },
    statLabel: {
      fontSize: 13,
      fontFamily: theme.typography?.fontFamily?.regular,
      textAlign: 'center',
    },

    // Info Box
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: theme.typography?.fontFamily?.regular,
    },

    // Topics Grid
    topicsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    topicCardWrapper: {
      width: isLargeScreen
        ? 'calc(33.333% - 11px)'
        : isTablet
          ? 'calc(50% - 8px)'
          : '100%',
      ...(Platform.OS !== 'web' && {
        width: isLargeScreen ? '31%' : isTablet ? '48%' : '100%',
      }),
    },
    topicCard: {
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      minHeight: 240,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    topRightSection: {
      position: 'absolute',
      top: 16,
      right: 16,
      alignItems: 'flex-end',
      gap: 10,
    },
    materialsCountBadge: {
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    materialsCountNumber: {
      fontSize: 20,
      fontWeight: '700',
      fontFamily: theme.typography?.fontFamily?.bold,
    },
    materialsCountLabel: {
      fontSize: 10,
      fontFamily: theme.typography?.fontFamily?.regular,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    editButton: {
      padding: 8,
      borderRadius: 8,
    },
    deleteButton: {
      padding: 8,
      borderRadius: 8,
    },
    topicNumberContainer: {
      width: 64,
      height: 64,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    topicNumberLarge: {
      fontSize: 28,
      fontWeight: '800',
      fontFamily: theme.typography?.fontFamily?.bold,
    },
    topicName: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: theme.typography?.fontFamily?.semiBold,
      marginBottom: 8,
      paddingRight: 80,
    },
    statusContainer: {
      marginBottom: 12,
    },
    viewMaterialsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      gap: 8,
      marginTop: 8,
    },
    viewMaterialsText: {
      fontSize: 13,
      fontWeight: '600',
    },
    generateTopicBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      gap: 6,
      marginTop: 8,
    },
    generateTopicBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    topicPromptInput: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 13,
      minHeight: 110,
      textAlignVertical: 'top',
      lineHeight: 20,
    },

    // Empty State
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
    },

    // AI Button
    aiButton: {
      marginTop: 24,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '85%',
      borderRadius: 24,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    modalTitle: {      fontSize: 18,
      fontWeight: '700',
      marginBottom: 2,
      fontFamily: theme.typography?.fontFamily?.bold,
    },
    modalSubtitle: {
      fontSize: 13,
      fontFamily: theme.typography?.fontFamily?.regular,
    },
    modalCloseButton: {},
    modalBodyScroll: {},
    modalBody: {
      marginBottom: 20,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 1,
    },
    modalCancelButton: {
      minWidth: 100,
    },
    modalCreateButton: {
      minWidth: 140,
    },
    reportModalContent: {
      maxWidth: 640,
    },
    reportList: {
      gap: 12,
      paddingBottom: 8,
    },
    reportItem: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    reportTopicTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    reportMessage: {
      fontSize: 13,
      lineHeight: 20,
    },

    // Materials Section in Add/Edit Modal
    materialsSection: {
      marginTop: 20,
    },
    materialHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    materialLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    addMaterialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    addMaterialText: {
      fontSize: 13,
      fontWeight: '600',
    },
    emptyMaterials: {
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      gap: 8,
    },
    emptyMaterialsText: {
      fontSize: 13,
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
      gap: 10,
    },
    materialName: {
      flex: 1,
      fontSize: 13,
    },

    // View Materials Modal
    viewMaterialsList: {
      gap: 12,
    },
    viewMaterialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      gap: 14,
    },
    materialIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    materialInfo: {
      flex: 1,
    },
    materialTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    materialType: {
      fontSize: 12,
      textTransform: 'uppercase',
    },
    downloadIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noMaterialsContainer: {
      alignItems: 'center',
      padding: 40,
      gap: 12,
    },
    noMaterialsText: {
      fontSize: 14,
    },

    // MCQ Quiz Section
    mcqSection: {
      marginTop: 24,
    },
    mcqSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginBottom: 12,
      gap: 8,
    },
    mcqSectionTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    addQuestionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    addQuestionBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    questionsList: {
      gap: 16,
    },
    questionCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    questionCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    questionCardNum: {
      fontSize: 14,
      fontWeight: '700',
    },
    optionsLabel: {
      fontSize: 12,
      marginTop: 4,
      marginBottom: 4,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    optionLetterBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    optionLetterText: {
      fontSize: 14,
      fontWeight: '700',
    },
    optionInputWrap: {
      flex: 1,
    },
    correctHint: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
  });

export default AddTopicsScreen;
