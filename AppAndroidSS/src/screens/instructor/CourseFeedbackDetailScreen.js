import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import UserAvatar from '../../components/ui/UserAvatar';

const ORANGE = '#F68B3C';

const StarRow = ({ rating, size = 14, isDark }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(s => (
      <Icon
        key={s}
        name={s <= rating ? 'star' : 'star-outline'}
        size={size}
        color={s <= rating ? ORANGE : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,46,0.18)')}
      />
    ))}
  </View>
);

const formatDate = d => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ratingColor = r => r >= 4 ? '#10B981' : r >= 3 ? '#F59E0B' : '#EF4444';

const CourseFeedbackDetailScreen = () => {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();

  const { courseName = '', feedbacks = [], avgRating = 0, feedbackCount = 0 } = route.params || {};

  const isMobile = width <= 480;
  const isTablet = width > 768;
  const pad = isMobile ? 16 : 24;

  const ratingDist = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    feedbacks.forEach(f => { if (f.rating >= 1 && f.rating <= 5) dist[f.rating]++; });
    return dist;
  }, [feedbacks]);

  const s = getStyles(theme, isDark, isMobile, isTablet);
  const avgNum = parseFloat(avgRating) || 0;

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header */}
      <View style={[s.header, {
        backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
        borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#EAECF0',
      }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {courseName}
          </Text>
          <Text style={[s.headerSub, { color: theme.colors.textSecondary }]}>
            {feedbackCount} {feedbackCount === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
        <View style={[s.headerBadge, { backgroundColor: ratingColor(avgNum) + '18' }]}>
          <Icon name="star" size={13} color={ratingColor(avgNum)} />
          <Text style={[s.headerBadgeTxt, { color: ratingColor(avgNum) }]}>{avgNum}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: pad, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <View style={[s.summaryCard, {
          backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF0',
        }]}>
          {/* Big rating */}
          <View style={s.summaryLeft}>
            <Text style={[s.bigRating, { color: theme.colors.textPrimary }]}>{avgNum}</Text>
            <StarRow rating={Math.round(avgNum)} size={18} isDark={isDark} />
            <Text style={[s.reviewCount, { color: theme.colors.textSecondary }]}>
              {feedbackCount} {feedbackCount === 1 ? 'review' : 'reviews'}
            </Text>
          </View>

          {/* Rating distribution bars */}
          <View style={s.summaryRight}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = ratingDist[star];
              const pct = feedbackCount > 0 ? count / feedbackCount : 0;
              return (
                <View key={star} style={s.distRow}>
                  <Text style={[s.distLabel, { color: theme.colors.textSecondary }]}>{star}</Text>
                  <Icon name="star" size={10} color={ORANGE} style={{ marginRight: 4 }} />
                  <View style={[s.distTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F0F3F8' }]}>
                    <View style={[s.distFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: ORANGE }]} />
                  </View>
                  <Text style={[s.distCount, { color: theme.colors.textTertiary }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Reviews */}
        {feedbacks.length > 0 ? (
          <View style={s.list}>
            {feedbacks.map((fb, i) => (
              <Animated.View
                key={fb.id}
                entering={FadeInDown.duration(350).delay(i * 50)}
                style={[s.reviewCard, {
                  backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF0',
                }]}
              >
                {/* Top row */}
                <View style={s.reviewTop}>
                  <View style={s.reviewerRow}>
                    <UserAvatar user={{ name: fb.studentName || '?' }} size={40} />
                    <View style={s.reviewerInfo}>
                      <Text style={[s.reviewerName, { color: theme.colors.textPrimary }]}>
                        {fb.studentName || 'Anonymous'}
                      </Text>
                      <Text style={[s.reviewDate, { color: theme.colors.textTertiary }]}>
                        {formatDate(fb.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={s.reviewRatingCol}>
                    <StarRow rating={fb.rating} size={13} isDark={isDark} />
                    <View style={[s.ratingBadge, {
                      backgroundColor: ratingColor(fb.rating) + '15',
                      borderColor: ratingColor(fb.rating) + '30',
                    }]}>
                      <Text style={[s.ratingBadgeTxt, { color: ratingColor(fb.rating) }]}>
                        {fb.rating}/5
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Comment */}
                {fb.feedback ? (
                  <View style={[s.commentBox, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(246,139,60,0.04)',
                    borderLeftColor: ORANGE,
                  }]}>
                    <Text style={[s.commentText, { color: theme.colors.textSecondary }]}>
                      "{fb.feedback}"
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.noComment, { color: theme.colors.textTertiary }]}>No written review</Text>
                )}
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={[s.emptyCard, {
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF0',
          }]}>
            <View style={[s.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8F9FA' }]}>
              <Icon name="chatbubbles-outline" size={32} color={theme.colors.textTertiary} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.colors.textPrimary }]}>No reviews yet</Text>
            <Text style={[s.emptySub, { color: theme.colors.textSecondary }]}>
              Student feedback will appear here after course completion
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme, isDark, isMobile, isTablet) => StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isMobile ? 14 : 20,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    borderBottomWidth: 1,
    gap: 12,
    ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.06)' }),
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.05)',
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: isMobile ? 16 : 18,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: 1,
  },
  headerSub: { fontSize: 12, fontFamily: theme.typography.fontFamily.regular },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  headerBadgeTxt: { fontSize: 14, fontWeight: '700', fontFamily: theme.typography.fontFamily.bold },

  summaryCard: {
    flexDirection: isTablet ? 'row' : 'column',
    borderRadius: 16,
    borderWidth: 1,
    padding: isMobile ? 18 : 24,
    marginBottom: 20,
    gap: 20,
    alignItems: isTablet ? 'center' : 'flex-start',
    ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 2px 12px rgba(26,26,46,0.07)' }),
  },
  summaryLeft: { alignItems: 'center', gap: 6, minWidth: 90 },
  bigRating: {
    fontSize: isMobile ? 48 : 56,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.bold,
    lineHeight: isMobile ? 56 : 64,
  },
  reviewCount: { fontSize: 12, fontFamily: theme.typography.fontFamily.regular, marginTop: 4 },
  summaryRight: { flex: 1, gap: 7, width: isTablet ? undefined : '100%' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distLabel: { fontSize: 12, fontFamily: theme.typography.fontFamily.regular, width: 10, textAlign: 'right' },
  distTrack: {
    flex: 1, height: 6, borderRadius: 3, overflow: 'hidden',
  },
  distFill: { height: '100%', borderRadius: 3 },
  distCount: { fontSize: 11, fontFamily: theme.typography.fontFamily.regular, width: 16, textAlign: 'right' },

  list: { gap: 12 },
  reviewCard: {
    borderRadius: 16, borderWidth: 1, padding: isMobile ? 14 : 18,
    ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.05)' }),
  },
  reviewTop: {
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    gap: 10,
    marginBottom: 12,
  },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: isMobile ? undefined : 1 },
  reviewerInfo: { flex: 1 },
  reviewerName: {
    fontSize: 15, fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semiBold, marginBottom: 3,
  },
  reviewDate: { fontSize: 12, fontFamily: theme.typography.fontFamily.regular },
  reviewRatingCol: { alignItems: 'flex-end', gap: 6 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  ratingBadgeTxt: { fontSize: 12, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold },

  commentBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentText: {
    fontSize: 14, lineHeight: 22,
    fontFamily: theme.typography.fontFamily.regular, fontStyle: 'italic',
  },
  noComment: { fontSize: 13, fontFamily: theme.typography.fontFamily.regular, fontStyle: 'italic' },

  emptyCard: {
    borderRadius: 16, borderWidth: 1, padding: 48, alignItems: 'center', marginTop: 8,
    ...(Platform.OS === 'web' && { boxShadow: isDark ? 'none' : '0 1px 8px rgba(26,26,46,0.05)' }),
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: theme.typography.fontFamily.semiBold, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: theme.typography.fontFamily.regular, textAlign: 'center', maxWidth: 260 },
});

export default CourseFeedbackDetailScreen;
