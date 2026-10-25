import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MainLayout from '../../components/ui/MainLayout';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { feedbackAPI, courseAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';

const FeedbackFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId, courseName: routeCourseName } = route.params || {};
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [courseName, setCourseName] = useState(routeCourseName || '');
  const [loading, setLoading] = useState(!routeCourseName && courseId);

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width > 1024;
  const isTablet = width > 768;
  const isMobile = width <= 480;

  const sidebarItems = getSidebarItems(user?.role);

  const handleNavigate = (routeName) => {
    navigation.navigate(routeName);
  };

  // Fetch course name if not provided
  useEffect(() => {
    const fetchCourseName = async () => {
      if (courseId && !routeCourseName) {
        try {
          const response = await courseAPI.getById(courseId);
          if (response.course) {
            setCourseName(response.course.name);
          }
        } catch (error) {
          console.error('Error fetching course:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchCourseName();
  }, [courseId, routeCourseName]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide a rating',
      });
      return;
    }

    if (!feedback.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide feedback',
      });
      return;
    }

    setSubmitting(true);
    try {
      const feedbackData = {
        courseName: courseName || 'Unknown Course',
        expertName: user?.name || 'Expert',
        feedback: feedback.trim(),
        rating,
        courseId: courseId || null,
      };

      await feedbackAPI.create(feedbackData);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Feedback submitted successfully!',
      });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to submit feedback',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const styles = getStyles(theme, isDark, isLargeScreen, isTablet, isMobile);

  if (loading) {
    return (
      <MainLayout
        showSidebar={true}
        sidebarItems={sidebarItems}
        activeRoute="Courses"
        onNavigate={handleNavigate}
        userInfo={{ name: user?.name, role: 'Expert', avatar: user?.avatar }}
        onLogout={logout}
        onSettings={() => navigation.navigate('Settings')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading course details...
          </Text>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="Courses"
      onNavigate={handleNavigate}
      userInfo={{ name: user?.name, role: 'Expert', avatar: user?.avatar }}
      onLogout={logout}
      onSettings={() => navigation.navigate('Settings')}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header Banner */}
        <View
          style={[
            styles.pageHeaderBanner,
            {
              backgroundColor: isDark ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.05)',
              borderColor: 'rgba(255,140,66,0.15)',
            },
          ]}
        >
          <View style={styles.bannerLeft}>
            <TouchableOpacity
              style={[
                styles.backButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.06)' },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.bannerIconCircle}>
              <Icon name="chatbubbles" size={22} color={ORANGE} />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>
                Provide Feedback
              </Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>
                Share your expert review and rating for this course
              </Text>
            </View>
          </View>
        </View>

        {/* Course Info Card */}
        {courseName && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View
              style={[
                styles.courseInfoCard,
                {
                  backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
                },
              ]}
            >
              <View style={[styles.courseIconContainer, { backgroundColor: ORANGE + '15' }]}>
                <Icon name="book" size={24} color={ORANGE} />
              </View>
              <View style={styles.courseInfoText}>
                <Text style={[styles.courseInfoLabel, { color: theme.colors.textSecondary }]}>
                  Providing feedback for
                </Text>
                <Text style={[styles.courseInfoName, { color: theme.colors.textPrimary }]}>
                  {courseName}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Rating Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: '#F59E0B' + '18' }]}>
                <Icon name="star" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Rating
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  How would you rate this course overall?
                </Text>
              </View>
              <View style={[styles.requiredBadge, { backgroundColor: '#EF4444' + '15' }]}>
                <Text style={[styles.requiredBadgeText, { color: '#EF4444' }]}>Required</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)' }]} />

            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={[
                    styles.starButton,
                    {
                      backgroundColor: star <= rating
                        ? '#F59E0B' + '15'
                        : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,26,46,0.03)',
                      borderColor: star <= rating
                        ? '#F59E0B' + '40'
                        : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#F59E0B' : theme.colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.starLabel,
                      { color: star <= rating ? '#F59E0B' : theme.colors.textTertiary },
                    ]}
                  >
                    {star}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <View
                style={[
                  styles.ratingFeedback,
                  { backgroundColor: '#F59E0B' + '12', borderColor: '#F59E0B' + '30' },
                ]}
              >
                <Icon name="star" size={14} color="#F59E0B" />
                <Text style={[styles.ratingFeedbackText, { color: '#F59E0B' }]}>
                  {rating === 1 && 'Poor — Needs significant improvement'}
                  {rating === 2 && 'Fair — Below average quality'}
                  {rating === 3 && 'Good — Meets expectations'}
                  {rating === 4 && 'Very Good — Above average quality'}
                  {rating === 5 && 'Excellent — Outstanding course!'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Feedback Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)',
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: '#10B981' + '18' }]}>
                <Icon name="chatbubbles" size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Your Feedback
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Provide detailed feedback about the course content, structure, and quality
                </Text>
              </View>
              <View style={[styles.requiredBadge, { backgroundColor: '#EF4444' + '15' }]}>
                <Text style={[styles.requiredBadgeText, { color: '#EF4444' }]}>Required</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)' }]} />

            <AppInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Enter your detailed feedback here..."
              multiline={true}
              numberOfLines={8}
              textAlignVertical="top"
              style={styles.feedbackInput}
            />
            <View style={styles.characterCount}>
              <Text style={[styles.characterCountText, { color: theme.colors.textTertiary }]}>
                {feedback.length} characters
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Guidelines Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View
            style={[
              styles.guidelinesCard,
              {
                backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
              },
            ]}
          >
            <View style={styles.guidelinesHeader}>
              <View style={[styles.guidelinesIconCircle, { backgroundColor: '#6366F1' + '20' }]}>
                <Icon name="information-circle" size={18} color="#6366F1" />
              </View>
              <Text style={[styles.guidelinesTitle, { color: '#6366F1' }]}>
                Feedback Guidelines
              </Text>
            </View>
            <View style={styles.guidelinesList}>
              {[
                'Be specific about strengths and areas for improvement',
                'Consider course content accuracy and completeness',
                'Evaluate the learning materials and resources',
                'Provide constructive suggestions for enhancement',
              ].map((text, index) => (
                <View key={index} style={styles.guidelineItem}>
                  <View style={[styles.guidelineDot, { backgroundColor: '#6366F1' }]} />
                  <Text style={[styles.guidelineText, { color: theme.colors.textSecondary }]}>
                    {text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Submit Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <AppButton
            title={submitting ? 'Submitting...' : 'Submit Feedback'}
            onPress={handleSubmit}
            variant="primary"
            fullWidth
            style={styles.submitButton}
            disabled={submitting || rating === 0 || !feedback.trim()}
            leftIcon="send"
          />
        </Animated.View>
      </ScrollView>
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
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Page Header Banner
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
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: isTablet ? 1 : undefined,
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
      borderRadius: 22,
      backgroundColor: 'rgba(255,140,66,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerTextGroup: {
      flex: 1,
    },
    pageTitle: {      fontSize: isMobile ? 18 : 22,
      fontWeight: '700',
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: 2,
    },
    pageSubtitle: {
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Course Info Card
    courseInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: isMobile ? 16 : 20,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 20,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    courseIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    courseInfoText: {
      flex: 1,
    },
    courseInfoLabel: {
      fontSize: 12,
      marginBottom: 2,
      fontFamily: theme.typography.fontFamily.regular,
    },
    courseInfoName: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },

    // Section Card
    sectionCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: isMobile ? 18 : 24,
      marginBottom: 20,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)',
      }),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    sectionIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {      fontSize: 16,
      fontWeight: '700',
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: 2,
    },
    sectionSubtitle: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },
    requiredBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    requiredBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: theme.typography.fontFamily.semiBold,
      letterSpacing: 0.3,
    },
    divider: {
      height: 1,
      marginBottom: 20,
    },

    // Rating
    ratingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    starButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    starLabel: {
      fontSize: 12,
      marginTop: 4,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    ratingFeedback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    ratingFeedbackText: {
      fontSize: 14,
      fontWeight: '500',
      fontFamily: theme.typography.fontFamily.medium,
    },

    // Feedback input
    feedbackInput: {
      minHeight: 160,
    },
    characterCount: {
      alignItems: 'flex-end',
      marginTop: 8,
    },
    characterCountText: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Guidelines Card
    guidelinesCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: isMobile ? 16 : 20,
      marginBottom: 20,
    },
    guidelinesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    guidelinesIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    guidelinesTitle: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    guidelinesList: {
      gap: 10,
    },
    guidelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    guidelineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 6,
    },
    guidelineText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.regular,
    },

    // Submit Button
    submitButton: {
      marginTop: 8,
    },
  });

export default FeedbackFormScreen;
