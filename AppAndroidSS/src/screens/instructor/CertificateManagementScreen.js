import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Image,
  Linking,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import StatsCard from '../../components/ui/StatsCard';
import MainLayout from '../../components/ui/MainLayout';
import AppCard from '../../components/ui/AppCard';
import AppButton from '../../components/ui/AppButton';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { certificateTemplateAPI, courseAPI, API_BASE } from '../../services/apiClient';
import CertificateCard from '../../components/CertificateCard';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';
const GREEN = '#10B981';

// ── Preset certificate color palettes ────────────────────────────────────────
const CERT_PALETTES = [
  { id: 'navy_gold',    name: 'Navy + Gold',    primary: '#C9A84C', secondary: '#7EC8E3', bg: '#1a1a3e' },
  { id: 'classic_gold', name: 'Classic Gold',   primary: '#C9A84C', secondary: '#B8860B', bg: '#ffffff' },
  { id: 'midnight',     name: 'Midnight',       primary: '#F59E0B', secondary: '#60A5FA', bg: '#0f172a' },
  { id: 'tech_blue',    name: 'Tech Blue',      primary: '#2563EB', secondary: '#06B6D4', bg: '#eff6ff' },
  { id: 'forest',       name: 'Forest Green',   primary: '#15803D', secondary: '#4ADE80', bg: '#f0fdf4' },
  { id: 'royal_purple', name: 'Royal Purple',   primary: '#7C3AED', secondary: '#A78BFA', bg: '#1e1b4b' },
  { id: 'crimson_gold', name: 'Crimson + Gold', primary: '#DC2626', secondary: '#F59E0B', bg: '#fff5f5' },
  { id: 'dark_orange',  name: 'Dark + Orange',  primary: '#EA580C', secondary: '#FCD34D', bg: '#1c1917' },
];

const CertificateManagementScreen = () => {
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  const isAdmin = user?.role === 'admin';

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCertificates: 0, hasActiveTemplate: false });
  const [recentCertificates, setRecentCertificates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activatingTemplate, setActivatingTemplate] = useState(null);
  const [activateCourseIds, setActivateCourseIds] = useState([]);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewSignatureUri, setPreviewSignatureUri] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [userHasSignature, setUserHasSignature] = useState(false);
  const [mySignatureUri, setMySignatureUri] = useState(null);
  const [strokeSize, setStrokeSize] = useState(2.5);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: 'Default Template',
    primaryColor: '#e5a448',
    secondaryColor: '#c2ee20',
    backgroundColor: '#1a1a3e',
    fontFamily: 'Arial, sans-serif',
    titleText: 'Certificate of Completion',
    subtitleText: 'This is to certify that',
    footerText: 'This certificate is awarded upon successful completion of the course requirements.',
  });

  // Sidebar navigation items based on user role
  const sidebarItems = getSidebarItems(user?.role);

  const handleNavigate = (route) => {
    if (isAdmin) {
      if (route === 'ManageInstructors') {
        navigation.navigate('ManageUsers', { userType: 'instructor' });
      } else if (route === 'Categories') {
        navigation.navigate('CategoryManagement');
      } else {
        navigation.navigate(route);
      }
    } else {
      navigation.navigate(route);
    }
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, templatesRes, activeRes, coursesRes, activePerCourseRes, sigRes] = await Promise.all([
        certificateTemplateAPI.getStats(),
        certificateTemplateAPI.getAll(),
        certificateTemplateAPI.getActive(),
        isAdmin ? courseAPI.getAll() : courseAPI.getAll({ instructorId: user?.id, limit: 200 }),
        certificateTemplateAPI.getActivePerCourse(),
        certificateTemplateAPI.getMySignature().catch(() => ({ signatureDataUri: null })),
      ]);
      setUserHasSignature(!!(sigRes?.signatureDataUri));
      setMySignatureUri(sigRes?.signatureDataUri || null);

      if (statsRes.success) {
        setStats(statsRes.stats);
        setRecentCertificates(statsRes.recentCertificates || []);
      }

      if (templatesRes.success) {
        setTemplates(templatesRes.templates || []);
      }

      if (activeRes.success) {
        setActiveTemplate(activeRes.template);
      }

      if (coursesRes.courses) {
        setAllCourses(coursesRes.courses || []);
      }

      if (activePerCourseRes.success) {
        setActiveAssignments(activePerCourseRes.activeAssignments || []);
      }
    } catch (error) {
      console.error('Error fetching certificate data:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load certificate data' });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create new template
  const handleCreateTemplate = async () => {
    try {
      setSaving(true);
      const response = await certificateTemplateAPI.create({
        ...templateForm,
        isActive: templates.length === 0,
        courseIds: selectedCourseIds,
      });

      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Template created successfully' });
        setShowTemplateModal(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error('Error creating template:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to create template' });
    } finally {
      setSaving(false);
    }
  };

  // Update template
  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setSaving(true);
      const response = await certificateTemplateAPI.update(editingTemplate.id, {
        ...templateForm,
        courseIds: selectedCourseIds,
      });

      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Template updated successfully' });
        setShowTemplateModal(false);
        setEditingTemplate(null);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error('Error updating template:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to update template' });
    } finally {
      setSaving(false);
    }
  };

  // Activate template as global default
  const handleActivateTemplate = async (id) => {
    try {
      const response = await certificateTemplateAPI.activate(id);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Template set as default' });
        fetchData();
      }
    } catch (error) {
      console.error('Error activating template:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to activate template' });
    }
  };

  // Open activate for courses modal
  const openActivateForCoursesModal = (template) => {
    setActivatingTemplate(template);
    // Pre-select courses that already have this template active
    const preselected = (template.courses || [])
      .filter(c => c.TemplateCourse?.isActive)
      .map(c => c.id);
    setActivateCourseIds(preselected);
    setShowActivateModal(true);
  };

  // Activate template for specific courses
  const handleActivateForCourses = async () => {
    if (!activatingTemplate) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No template selected' });
      return;
    }

    try {
      setSaving(true);
      const response = await certificateTemplateAPI.activateForCourses(activatingTemplate.id, activateCourseIds);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: response.message || 'Template activated for courses' });
        setShowActivateModal(false);
        setActivatingTemplate(null);
        setActivateCourseIds([]);
        fetchData();
      }
    } catch (error) {
      console.error('Error activating template for courses:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to activate template for courses' });
    } finally {
      setSaving(false);
    }
  };

  // Toggle course selection for activation
  const toggleActivateCourse = (courseId) => {
    setActivateCourseIds(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      }
      return [...prev, courseId];
    });
  };

  // Get active template for a course by checking all templates
  const getActiveTemplateForCourse = (courseId) => {
    if (!courseId) return null;

    // First check activeAssignments if available
    if (activeAssignments && activeAssignments.length > 0) {
      const assignment = activeAssignments.find(a => {
        // Handle different data structures for course ID
        const assignedCourseId = a.course?.id || a.course?._id || a.courseId;
        return assignedCourseId === courseId;
      });
      if (assignment?.template) {
        return assignment.template;
      }
    }

    // Fallback: Check templates directly for course assignments
    // This handles the case where activeAssignments might not be populated
    for (const template of templates) {
      // Check if course is in this template's courses array
      if (template.courses && template.courses.length > 0) {
        const courseAssignment = template.courses.find(c => {
          // Handle different data structures for course ID
          const cId = c.id || c.courseId || c._id;
          // If course is in the array, consider it assigned
          // Only exclude if TemplateCourse.isActive is explicitly set to false
          if (c.TemplateCourse && c.TemplateCourse.isActive === false) {
            return false;
          }
          return cId === courseId;
        });
        if (courseAssignment) {
          return template;
        }
      }

      // Also check if template has a courseIds array (raw IDs without full course objects)
      if (template.courseIds && template.courseIds.length > 0) {
        if (template.courseIds.includes(courseId)) {
          return template;
        }
      }
    }

    return null;
  };

  // Show delete confirmation modal
  const confirmDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setDeleteModalVisible(true);
  };

  // Delete template after confirmation
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setDeleteModalVisible(false);
    try {
      Toast.show({ type: 'info', text1: 'Deleting', text2: 'Removing template...' });
      const response = await certificateTemplateAPI.delete(templateToDelete.id);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Template deleted successfully' });
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to delete template' });
    } finally {
      setTemplateToDelete(null);
    }
  };

  // Cancel delete
  const cancelDeleteTemplate = () => {
    setDeleteModalVisible(false);
    setTemplateToDelete(null);
  };

  // Apply a preset palette (sets all three colors at once)
  const handlePaletteSelect = (palette) => {
    setTemplateForm(prev => ({
      ...prev,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      backgroundColor: palette.bg,
    }));
  };

  // Which preset palette matches the current form colors (if any)
  const activePaletteId = CERT_PALETTES.find(p =>
    p.primary === templateForm.primaryColor &&
    p.secondary === templateForm.secondaryColor &&
    p.bg === templateForm.backgroundColor
  )?.id || null;

  // Open signature drawing pad — one signature per instructor, not per template
  const handleOpenSignaturePad = () => {
    setShowSignaturePad(true);
    setTimeout(() => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }, 100);
  };

  // Canvas drawing handlers (web only)
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getCanvasPos(e);
    lastPosRef.current = pos;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    // Use midpoint quadratic Bezier for smooth cursive curves
    const midX = (lastPosRef.current.x + pos.x) / 2;
    const midY = (lastPosRef.current.y + pos.y) / 2;
    ctx.quadraticCurveTo(lastPosRef.current.x, lastPosRef.current.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleSaveSignature = async () => {
    if (!canvasRef.current) return;
    try {
      setSavingSignature(true);
      const dataUri = canvasRef.current.toDataURL('image/png');
      const response = await certificateTemplateAPI.saveMySignature(dataUri);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Saved', text2: 'Signature saved — applies to all your certificates' });
        setShowSignaturePad(false);
        setUserHasSignature(true);
        setMySignatureUri(dataUri);
        fetchData();
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to save signature' });
    } finally {
      setSavingSignature(false);
    }
  };

  const handleClearSignature = async () => {
    try {
      await certificateTemplateAPI.clearMySignature();
      Toast.show({ type: 'success', text1: 'Cleared', text2: 'Signature removed' });
      setUserHasSignature(false);
      setMySignatureUri(null);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to clear signature' });
    }
  };

  // Preview certificate
  const handlePreviewCertificate = async (templateId) => {
    const tpl = templates.find(t => t.id === templateId) || activeTemplate;
    setPreviewTemplate(tpl);
    setPreviewSignatureUri(null);
    setShowPreviewModal(true);
    if (tpl?.id && tpl?.hasSignature) {
      try {
        const sigRes = await certificateTemplateAPI.getSignatureImage(tpl.id);
        if (sigRes?.signatureDataUri) setPreviewSignatureUri(sigRes.signatureDataUri);
      } catch (_) {}
    }
  };

  // Open edit modal
  const openEditModal = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || 'Default Template',
      primaryColor: template.primaryColor || '#C9A84C',
      secondaryColor: template.secondaryColor || '#7EC8E3',
      backgroundColor: template.backgroundColor || '#1a1a3e',
      fontFamily: template.fontFamily || 'Arial, sans-serif',
      titleText: template.titleText || 'Certificate of Completion',
      subtitleText: template.subtitleText || 'This is to certify that',
      footerText: template.footerText || 'This certificate is awarded upon successful completion of the course requirements.',
    });
    // Set selected courses from template
    setSelectedCourseIds(template.courses ? template.courses.map(c => c.id) : []);
    setShowTemplateModal(true);
  };

  // Reset form
  const resetForm = () => {
    setTemplateForm({
      name: 'Default Template',
      primaryColor: '#C9A84C',
      secondaryColor: '#7EC8E3',
      backgroundColor: '#1a1a3e',
      fontFamily: 'Arial, sans-serif',
      titleText: 'Certificate of Completion',
      subtitleText: 'This is to certify that',
      footerText: 'This certificate is awarded upon successful completion of the course requirements.',
    });
    setSelectedCourseIds([]);
    setEditingTemplate(null);
  };

  // Toggle course selection
  const toggleCourseSelection = (courseId) => {
    setSelectedCourseIds(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      }
      return [...prev, courseId];
    });
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${API_BASE.replace('/api', '')}${imagePath}`;
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  if (loading) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="CertificateManagement"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: isAdmin ? 'Admin' : 'Instructor', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading certificate data...
          </Text>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="CertificateManagement"
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
        <View style={[styles.pageBanner, { backgroundColor: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)', borderColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)' }]}>
          <View style={styles.bannerLeft}>
            <View style={[styles.bannerIconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)' }]}>
              <Icon name="ribbon" size={28} color={GREEN} />
            </View>
            <View style={styles.bannerTextBlock}>
              <Text style={[styles.bannerTitle, { color: theme.colors.textPrimary }]}>
                Certificate Management
              </Text>
              <Text style={[styles.bannerSubtitle, { color: theme.colors.textSecondary }]}>
                Manage templates and issued certificates
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.bannerActionBtn, { backgroundColor: GREEN }]}
            onPress={() => {
              resetForm();
              setShowTemplateModal(true);
            }}
            activeOpacity={0.85}
          >
            <Icon name="add" size={16} color="#fff" />
            <Text style={styles.bannerActionBtnText}>Create Template</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <StatsCard
            icon="ribbon"
            color={GREEN}
            value={stats.totalCertificates}
            label="Certificates Issued"
          />
          <StatsCard
            icon={stats.hasActiveTemplate ? 'checkmark-circle' : 'warning'}
            color={stats.hasActiveTemplate ? GREEN : '#F59E0B'}
            value={stats.hasActiveTemplate ? 'Active' : 'None'}
            label="Template Status"
          />
        </View>

        {/* ── Your Signature ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, {
          marginBottom: 20,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,140,66,0.18)' : 'rgba(255,140,66,0.15)',
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          padding: 18,
        }]}>
          <View style={[styles.cardTitleRow, { marginBottom: 14 }]}>
            <View style={[styles.cardTitleIcon, { backgroundColor: isDark ? 'rgba(255,140,66,0.15)' : 'rgba(255,140,66,0.10)' }]}>
              <Icon name="pencil" size={16} color={ORANGE} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Your Signature</Text>
            {userHasSignature && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginLeft: 8 }}>
                <Icon name="checkmark-circle" size={12} color={GREEN} />
                <Text style={{ fontSize: 11, color: GREEN, fontWeight: '600' }}>Saved</Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 14, lineHeight: 18 }}>
            Your handwritten signature is applied to all certificate templates you create. Draw it once — it appears on every certificate you issue.
          </Text>

          {/* Draw / Edit button */}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 }}
              onPress={handleOpenSignaturePad}
              activeOpacity={0.85}
            >
              <Icon name="pencil-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {userHasSignature ? 'Edit Signature' : 'Add Signature'}
              </Text>
            </TouchableOpacity>

            {userHasSignature && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 }}
                onPress={handleClearSignature}
                activeOpacity={0.85}
              >
                <Icon name="trash-outline" size={15} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Content Grid */}
        <View style={styles.contentGrid}>
          {/* Main Column */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.mainColumn}>
            {/* Active Template Card */}
            <AppCard style={[styles.card, { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cardTitleIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                    <Icon name="ribbon-outline" size={16} color={GREEN} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                    Active Certificate Template
                  </Text>
                </View>
                <AppButton
                  title={activeTemplate ? 'Edit' : 'Create'}
                  onPress={() => {
                    if (activeTemplate) {
                      openEditModal(activeTemplate);
                    } else {
                      resetForm();
                      setShowTemplateModal(true);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  leftIcon={activeTemplate ? 'create-outline' : 'add-outline'}
                />
              </View>

              {activeTemplate ? (
                <View style={[styles.activeTemplateBanner, { backgroundColor: isDark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.05)', borderColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)' }]}>
                  <View style={styles.activeTemplateBadge}>
                    <Icon name="checkmark-circle" size={14} color={GREEN} />
                    <Text style={[styles.activeTemplateBadgeText, { color: GREEN }]}>Active</Text>
                  </View>
                  <View style={styles.templateDetails}>
                    {/* Logo Preview (Read-only) */}
                    <View style={styles.templateField}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.textTertiary }]}>
                        Logo (Automatic)
                      </Text>
                      <View style={[styles.logoPreviewContainer, { backgroundColor: theme.colors.surface }]}>
                        <View style={[styles.logoPlaceholder, { backgroundColor: theme.colors.primary + '20' }]}>
                          <Icon name="school" size={24} color={theme.colors.primary} />
                        </View>
                        <Text style={[styles.autoText, { color: theme.colors.textTertiary }]}>
                          SkillSphere logo is automatically applied
                        </Text>
                      </View>
                    </View>

                    {/* Instructor Signature */}
                    <View style={styles.templateField}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.textTertiary }]}>
                        Instructor Signature
                      </Text>
                      {mySignatureUri ? (
                        <View style={[styles.placeholderSignature, { backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', minHeight: 70, borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)' }]}>
                          <Image
                            source={{ uri: mySignatureUri }}
                            style={{ width: 220, height: 60, resizeMode: 'contain' }}
                          />
                        </View>
                      ) : (
                        <View style={[styles.placeholderSignature, { backgroundColor: theme.colors.surface, gap: 4 }]}>
                          <Icon name="information-circle-outline" size={16} color={theme.colors.textTertiary} />
                          <Text style={[styles.placeholderText, { color: theme.colors.textTertiary }]}>
                            Add your signature in the section above
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Color Theme */}
                    {(() => {
                      const matchedPalette = CERT_PALETTES.find(p =>
                        p.primary === activeTemplate.primaryColor &&
                        p.secondary === activeTemplate.secondaryColor &&
                        p.bg === activeTemplate.backgroundColor
                      );
                      const themeName = matchedPalette ? matchedPalette.name : activeTemplate.name;
                      const bg = activeTemplate.backgroundColor || '#ffffff';
                      const primary = activeTemplate.primaryColor || '#C9A84C';
                      const secondary = activeTemplate.secondaryColor || '#7EC8E3';
                      return (
                        <View style={[styles.templateField, { marginTop: 8 }]}>
                          <Text style={[styles.fieldLabel, { color: theme.colors.textTertiary }]}>
                            Color Theme
                          </Text>
                          <View style={{
                            borderRadius: 12,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                          }}>
                            {/* Color strip preview */}
                            <View style={{ height: 36, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
                              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: primary, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 }} />
                              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: secondary, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 }} />
                              <View style={{ flex: 1 }} />
                              <Icon name="color-palette-outline" size={14} color={primary} />
                            </View>
                            {/* Theme name row */}
                            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>
                                {themeName}
                              </Text>
                              {matchedPalette && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                                  <Icon name="checkmark-circle" size={11} color={GREEN} />
                                  <Text style={{ fontSize: 10, color: GREEN, fontWeight: '600' }}>Preset</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Preview Button */}
                    <AppButton
                      title="Preview Certificate"
                      onPress={() => handlePreviewCertificate(activeTemplate.id)}
                      variant="primary"
                      leftIcon="eye-outline"
                      style={styles.previewButton}
                    />
                  </View>
                </View>
              ) : (
                <View style={[styles.emptyTemplate, { borderColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.18)' }]}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)' }]}>
                    <Icon name="ribbon-outline" size={32} color={GREEN} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                    No Active Template
                  </Text>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    Create a certificate template to start issuing certificates
                  </Text>
                  <AppButton
                    title="Create Template"
                    onPress={() => {
                      resetForm();
                      setShowTemplateModal(true);
                    }}
                    variant="primary"
                    leftIcon="add-outline"
                    style={styles.createButton}
                  />
                </View>
              )}
            </AppCard>

            {/* Recent Certificates Card */}
            <AppCard style={[styles.card, { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.cardTitleRow}>
                <View style={[styles.cardTitleIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                  <Icon name="list-outline" size={16} color={GREEN} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                  Recent Certificates
                </Text>
              </View>

              {recentCertificates.length > 0 ? (
                <View style={styles.certificateList}>
                  {recentCertificates.map((cert, index) => (
                    <View key={cert.id} style={[styles.certificateItem, { borderColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.10)', backgroundColor: isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.03)' }]}>
                      <View style={[styles.certificateIndexCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)' }]}>
                        <Icon name="ribbon" size={18} color={GREEN} />
                      </View>
                      <View style={styles.certificateInfo}>
                        <Text style={[styles.certificateName, { color: theme.colors.textPrimary }]}>
                          {cert.course?.name || 'Unknown Course'}
                        </Text>
                        <View style={styles.certMeta}>
                          <Icon name="person-outline" size={11} color={theme.colors.textSecondary} />
                          <Text style={[styles.certificateStudent, { color: theme.colors.textSecondary }]}>
                            {cert.user?.name || 'Unknown Student'}
                          </Text>
                          <Text style={[styles.certDot, { color: theme.colors.textTertiary }]}>·</Text>
                          <Icon name="calendar-outline" size={11} color={theme.colors.textSecondary} />
                          <Text style={[styles.certificateStudent, { color: theme.colors.textSecondary }]}>
                            {formatDate(cert.issuedDate)}
                          </Text>
                        </View>
                      </View>
                      {cert.certificateUrl && (
                        <TouchableOpacity
                          style={[styles.certificateAction, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)' }]}
                          onPress={() => {
                            const url = getImageUrl(cert.certificateUrl);
                            if (Platform.OS === 'web') {
                              window.open(url, '_blank');
                            } else {
                              Linking.openURL(url);
                            }
                          }}
                        >
                          <Icon name="download-outline" size={18} color={GREEN} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptySection, { borderColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)' }]}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)' }]}>
                    <Icon name="ribbon-outline" size={26} color={GREEN} />
                  </View>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No certificates issued yet
                  </Text>
                </View>
              )}
            </AppCard>
          </Animated.View>

          {/* Side Column */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.sideColumn}>
            {/* All Templates Card */}
            <AppCard style={[styles.card, { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cardTitleIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                    <Icon name="layers-outline" size={16} color={GREEN} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                    All Templates
                  </Text>
                </View>
                <AppButton
                  title="New"
                  onPress={() => {
                    resetForm();
                    setShowTemplateModal(true);
                  }}
                  variant="outline"
                  size="sm"
                  leftIcon="add-outline"
                />
              </View>

              {templates.length > 0 ? (
                <View style={styles.templateList}>
                  {templates.map((template) => {
                    // Get courses where this template is active
                    const activeCourses = (template.courses || []).filter(c => c.TemplateCourse?.isActive);
                    const isActiveTemplate = template.isActive || activeCourses.length > 0;
                    return (
                      <View
                        key={template.id}
                        style={[
                          styles.templateItem,
                          {
                            borderColor: isActiveTemplate ? GREEN : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                            borderLeftWidth: isActiveTemplate ? 3 : 1,
                            backgroundColor: isActiveTemplate
                              ? (isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.03)')
                              : (isDark ? theme.colors.surface : theme.colors.surface),
                          }
                        ]}
                      >
                        <View style={styles.templateItemHeader}>
                          <View style={styles.templateItemInfo}>
                            <Text style={[styles.templateItemName, { color: theme.colors.textPrimary }]}>
                              {template.name}
                            </Text>
                            <View style={styles.badgeRow}>
                              {template.isActive && (
                                <View style={[styles.activeBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)' }]}>
                                  <Icon name="checkmark-circle" size={10} color={GREEN} />
                                  <Text style={[styles.activeBadgeText, { color: GREEN }]}>
                                    Default
                                  </Text>
                                </View>
                              )}
                              {activeCourses.length > 0 && (
                                <View style={[styles.activeBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)' }]}>
                                  <Text style={[styles.activeBadgeText, { color: GREEN }]}>
                                    {activeCourses.length} Course{activeCourses.length > 1 ? 's' : ''}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.templateItemColors}>
                            <View style={[styles.colorDot, { backgroundColor: template.primaryColor }]} />
                            <View style={[styles.colorDot, { backgroundColor: template.secondaryColor }]} />
                          </View>
                        </View>

                        {/* Show active courses */}
                        {activeCourses.length > 0 && (
                          <View style={styles.activeCoursesList}>
                            {activeCourses.slice(0, 3).map(course => (
                              <View key={course.id} style={[styles.courseTag, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)' }]}>
                                <Text style={[styles.courseTagText, { color: GREEN }]} numberOfLines={1}>
                                  {course.name}
                                </Text>
                              </View>
                            ))}
                            {activeCourses.length > 3 && (
                              <Text style={[styles.moreCourses, { color: theme.colors.textTertiary }]}>
                                +{activeCourses.length - 3} more
                              </Text>
                            )}
                          </View>
                        )}

                        <View style={styles.templateItemActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnWide, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)' }]}
                            onPress={() => openActivateForCoursesModal(template)}
                          >
                            <Icon name="school-outline" size={14} color={GREEN} />
                            <Text style={[styles.actionBtnText, { color: GREEN }]}>Courses</Text>
                          </TouchableOpacity>
                          {!template.isActive && (
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)' }]}
                              onPress={() => handleActivateTemplate(template.id)}
                            >
                              <Icon name="star-outline" size={16} color="#6366F1" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,140,66,0.15)' : 'rgba(255,140,66,0.10)' }]}
                            onPress={() => openEditModal(template)}
                          >
                            <Icon name="create-outline" size={16} color={ORANGE} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,140,66,0.15)' : 'rgba(255,140,66,0.10)' }]}
                            onPress={() => handlePreviewCertificate(template.id)}
                          >
                            <Icon name="eye-outline" size={16} color={ORANGE} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.10)' }]}
                            onPress={() => confirmDeleteTemplate(template)}
                          >
                            <Icon name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptySection, { borderColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)' }]}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)' }]}>
                    <Icon name="document-outline" size={26} color={GREEN} />
                  </View>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No templates created
                  </Text>
                </View>
              )}
            </AppCard>

            {/* Info Card */}
            <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)', borderColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)', borderWidth: 1 }]}>
              <View style={[styles.infoIconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)' }]}>
                <Icon name="information-circle" size={18} color={GREEN} />
              </View>
              <Text style={[styles.infoCardText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
                Certificates are automatically generated and emailed when students complete 100% of a course.
              </Text>
            </View>

            {/* Settings Info Card */}
            <AppCard style={[styles.card, { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.cardTitleRow}>
                <View style={[styles.cardTitleIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                  <Icon name="settings-outline" size={16} color={GREEN} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                  Auto-Generation Settings
                </Text>
              </View>
              <View style={styles.settingsList}>
                <View style={[styles.settingItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderBottomWidth: 1, paddingBottom: 10 }]}>
                  <View style={[styles.settingIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                    <Icon name="checkmark-done-outline" size={18} color={GREEN} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, { color: theme.colors.textTertiary }]}>
                      Trigger
                    </Text>
                    <Text style={[styles.settingValue, { color: theme.colors.textPrimary }]}>
                      100% course completion
                    </Text>
                  </View>
                </View>
                <View style={[styles.settingItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderBottomWidth: 1, paddingBottom: 10 }]}>
                  <View style={[styles.settingIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                    <Icon name="mail-outline" size={18} color={GREEN} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, { color: theme.colors.textTertiary }]}>
                      Delivery
                    </Text>
                    <Text style={[styles.settingValue, { color: theme.colors.textPrimary }]}>
                      Email with PDF attachment
                    </Text>
                  </View>
                </View>
                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.09)' }]}>
                    <Icon name="document-text-outline" size={18} color={GREEN} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, { color: theme.colors.textTertiary }]}>
                      Format
                    </Text>
                    <Text style={[styles.settingValue, { color: theme.colors.textPrimary }]}>
                      PDF (A4 Landscape)
                    </Text>
                  </View>
                </View>
              </View>
            </AppCard>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Template Modal */}
      <Modal
        visible={showTemplateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
          resetForm();
        }}
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
            maxWidth: 560,
            backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            overflow: 'hidden',
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
            maxHeight: '90%',
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Icon name="ribbon" size={18} color={GREEN} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name="close" size={20} color={isDark ? '#FFFFFF' : '#1A1A2E'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20, maxHeight: 560 }}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Template Name</Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                    fontSize: 14,
                  }}
                  value={templateForm.name}
                  onChangeText={(text) => setTemplateForm({ ...templateForm, name: text })}
                  placeholder="Template Name"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Title Text</Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                    fontSize: 14,
                  }}
                  value={templateForm.titleText}
                  onChangeText={(text) => setTemplateForm({ ...templateForm, titleText: text })}
                  placeholder="Certificate of Completion"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Subtitle Text</Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                    fontSize: 14,
                  }}
                  value={templateForm.subtitleText}
                  onChangeText={(text) => setTemplateForm({ ...templateForm, subtitleText: text })}
                  placeholder="This is to certify that"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>

              {/* ── Color Palette Selector ── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Color Palette</Text>
                <Text style={[styles.formHint, { color: theme.colors.textTertiary, marginBottom: 10 }]}>
                  Choose a preset — all colors are contrast-tested
                </Text>

                {/* Palette grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CERT_PALETTES.map(palette => {
                    const isActive = activePaletteId === palette.id;
                    return (
                      <TouchableOpacity
                        key={palette.id}
                        onPress={() => handlePaletteSelect(palette)}
                        style={{
                          borderRadius: 12,
                          borderWidth: isActive ? 2.5 : 1.5,
                          borderColor: isActive ? GREEN : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                          overflow: 'hidden',
                          width: '47%',
                          shadowColor: isActive ? GREEN : '#000',
                          shadowOpacity: isActive ? 0.3 : 0.05,
                          shadowRadius: 6,
                          elevation: isActive ? 4 : 1,
                        }}
                        activeOpacity={0.8}
                      >
                        {/* Color preview strip */}
                        <View style={{ height: 32, backgroundColor: palette.bg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 5 }}>
                          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: palette.primary }} />
                          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: palette.secondary }} />
                          {isActive && (
                            <View style={{ marginLeft: 'auto' }}>
                              <Icon name="checkmark-circle" size={16} color={GREEN} />
                            </View>
                          )}
                        </View>
                        {/* Palette name */}
                        <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', paddingHorizontal: 8, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>
                            {palette.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Font Family</Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                    fontSize: 14,
                  }}
                  value={templateForm.fontFamily}
                  onChangeText={(text) => setTemplateForm({ ...templateForm, fontFamily: text })}
                  placeholder="Arial, sans-serif"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Footer Text</Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                    fontSize: 14,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  value={templateForm.footerText}
                  onChangeText={(text) => setTemplateForm({ ...templateForm, footerText: text })}
                  placeholder="This certificate is awarded upon successful completion of the course requirements."
                  placeholderTextColor={theme.colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Course Selection */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>Apply to Courses</Text>
                <Text style={[styles.formHint, { color: theme.colors.textTertiary }]}>
                  Select courses this template applies to. Courses already assigned to other templates are not shown.
                </Text>
                <View style={styles.courseSelectionContainer}>
                  {allCourses.length > 0 ? (
                    allCourses.map(course => {
                      // Check if this course already has a template assigned (that is NOT the one being edited)
                      const existingTemplate = getActiveTemplateForCourse(course.id);
                      const isAssignedToOtherTemplate = existingTemplate && editingTemplate && existingTemplate.id !== editingTemplate.id;
                      const isAssignedToAnyTemplate = existingTemplate && !editingTemplate;

                      // Skip courses that are already assigned to other templates
                      if (isAssignedToOtherTemplate || isAssignedToAnyTemplate) {
                        return null;
                      }

                      return (
                        <TouchableOpacity
                          key={course.id}
                          style={[
                            styles.courseChip,
                            {
                              backgroundColor: selectedCourseIds.includes(course.id)
                                ? GREEN
                                : theme.colors.surface,
                              borderColor: selectedCourseIds.includes(course.id)
                                ? GREEN
                                : theme.colors.border
                            }
                          ]}
                          onPress={() => toggleCourseSelection(course.id)}
                        >
                          <Icon
                            name={selectedCourseIds.includes(course.id) ? 'checkmark-circle' : 'ellipse-outline'}
                            size={16}
                            color={selectedCourseIds.includes(course.id) ? '#fff' : theme.colors.textSecondary}
                          />
                          <Text style={[
                            styles.courseChipText,
                            { color: selectedCourseIds.includes(course.id) ? '#fff' : theme.colors.textPrimary }
                          ]}>
                            {course.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={[styles.noCourses, { color: theme.colors.textTertiary }]}>
                      No courses available
                    </Text>
                  )}
                  {/* Show message if all courses are assigned */}
                  {allCourses.length > 0 && allCourses.every(course => {
                    const existingTemplate = getActiveTemplateForCourse(course.id);
                    return existingTemplate && (!editingTemplate || existingTemplate.id !== editingTemplate.id);
                  }) && (
                    <Text style={[styles.noCourses, { color: theme.colors.textTertiary }]}>
                      All courses already have templates assigned
                    </Text>
                  )}
                </View>
                {selectedCourseIds.length > 0 && (
                  <Text style={[styles.selectedCount, { color: GREEN }]}>
                    {selectedCourseIds.length} course{selectedCourseIds.length > 1 ? 's' : ''} selected
                  </Text>
                )}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={{
              flexDirection: 'row',
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,46,0.18)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: saving ? 'rgba(255,140,66,0.5)' : ORANGE,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                  {saving ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Certificate Preview Modal */}
      <Modal
        visible={showPreviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {}),
        }}>
          <View style={{
            width: '100%',
            maxWidth: 780,
            backgroundColor: isDark ? 'rgba(15,15,30,0.96)' : 'rgba(255,255,255,0.97)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.4,
            shadowRadius: 40,
            elevation: 20,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="ribbon-outline" size={20} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary }}>Certificate Preview</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 1 }}>
                    {previewTemplate?.name || 'Template Preview'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)} style={{ padding: 8 }}>
                <Icon name="close" size={22} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Certificate Card */}
            {previewTemplate && (() => {
              const cardW = Math.min(width - 80, 720);
              return (
                <View style={{ alignItems: 'center' }}>
                  <CertificateCard
                    template={previewTemplate}
                    certificate={null}
                    studentName="John Doe"
                    courseName="Advanced Web Development"
                    cardWidth={cardW}
                    isInstructorPreview={true}
                    signatureUri={previewSignatureUri}
                  />
                </View>
              );
            })()}

            {/* Info row */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginTop: 16, padding: 12, borderRadius: 10,
              backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff',
              borderWidth: 1, borderColor: '#c7d2fe',
            }}>
              <Icon name="information-circle-outline" size={16} color="#6366f1" />
              <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#a5b4fc' : '#4338ca', lineHeight: 17 }}>
                This is a design preview with sample data. The actual certificate will use the student's name and course.
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signature Drawing Pad Modal */}
      <Modal
        visible={showSignaturePad}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSignaturePad(false)}
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
            maxWidth: 600,
            backgroundColor: isDark ? 'rgba(15,15,30,0.95)' : 'rgba(255,255,255,0.97)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            padding: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="create-outline" size={20} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary }}>Draw Signature</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 1 }}>Sign in the box below</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowSignaturePad(false)} style={{ padding: 8 }}>
                <Icon name="close" size={22} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Canvas */}
            {Platform.OS === 'web' ? (
              <canvas
                ref={canvasRef}
                width={540}
                height={180}
                style={{
                  width: '100%',
                  height: 180,
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                  borderRadius: 12,
                  cursor: 'crosshair',
                  backgroundColor: '#ffffff',
                  touchAction: 'none',
                  display: 'block',
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            ) : (
              <View style={{ height: 180, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <Icon name="create-outline" size={32} color={theme.colors.textTertiary} />
                <Text style={{ color: theme.colors.textTertiary, marginTop: 8, fontSize: 13 }}>Signature drawing available on web</Text>
              </View>
            )}

            {/* Stroke size slider */}
            {Platform.OS === 'web' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 4 }}>
                <Icon name="remove-outline" size={16} color={theme.colors.textTertiary} />
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="0.5"
                  value={strokeSize}
                  onChange={(e) => setStrokeSize(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: theme.colors.primary,
                    cursor: 'pointer',
                    height: 4,
                  }}
                />
                <Icon name="add-outline" size={16} color={theme.colors.textTertiary} />
                <View style={{
                  width: 28, height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.colors.primary + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <View style={{
                    width: Math.min(strokeSize * 3, 20),
                    height: Math.min(strokeSize * 3, 20),
                    borderRadius: Math.min(strokeSize * 3, 20) / 2,
                    backgroundColor: theme.colors.primary,
                  }} />
                </View>
              </View>
            )}

            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, textAlign: 'center', marginTop: 6 }}>
              Draw your signature above with mouse or finger
            </Text>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={clearCanvas}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1.5, borderColor: theme.colors.border,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                <Icon name="refresh-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveSignature}
                disabled={savingSignature}
                style={{
                  flex: 2, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                  opacity: savingSignature ? 0.7 : 1,
                }}
              >
                <Icon name="checkmark-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {savingSignature ? 'Saving...' : 'Save Signature'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDeleteTemplate}
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
            maxWidth: 560,
            backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            padding: 28,
            alignItems: 'center',
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
          }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Icon name="trash-outline" size={18} color="#EF4444" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>
                  Delete Template
                </Text>
              </View>
              <TouchableOpacity
                onPress={cancelDeleteTemplate}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name="close" size={20} color={isDark ? '#FFFFFF' : '#1A1A2E'} />
              </TouchableOpacity>
            </View>

            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(239,68,68,0.12)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <Icon name="warning" size={40} color="#EF4444" />
            </View>
            <Text style={{
              fontSize: 14,
              textAlign: 'center',
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(26,26,46,0.65)',
              marginBottom: 24,
              lineHeight: 20,
            }}>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
              <TouchableOpacity
                onPress={cancelDeleteTemplate}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,46,0.18)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteTemplate}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: ORANGE,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Activate for Courses Modal */}
      <Modal
        visible={showActivateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowActivateModal(false);
          setActivatingTemplate(null);
          setActivateCourseIds([]);
        }}
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
            maxWidth: 560,
            backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
            overflow: 'hidden',
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.15,
            shadowRadius: 40,
            elevation: 20,
            maxHeight: '90%',
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Icon name="ribbon" size={18} color={GREEN} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>
                  Activate for Courses
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowActivateModal(false);
                  setActivatingTemplate(null);
                  setActivateCourseIds([]);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name="close" size={20} color={isDark ? '#FFFFFF' : '#1A1A2E'} />
              </TouchableOpacity>
            </View>

            <View style={styles.activateModalInfo}>
              <View style={[styles.activateTemplatePreview, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.04)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
              }]}>
                <View style={styles.activateTemplateColors}>
                  <View style={[styles.colorDotLarge, { backgroundColor: activatingTemplate?.primaryColor || '#e5a448' }]} />
                  <View style={[styles.colorDotLarge, { backgroundColor: activatingTemplate?.secondaryColor || '#c2ee20' }]} />
                </View>
                <Text style={[styles.activateTemplateName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {activatingTemplate?.name || 'Template'}
                </Text>
              </View>
              <Text style={[styles.activateHint, { color: theme.colors.textSecondary }]}>
                Select courses where this template will be used for certificates. This will replace any other active template for the selected courses.
              </Text>
            </View>

            <ScrollView style={styles.activateCourseList}>
              {allCourses.length > 0 ? (
                allCourses.map(course => {
                  const isSelected = activateCourseIds.includes(course.id);
                  const currentActiveTemplate = getActiveTemplateForCourse(course.id);
                  const hasOtherActive = currentActiveTemplate && currentActiveTemplate.id !== activatingTemplate?.id;

                  // Courses with another template — show as selectable with a "Will replace" warning
                  if (hasOtherActive) {
                    return (
                      <TouchableOpacity
                        key={course.id}
                        style={[
                          styles.activateCourseItem,
                          {
                            backgroundColor: isSelected ? (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(26,26,46,0.03)'),
                            borderColor: isSelected ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)'),
                          }
                        ]}
                        onPress={() => toggleActivateCourse(course.id)}
                      >
                        <Icon
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? '#F59E0B' : theme.colors.textTertiary}
                        />
                        <View style={styles.activateCourseInfo}>
                          <Text style={[styles.activateCourseName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]} numberOfLines={1}>
                            {course.name}
                          </Text>
                          <Text style={[styles.activateCourseStatus, { color: '#F59E0B' }]}>
                            {isSelected ? 'Will replace: ' : 'Currently: '}{currentActiveTemplate.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        styles.activateCourseItem,
                        {
                          backgroundColor: isSelected ? (isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(26,26,46,0.03)'),
                          borderColor: isSelected ? GREEN : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)'),
                        }
                      ]}
                      onPress={() => toggleActivateCourse(course.id)}
                    >
                      <Icon
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? GREEN : theme.colors.textTertiary}
                      />
                      <View style={styles.activateCourseInfo}>
                        <Text style={[styles.activateCourseName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]} numberOfLines={1}>
                          {course.name}
                        </Text>
                        {currentActiveTemplate && currentActiveTemplate.id === activatingTemplate?.id && (
                          <Text style={[styles.activateCourseStatus, { color: GREEN }]}>
                            Currently using this template
                          </Text>
                        )}
                        {!currentActiveTemplate && (
                          <Text style={[styles.activateCourseStatus, { color: theme.colors.textTertiary }]}>
                            Using default template
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.noCourses, { color: theme.colors.textTertiary }]}>
                  No courses available
                </Text>
              )}
            </ScrollView>

            {activateCourseIds.length > 0 && (
              <View style={[styles.selectedSummary, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)' }]}>
                <Icon name="checkmark-circle" size={18} color={GREEN} />
                <Text style={[styles.selectedSummaryText, { color: GREEN }]}>
                  {activateCourseIds.length} course{activateCourseIds.length > 1 ? 's' : ''} selected
                </Text>
              </View>
            )}

            {/* Modal Actions */}
            <View style={{
              flexDirection: 'row',
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={() => {
                  setShowActivateModal(false);
                  setActivatingTemplate(null);
                  setActivateCourseIds([]);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,46,0.18)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1A1A2E' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleActivateForCourses}
                disabled={saving || activateCourseIds.length === 0}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: (saving || activateCourseIds.length === 0) ? 'rgba(255,140,66,0.4)' : ORANGE,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                  {saving ? 'Saving...' : 'Activate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },

    // Page Banner
    pageBanner: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      borderWidth: 1,
      padding: isMobile ? 16 : 20,
      marginBottom: 24,
      gap: isMobile ? 14 : 0,
    },
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    bannerIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerTextBlock: {
      flex: 1,
    },
    bannerTitle: {
      fontSize: isMobile ? 18 : 22,
      fontWeight: '700',
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: 2,
    },
    bannerSubtitle: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },
    bannerActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    bannerActionBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },

    // Stats Section
    statsSection: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 12 : 16,
      marginBottom: 24,
    },
    statCard: {
      flex: isMobile ? undefined : 1,
      width: isMobile ? '100%' : undefined,
      minWidth: isMobile ? undefined : isTablet ? 200 : 250,
      maxWidth: isLargeScreen ? 350 : undefined,
      padding: isMobile ? 16 : 20,
      alignItems: 'center',
    },
    statIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: isMobile ? 30 : 38,
      fontWeight: '700',
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: 'center',
    },

    // Content Grid
    contentGrid: {
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

    // Cards
    card: {
      padding: isMobile ? 16 : 20,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    cardTitleIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: {      fontSize: 16,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },

    // Active Template Banner
    activeTemplateBanner: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    activeTemplateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 12,
    },
    activeTemplateBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    // Template Details
    templateDetails: {
      gap: 16,
    },
    templateField: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    logoPreviewContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 12,
    },
    logoPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    autoText: {
      fontSize: 12,
      fontStyle: 'italic',
      flex: 1,
    },
    uploadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    thumbnailImage: {
      width: 80,
      height: 50,
      borderRadius: 6,
    },
    signatureImage: {
      width: 120,
      height: 50,
      borderRadius: 4,
    },
    placeholderImage: {
      width: 80,
      height: 50,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderSignature: {
      width: 120,
      height: 50,
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    placeholderText: {
      fontSize: 11,
    },
    colorsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    colorField: {
      flex: 1,
      gap: 6,
    },
    colorPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    colorSwatch: {
      width: 24,
      height: 24,
      borderRadius: 6,
    },
    colorValue: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.medium,
    },
    previewButton: {
      marginTop: 8,
    },

    // Empty Template
    emptyTemplate: {
      padding: 32,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      alignItems: 'center',
      gap: 12,
    },
    emptyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emptyTitle: {      fontSize: 16,
      fontWeight: '600',
    },
    emptyText: {
      fontSize: 13,
      textAlign: 'center',
    },
    createButton: {
      marginTop: 8,
    },

    // Certificate List
    certificateList: {
      gap: 10,
    },
    certificateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    certificateIndexCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    certificateInfo: {
      flex: 1,
    },
    certificateName: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 3,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    certMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    certDot: {
      fontSize: 12,
    },
    certificateStudent: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },
    certificateAction: {
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Empty Section
    emptySection: {
      padding: 28,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      gap: 10,
    },

    // Template List
    templateList: {
      gap: 12,
    },
    templateItem: {
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      gap: 10,
    },
    templateItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    templateItemInfo: {
      flex: 1,
    },
    templateItemName: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    activeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    templateItemColors: {
      flexDirection: 'row',
      gap: 4,
    },
    colorDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    templateItemActions: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Settings
    settingsList: {
      gap: 0,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingContent: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 11,
      marginBottom: 2,
    },
    settingValue: {
      fontSize: 13,
      fontWeight: '500',
    },

    // Info Card
    infoCard: {
      flexDirection: 'row',
      padding: 14,
      borderRadius: 12,
      alignItems: 'flex-start',
      gap: 10,
    },
    infoIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoCardText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '90%',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: isDark ? 0.5 : 0.15,
      shadowRadius: 40,
      elevation: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalHeaderIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalTitle: {      fontSize: 18,
      fontWeight: '700',
    },
    modalContent: {
      padding: 20,
      maxHeight: 400,
    },
    formField: {
      marginBottom: 16,
    },
    formRow: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 6,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    colorPickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    colorSwatchLarge: {
      width: 50,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    colorTextInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
    },
    modalActions: {
      flexDirection: 'row',
      padding: 20,
      borderTopWidth: 1,
    },

    // Delete Modal
    deleteModalContainer: {
      width: '100%',
      maxWidth: 560,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: isDark ? 0.5 : 0.15,
      shadowRadius: 40,
      elevation: 20,
    },
    deleteModalIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(239,68,68,0.12)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    deleteModalTitle: {      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    deleteModalMessage: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    deleteModalActions: {
      flexDirection: 'row',
      width: '100%',
      gap: 12,
    },

    // Course Selection styles
    formHint: {
      fontSize: 12,
      marginBottom: 8,
      lineHeight: 16,
    },
    courseSelectionContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    courseChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      gap: 6,
    },
    courseChipText: {
      fontSize: 13,
      fontWeight: '500',
    },
    noCourses: {
      fontSize: 13,
      fontStyle: 'italic',
      padding: 12,
    },
    selectedCount: {
      fontSize: 12,
      marginTop: 8,
      fontWeight: '500',
    },

    // Badge row for multiple badges
    badgeRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 4,
    },

    // Active courses list in template item
    activeCoursesList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
      marginBottom: 4,
    },
    courseTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      maxWidth: 120,
    },
    courseTagText: {
      fontSize: 11,
      fontWeight: '500',
    },
    moreCourses: {
      fontSize: 11,
      alignSelf: 'center',
    },

    // Action button with text
    actionBtnWide: {
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 10,
      width: 'auto',
    },
    actionBtnText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // Activate modal styles
    activateModalInfo: {
      padding: 20,
      paddingBottom: 12,
    },
    activateTemplatePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      gap: 12,
      marginBottom: 12,
    },
    activateTemplateColors: {
      flexDirection: 'row',
      gap: 4,
    },
    colorDotLarge: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    activateTemplateName: {
      fontSize: 15,
      fontWeight: '600',
    },
    activateHint: {
      fontSize: 13,
      lineHeight: 18,
    },
    activateCourseList: {
      maxHeight: 300,
      paddingHorizontal: 20,
    },
    activateCourseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      gap: 12,
      marginBottom: 8,
    },
    activateCourseInfo: {
      flex: 1,
    },
    activateCourseName: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
    },
    activateCourseStatus: {
      fontSize: 11,
    },
    selectedSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      marginHorizontal: 20,
      borderRadius: 8,
      gap: 8,
      marginTop: 4,
    },
    selectedSummaryText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });

export default CertificateManagementScreen;
