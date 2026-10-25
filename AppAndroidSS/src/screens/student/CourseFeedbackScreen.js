import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { feedbackAPI } from '../../services/apiClient';
import Toast from 'react-native-toast-message';

const ORANGE = '#F68B3C';

const GUIDELINES = [
  'What did you enjoy most about this course?',
  'What could be improved?',
  'Would you recommend this course to others?',
  'How did this course help your learning journey?',
];

const RATING_LABELS = {
  1: 'Poor — Needs significant improvement',
  2: 'Fair — Below average quality',
  3: 'Good — Meets expectations',
  4: 'Very Good — Above average quality',
  5: 'Excellent — Outstanding course!',
};

const CourseFeedbackScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId, courseName = '' } = route.params || {};
  const { isDark } = useTheme();

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const C = {
    bg:           isDark ? '#0F0F1E' : '#EEF0FF',
    webBg:        isDark ? 'linear-gradient(135deg,#0F0F1E 0%,#1A1A2E 50%,#0F1628 100%)' : 'linear-gradient(135deg,#EEF0FF 0%,#F0F2FF 50%,#E8EEFF 100%)',
    card:         isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    cardBorder:   isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)',
    text:         isDark ? '#FFFFFF' : '#1A1A2E',
    textSub:      isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)',
    inputBg:      isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
    inputBorder:  isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,46,0.1)',
    divider:      isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,46,0.07)',
    starInactive: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,26,46,0.03)',
    starBorder:   isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
    tertiary:     isDark ? 'rgba(255,255,255,0.3)' : 'rgba(26,26,46,0.3)',
    infoBg:       isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
    infoBorder:   isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
  };

  const isWeb = Platform.OS === 'web';

  const goToCertificate = () => {
    navigation.replace('CertificatePreview', { courseId, courseName });
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({ type: 'error', text1: 'Rating required', text2: 'Please select a star rating.' });
      return;
    }
    if (!feedback.trim()) {
      Toast.show({ type: 'error', text1: 'Feedback required', text2: 'Please write a short review.' });
      return;
    }
    setSubmitting(true);
    try {
      await feedbackAPI.create({ courseName, feedback: feedback.trim(), rating, courseId });
      Toast.show({ type: 'success', text1: 'Thank you!', text2: 'Your feedback was submitted.' });
      setTimeout(goToCertificate, 900);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not submit feedback.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[s.root, isWeb ? { background: C.webBg, overflow: 'hidden', minHeight: '100vh' } : { backgroundColor: C.bg }]}>
      {/* Glow blobs */}
      <View style={[s.glow1, { backgroundColor: ORANGE + '0C' }]} />
      <View style={[s.glow2, { backgroundColor: '#6366F10A' }]} />

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 54 : 20 }]}>
        <Text style={[s.topTitle, { color: C.text }]}>
          SKILL<Text style={{ color: ORANGE }}>SPHERE</Text>
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
            <View style={[s.iconCircle, { backgroundColor: ORANGE + '22', borderColor: ORANGE + '44' }]}>
              <Icon name="star-outline" size={28} color={ORANGE} />
            </View>
            <Text style={[s.title, { color: C.text }]}>Rate Your Experience</Text>
            <Text style={[s.subtitle, { color: C.textSub }]}>
              {courseName ? `You completed "${courseName}"` : 'You completed the course'}
              {'\n'}Your feedback helps improve the learning experience
            </Text>
          </Animated.View>

          {/* Star Rating Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(80)}>
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIconCircle, { backgroundColor: '#F59E0B18' }]}>
                  <Icon name="star" size={16} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: C.text }]}>Overall Rating</Text>
                  <Text style={[s.cardSub, { color: C.textSub }]}>How would you rate this course?</Text>
                </View>
                <View style={[s.requiredPill, { backgroundColor: '#EF444415' }]}>
                  <Text style={s.requiredText}>Required</Text>
                </View>
              </View>
              <View style={[s.divider, { backgroundColor: C.divider }]} />

              <View style={s.stars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                    style={[
                      s.starBtn,
                      {
                        backgroundColor: star <= rating ? '#F59E0B15' : C.starInactive,
                        borderColor: star <= rating ? '#F59E0B40' : C.starBorder,
                      },
                    ]}
                  >
                    <Icon
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={30}
                      color={star <= rating ? '#F59E0B' : C.tertiary}
                    />
                    <Text style={[s.starNum, { color: star <= rating ? '#F59E0B' : C.tertiary }]}>{star}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {rating > 0 && (
                <View style={[s.ratingLabel, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B30' }]}>
                  <Icon name="star" size={13} color="#F59E0B" />
                  <Text style={[s.ratingLabelText, { color: '#F59E0B' }]}>{RATING_LABELS[rating]}</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Feedback Text Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(160)}>
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIconCircle, { backgroundColor: '#10B98118' }]}>
                  <Icon name="chatbubbles" size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: C.text }]}>Your Review</Text>
                  <Text style={[s.cardSub, { color: C.textSub }]}>Share your experience with this course</Text>
                </View>
                <View style={[s.requiredPill, { backgroundColor: '#EF444415' }]}>
                  <Text style={s.requiredText}>Required</Text>
                </View>
              </View>
              <View style={[s.divider, { backgroundColor: C.divider }]} />

              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Write your review here..."
                placeholderTextColor={C.tertiary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={[
                  s.textInput,
                  {
                    color: C.text,
                    backgroundColor: C.inputBg,
                    borderColor: C.inputBorder,
                    // @ts-ignore web-only
                    outlineStyle: 'none',
                  },
                ]}
              />
              <Text style={[s.charCount, { color: C.tertiary }]}>{feedback.length} characters</Text>
            </View>
          </Animated.View>

          {/* Guidelines */}
          <Animated.View entering={FadeInDown.duration(400).delay(240)}>
            <View style={[s.infoCard, { backgroundColor: C.infoBg, borderColor: C.infoBorder }]}>
              <View style={s.infoHeader}>
                <View style={[s.cardIconCircle, { backgroundColor: '#6366F120' }]}>
                  <Icon name="information-circle" size={16} color="#6366F1" />
                </View>
                <Text style={[s.infoTitle, { color: '#6366F1' }]}>Things to consider</Text>
              </View>
              {GUIDELINES.map((g, i) => (
                <View key={i} style={s.guideRow}>
                  <View style={[s.dot, { backgroundColor: '#6366F1' }]} />
                  <Text style={[s.guideText, { color: C.textSub }]}>{g}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Submit button */}
          <Animated.View entering={FadeInDown.duration(400).delay(320)}>
            <TouchableOpacity
              style={[
                s.submitBtn,
                { opacity: submitting || rating === 0 || !feedback.trim() ? 0.55 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={submitting || rating === 0 || !feedback.trim()}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#FFF" />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="ribbon-outline" size={16} color="#FFF" />
                    <Text style={s.submitBtnText}>Submit & Get Certificate</Text>
                  </View>
                )}
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root:            { flex: 1 },
  glow1:           { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -60, right: -60, zIndex: 0 },
  glow2:           { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: 80, left: -70, zIndex: 0 },
  topBar:          { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, zIndex: 10 },
  topTitle:        { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  scroll:          { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, maxWidth: 560, alignSelf: 'center', width: '100%' },
  header:          { alignItems: 'center', paddingVertical: 28 },
  iconCircle:      { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  title:           { fontSize: 24, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  subtitle:        { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  card:            { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconCircle:  { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle:       { fontSize: 15, fontWeight: '700', marginBottom: 1 },
  cardSub:         { fontSize: 12 },
  requiredPill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  requiredText:    { fontSize: 10, fontWeight: '700', color: '#EF4444', letterSpacing: 0.3 },
  divider:         { height: 1, marginBottom: 16 },
  stars:           { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  starBtn:         { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  starNum:         { fontSize: 11, fontWeight: '600', marginTop: 4 },
  ratingLabel:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  ratingLabelText: { fontSize: 13, fontWeight: '500' },
  textInput:       { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 120, lineHeight: 22 },
  charCount:       { fontSize: 11, textAlign: 'right', marginTop: 6 },
  infoCard:        { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  infoHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoTitle:       { fontSize: 14, fontWeight: '600' },
  guideRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  dot:             { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  guideText:       { flex: 1, fontSize: 12, lineHeight: 18 },
  submitBtn:       { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', justifyContent: 'center', alignItems: 'center', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  submitBtnText:   { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.12 },
});

export default CourseFeedbackScreen;
