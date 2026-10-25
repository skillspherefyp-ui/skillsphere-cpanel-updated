import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Animated as RNAnimated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { slugify } from '../../utils/urlHelpers';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MainLayout from '../../components/ui/MainLayout';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import AppButton from '../../components/ui/AppButton';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { aiTutorAPI, API_BASE } from '../../services/apiClient';
import DiagramCanvas from '../../components/DiagramCanvas';
import VoiceQAOverlay from '../../components/VoiceQAOverlay';
import { Reveal, StageCaption, BeatTimeline, buildTeachingBeats, activeBeatFor, beatActivity } from '../../components/classroom/LiveStage';
import AITeacherAvatar from '../../components/classroom/AITeacherAvatar';
import SpeakingWaveform from '../../components/classroom/SpeakingWaveform';
import IntelligentWhiteboard from '../../components/classroom/IntelligentWhiteboard';
import MarkdownText from '../../components/ui/MarkdownText';
import { getSidebarItems } from '../../utils/sidebarItems';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ─── Listening / transcribing visual (shown inside scroll area during composing) ─
const QAPhaseVisual = ({ isListening, isTranscribing }) => {
  const accent = '#f59e0b';
  const innerPulse = useRef(new RNAnimated.Value(1)).current;
  const outerPulse = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    innerPulse.stopAnimation(); innerPulse.setValue(1);
    outerPulse.stopAnimation(); outerPulse.setValue(0);
    if (isListening) {
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(innerPulse, { toValue: 1.18, duration: 550, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(innerPulse, { toValue: 1,    duration: 550, useNativeDriver: USE_NATIVE_DRIVER }),
      ])).start();
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(outerPulse, { toValue: 1, duration: 0,   useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(outerPulse, { toValue: 0, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.delay(300),
      ])).start();
    }
    return () => { innerPulse.stopAnimation(); outerPulse.stopAnimation(); };
  }, [isListening]);

  if (isListening) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 36, gap: 20 }}>
        <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <RNAnimated.View style={{
            position: 'absolute', width: 120, height: 120, borderRadius: 60,
            borderWidth: 2, borderColor: '#ef4444',
            opacity: outerPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
            transform: [{ scale: outerPulse.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] }) }],
          }} />
          <RNAnimated.View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: 'rgba(239,68,68,0.15)',
            borderWidth: 2.5, borderColor: '#ef4444',
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: innerPulse }],
          }}>
            <Icon name="mic" size={36} color="#ef4444" />
          </RNAnimated.View>
        </View>
        <Text style={{ color: '#fca5a5', fontSize: 20, fontWeight: '800' }}>Listening…</Text>
        <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center' }}>
          Speak your question · English, Urdu &amp; Roman Urdu supported
        </Text>
      </View>
    );
  }
  if (isTranscribing) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 36, gap: 16 }}>
        <ActivityIndicator size="large" color={accent} />
        <Text style={{ color: accent, fontSize: 17, fontWeight: '800' }}>Understanding your question…</Text>
        <Text style={{ color: '#475569', fontSize: 13 }}>Converting speech to text</Text>
      </View>
    );
  }
  return null;
};

// ─── Compact waveform banner shown ABOVE the content while AI speaks ──────────
const QASpeakingBanner = () => {
  const accent = '#f59e0b';
  const waveAnims = useRef(Array.from({ length: 12 }, () => new RNAnimated.Value(4))).current;
  const timers    = useRef([]);

  useEffect(() => {
    const run = (anim, i) => {
      const target = 4 + Math.random() * 28;
      RNAnimated.timing(anim, { toValue: target, duration: 100 + Math.random() * 120, useNativeDriver: false })
        .start(({ finished }) => { if (finished) timers.current[i] = setTimeout(() => run(anim, i), 20); });
    };
    waveAnims.forEach((anim, i) => { timers.current[i] = setTimeout(() => run(anim, i), i * 40); });
    return () => { timers.current.forEach(t => clearTimeout(t)); timers.current = []; };
  }, []);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 10,
      borderTopWidth: 1, borderBottomWidth: 1,
      borderColor: `${accent}30`,
      backgroundColor: `${accent}0d`,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, gap: 3 }}>
        {waveAnims.map((anim, i) => (
          <RNAnimated.View key={i} style={{
            width: 3, borderRadius: 2, backgroundColor: accent,
            height: anim, opacity: 0.55 + (i % 4) * 0.1,
          }} />
        ))}
      </View>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginLeft: 4 }} />
      <Text style={{ color: accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, flex: 1 }}>
        SKILLSPHERE AI IS SPEAKING
      </Text>
    </View>
  );
};

// ─── Eye-catching "AI is thinking" animation ───────────────────────────────
// A glowing brain orb: two breathing halo rings, a spinning accent arc, a
// soft pulsing core and a gently floating brain icon + bouncing dots. Used
// while the tutor is composing an answer to a student's question.
const ThinkingIndicator = ({ accent = '#f59e0b', label = 'Let me think about that…' }) => {
  const ring1 = useRef(new RNAnimated.Value(0)).current;
  const ring2 = useRef(new RNAnimated.Value(0)).current;
  const spin = useRef(new RNAnimated.Value(0)).current;
  const float = useRef(new RNAnimated.Value(0)).current;
  const dot0 = useRef(new RNAnimated.Value(0)).current;
  const dot1 = useRef(new RNAnimated.Value(0)).current;
  const dot2 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // A breathing halo that expands and fades, then snaps back to restart.
    const halo = (val) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(val, { toValue: 1, duration: 2000, useNativeDriver: USE_NATIVE_DRIVER }),
          RNAnimated.timing(val, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );
    const a1 = halo(ring1);
    // Second halo offset by ~1s so the rings ripple outward in sequence.
    const a2 = RNAnimated.sequence([RNAnimated.delay(1000), halo(ring2)]);
    const a3 = RNAnimated.loop(
      RNAnimated.timing(spin, { toValue: 1, duration: 3200, useNativeDriver: USE_NATIVE_DRIVER })
    );
    const a4 = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(float, { toValue: 1, duration: 1300, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(float, { toValue: 0, duration: 1300, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    const bounce = (val, delay) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(val, { toValue: 1, duration: 380, useNativeDriver: USE_NATIVE_DRIVER }),
          RNAnimated.timing(val, { toValue: 0, duration: 380, useNativeDriver: USE_NATIVE_DRIVER }),
          RNAnimated.delay(760 - delay),
        ])
      );
    const d0 = bounce(dot0, 0);
    const d1 = bounce(dot1, 190);
    const d2 = bounce(dot2, 380);
    const all = [a1, a2, a3, a4, d0, d1, d2];
    all.forEach((a) => a.start());
    return () => all.forEach((a) => a.stop());
  }, []);

  const haloStyle = (val) => ({
    borderColor: accent,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
  });
  const dotStyle = (val) => ({
    backgroundColor: accent,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
  });

  return (
    <View style={styles.thinkWrap}>
      <View style={styles.thinkOrb}>
        <RNAnimated.View style={[styles.thinkHalo, haloStyle(ring1)]} />
        <RNAnimated.View style={[styles.thinkHalo, haloStyle(ring2)]} />
        <View style={[styles.thinkGlow, { backgroundColor: `${accent}22` }]} />
        <RNAnimated.View
          style={[
            styles.thinkArc,
            {
              borderTopColor: accent,
              transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            },
          ]}
        />
        <RNAnimated.View
          style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }] }}
        >
          <MaterialIcon name="brain" size={28} color={accent} />
        </RNAnimated.View>
      </View>
      <View style={styles.thinkLabelRow}>
        <Text style={[styles.thinkLabel, { color: accent }]}>{label}</Text>
        <View style={styles.thinkDots}>
          <RNAnimated.View style={[styles.thinkDot, dotStyle(dot0)]} />
          <RNAnimated.View style={[styles.thinkDot, dotStyle(dot1)]} />
          <RNAnimated.View style={[styles.thinkDot, dotStyle(dot2)]} />
        </View>
      </View>
    </View>
  );
};

// ─── Skeleton loader shown while course/topic data is being fetched ──────────
const LectureSkeleton = ({ isDark, theme }) => {
  const shimmer = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const skelBg = isDark ? '#1e2035' : '#dde3ef';
  const panelBg = isDark ? '#0d0d1f' : '#1e293b';
  const mainBg = isDark ? '#0f0f1a' : theme.colors.background;

  const Bone = ({ style }) => (
    <RNAnimated.View style={[{ backgroundColor: skelBg, borderRadius: 8, opacity }, style]} />
  );

  return (
    <MainLayout showSidebar={false} showHeader={true} showBack={true}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: mainBg }}>
        {/* Icon rail */}
        <View style={{ width: 78, backgroundColor: panelBg, alignItems: 'center', paddingTop: 20, gap: 18 }}>
          {[0, 1, 2, 3, 4, 5].map(i => <Bone key={i} style={{ width: 46, height: 46, borderRadius: 12 }} />)}
        </View>
        {/* Main area */}
        <View style={{ flex: 1, padding: 20, gap: 14 }}>
          {/* Top bar: title + chunk progress */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Bone style={{ width: 220, height: 20 }} />
            <Bone style={{ width: 70, height: 20 }} />
          </View>
          {/* Progress strip */}
          <Bone style={{ width: '100%', height: 5, borderRadius: 3 }} />
          {/* Whiteboard / visual area */}
          <Bone style={{ width: '100%', height: 260, borderRadius: 16, marginTop: 4 }} />
          {/* Subtitle bar */}
          <Bone style={{ width: '100%', height: 48, borderRadius: 10 }} />
          {/* Spoken text lines */}
          <Bone style={{ width: '96%', height: 14 }} />
          <Bone style={{ width: '88%', height: 14 }} />
          <Bone style={{ width: '92%', height: 14 }} />
          <Bone style={{ width: '72%', height: 14 }} />
          {/* Bottom controls row */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Bone style={{ flex: 1, height: 44, borderRadius: 12 }} />
            <Bone style={{ width: 44, height: 44, borderRadius: 12 }} />
            <Bone style={{ flex: 1, height: 44, borderRadius: 12 }} />
          </View>
        </View>
      </View>
    </MainLayout>
  );
};

const AILearningScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { width, height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const sidebarItems = getSidebarItems(user?.role);
  const handleNavigate = (routeName) => {
    if (routeName === 'CertificateVerify') {
      navigation.navigate(routeName, { fromStudent: true });
    } else {
      navigation.navigate(routeName);
    }
  };
  const { courseId, topicId } = route.params || {};
  const { courses, checkEnrollment, fetchCourses, isLoading: coursesLoading, getCourseById } = useData();
  const [localCourse, setLocalCourse] = useState(null);
  const [fetchingCourse, setFetchingCourse] = useState(true);
  const course = courses.find((item) => String(item.id) === String(courseId)) || localCourse;
  const topic = course?.topics?.find((item) => String(item.id) === String(topicId));

  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [lecture, setLecture] = useState(null);
  const [session, setSession] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [showQuestionPanel, setShowQuestionPanel] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [voiceMode, setVoiceMode] = useState(Platform.OS === 'web');
  const [isRecording, setIsRecording] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [lectureCompleted, setLectureCompleted] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showTopicsSidebar, setShowTopicsSidebar] = useState(false);
  const [revealedFlashcards, setRevealedFlashcards] = useState({});
  const [teachingProgress, setTeachingProgress] = useState(0);

  // On a new chunk, forget old screenshot offsets and snap the board back to top.
  useEffect(() => {
    guidedOffsetsRef.current = {};
    guidedActiveRef.current = -1;
    guidedScrolledRef.current = -1;
    boardScrollRef.current?.scrollTo({ y: 0, animated: false });
    setCheckpointInput('');
    setCheckpointStatus(null);
    setCheckpointFeedback('');
    setCheckpointEvaluating(false);
    checkpointStatusRef.current = null;
    checkpointActiveRef.current = false;
    checkpointUserAdvancedRef.current = false;
    if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
  }, [currentChunk?.id]);

  // Pause the lecture the moment the checkpoint beat becomes active so the
  // auto-advance cannot fire while the student is typing their answer.
  useEffect(() => {
    if (activeBeat?.kind === 'checkpoint' && !!checkpointText) {
      checkpointActiveRef.current = true;
      if (!checkpointStatusRef.current && isPlaying) {
        pauseLecturePlayback();
      }
    }
  }, [activeBeat?.kind]);

  const handleCheckpointAdvance = async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.id) return;
    try {
      const response = await aiTutorAPI.getNextChunk(currentSession.id);
      if (response.lectureCompleted || !response.chunk) {
        setLectureCompleted(true);
        setShowCompleteDialog(true);
        await fetchCourses();
      } else {
        setSession(response.session);
        setCurrentChunk(response.chunk);
        setShowQuestionPanel(false);
        setIsPlaying(true);
      }
    } catch (_) {}
  };

  // As the tutor narrates each install/setup screenshot, glide the board so the
  // step they're talking about stays in view (synced to teachingProgress).
  useEffect(() => {
    const target = guidedActiveRef.current;
    if (target < 0 || target === guidedScrolledRef.current) return;
    const y = guidedOffsetsRef.current[target];
    if (typeof y !== 'number') return;
    guidedScrolledRef.current = target;
    boardScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, [teachingProgress, isPlaying]);

  const [quizPreview, setQuizPreview] = useState(null);
  const [quizPreviewLoading, setQuizPreviewLoading] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [studentNotes, setStudentNotes] = useState('');
  const [notesSavedAt, setNotesSavedAt] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [diagramStep, setDiagramStep] = useState(-1);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [isSpeakingChunk, setIsSpeakingChunk] = useState(false);
  const [showLiveText, setShowLiveText] = useState(true);
  const [showVoiceQA, setShowVoiceQA] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  // ── Inline "raise your hand" Q&A, answered right on the classroom board ──
  const [qaActive, setQaActive] = useState(false);
  const [qaPhase, setQaPhase] = useState('composing'); // composing | thinking | answering | done
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaVisual, setQaVisual] = useState(null);
  const [qaInput, setQaInput] = useState('');
  const [qaListening, setQaListening] = useState(false);
  const [qaGreeting, setQaGreeting] = useState('');
  const [qaGreetingPlaying, setQaGreetingPlaying] = useState(false);
  const qaAudioRef = useRef(null);
  const qaRecognitionRef = useRef(null);
  const qaRecorderRef = useRef(null);
  const qaStreamRef = useRef(null);
  const qaChunksRef = useRef([]);
  const qaSubmitOnStopRef = useRef(true);
  const qaSubmitAfterStopRef = useRef(false);
  const greetingAudioRef = useRef(null); // { text, audio } — pre-warmed greeting for instant playback
  const [qaTranscribing, setQaTranscribing] = useState(false);

  // ── Checkpoint interactive answer box ──
  const [checkpointInput, setCheckpointInput] = useState('');
  const [checkpointStatus, setCheckpointStatus] = useState(null); // null | 'correct' | 'wrong' | 'skipped'
  const [checkpointFeedback, setCheckpointFeedback] = useState('');
  const [checkpointEvaluating, setCheckpointEvaluating] = useState(false);
  const checkpointTimerRef = useRef(null);
  const checkpointStatusRef = useRef(null); // live ref so closures read current value
  const checkpointActiveRef = useRef(false); // true when a checkpoint question is visible
  const checkpointTextRef = useRef(''); // mirrors checkpointText so scheduleNext can read it
  const checkpointUserAdvancedRef = useRef(false); // true only when user clicked Next/Skip
  const sessionRef = useRef(null); // always-fresh session for use inside closures/intervals

  const chatScrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const playbackRef = useRef(null);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  // Monotonic token: every playback start claims one; stop/skip bumps it. A stale
  // (superseded) async playChunk checks this and aborts — prevents two TTS voices
  // overlapping when chunks are skipped/advanced quickly.
  const playbackTokenRef = useRef(0);
  const handRaiseTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const diagramTimersRef = useRef([]);
  // ── Resume mid-chunk: remember where the voice was when the student hit pause ──
  const resumeAtRef = useRef(0);       // seconds into the current chunk's audio
  const resumeChunkRef = useRef(null); // which chunk that position belongs to
  // ── Auto-scroll the guided-steps board to whatever screenshot the tutor is on ──
  const boardScrollRef = useRef(null);
  const guidedOffsetsRef = useRef({}); // step index → y offset inside the board scroll
  const guidedActiveRef = useRef(-1);  // step the tutor is currently narrating
  const guidedScrolledRef = useRef(-1); // last step we already scrolled to
  const baseHost = API_BASE.replace(/\/api$/, '');
  const isMobile = width < 768;
  // Stage layout breakpoints: keep the living-teacher column + board readable.
  const showTutorColumn = width >= 980;   // full avatar column beside the board
  const showVisualRail = width >= 1180;   // extra Live Visual / Key Points rail

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages.length, submittingQuestion]);

  const orderedChunks = useMemo(() => {
    return (lecture?.sections || []).slice().sort((a, b) => {
      if (a.sectionIndex === b.sectionIndex) {
        return a.chunkIndex - b.chunkIndex;
      }
      return a.sectionIndex - b.sectionIndex;
    });
  }, [lecture]);

  const currentIndex = useMemo(() => {
    if (!currentChunk) return 0;
    const index = orderedChunks.findIndex((item) => item.id === currentChunk.id);
    return index >= 0 ? index : 0;
  }, [orderedChunks, currentChunk]);

  const progress = orderedChunks.length ? Math.min(100, Math.round(((currentIndex + (lectureCompleted ? 1 : 0)) / orderedChunks.length) * 100)) : 0;
  const currentVisual = (lecture?.visualSuggestions || []).find((item) => item.sectionIndex === currentChunk?.sectionIndex);
  const currentSlides = (lecture?.slideOutlines || []).filter((slide) => slide.slideIndex === currentChunk?.sectionIndex);
  const totalChunks = orderedChunks.length || 1;
  const currentSlide = currentSlides[0];
  const currentDelivery = currentChunk?.delivery || null;
  const panelContent = currentDelivery?.panel_content || {};
  const teachingPlan = currentDelivery?.teaching_plan || currentChunk?.teachingPlan || {};
  const classroomMode = currentDelivery?.classroom_mode || 'narration_only';
  const classroomModeLabel = currentDelivery?.classroom_mode_label || 'Narration only';
  const boardContent = currentDelivery?.board_content || panelContent.boardContent || null;
  const supportPanel = currentDelivery?.support_panel || panelContent.supportPanel || null;
  const narrationSegments = currentDelivery?.narration_segments || [];
  const currentNarration = currentDelivery?.narration_text || currentChunk?.spokenExplanation || currentChunk?.text || '';
  const transitionText = currentDelivery?.transition_text || panelContent.transitionIn || '';
  const checkpointText = currentDelivery?.checkpoint_text || panelContent.checkpointQuestion || currentChunk?.checkpointQuestion || '';
  checkpointTextRef.current = checkpointText;
  sessionRef.current = session;
  const reinforcementPoints = panelContent.reinforcementPoints || teachingPlan.reinforcement_points || [];
  const confusionPoints = panelContent.likelyConfusionPoints || teachingPlan.likely_confusion_points || [];
  const teachingStyleLabel = currentDelivery?.teaching_style_label || panelContent.teachingStyleLabel || 'Brief explanation';
  const conceptTypeLabel = teachingPlan?.concept_type ? teachingPlan.concept_type.replace(/-/g, ' ') : 'conceptual';
  const recommendedDurationMs = (() => {
    const plannerSecs = currentDelivery?.recommended_duration_seconds || 0;
    if (plannerSecs > 0) return plannerSecs * 1000;
    // Derive from actual narration word count (130 wpm) — more accurate than GPT's stored estimate
    const narration = currentDelivery?.narration_text || currentChunk?.spokenExplanation || '';
    const words = narration.trim().split(/\s+/).filter(Boolean).length;
    if (words > 0) return Math.round(words / 130 * 60) * 1000;
    return (currentChunk?.estimatedDurationSeconds || 0) * 1000;
  })();
  const currentModeLabel = currentDelivery?.current_mode_label || (showQuestionPanel ? 'Answering your question' : voiceMode ? 'Explaining' : 'Teaching in text mode');
  const formatLectureDuration = (minutes) => {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value < 60) return `${value} min lecture`;

    const hours = Math.floor(value / 60);
    const remainingMinutes = value % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m lecture` : `${hours}h lecture`;
  };
  const lectureDurationLabel = formatLectureDuration(lecture?.estimatedDurationMinutes);
  const isDrawerOpen = Boolean(activeToolPanel);
  const studentName = user?.name || user?.fullName || user?.email?.split('@')[0] || 'student';
  const notesStorageKey = lecture?.id && topicId ? `@skillsphere:lecture-notes:${user?.id || 'guest'}:${topicId}:${lecture.id}` : null;
  const tutorStatus = lectureCompleted
    ? { label: 'Lecture complete', detail: 'Open the stored quiz when you are ready to continue.', tone: '#10b981' }
    : showQuestionPanel
      ? { label: 'Paused for your question', detail: submittingQuestion ? 'AI Tutor is preparing a contextual answer.' : 'Ask for clarification, then resume from this exact chunk.', tone: '#f59e0b' }
      : isPlaying
        ? { label: currentModeLabel, detail: transitionText || (currentDelivery?.next_action ? `Sequence: ${(currentDelivery.teaching_sequence || []).join(' -> ')}.` : (voiceMode ? 'Voice delivery is active for this section.' : 'Stored lecture chunks are advancing in text mode.')), tone: '#3b82f6' }
        : { label: 'Ready to resume', detail: 'Resume when you are ready for the next chunk.', tone: '#6366f1' };

  // ─── Stage Director: decompose the live chunk into choreographed teaching beats ───
  const teachingBeats = useMemo(
    () => buildTeachingBeats({ chunk: currentChunk, delivery: currentDelivery, narration: currentNarration }),
    [currentChunk?.id, currentDelivery, currentNarration]
  );
  const activeBeat = useMemo(
    () => activeBeatFor(teachingBeats, teachingProgress),
    [teachingBeats, teachingProgress]
  );
  const beatProgress = activeBeat
    ? Math.max(0, Math.min(1, (teachingProgress - activeBeat.start) / Math.max(0.0001, activeBeat.end - activeBeat.start)))
    : 0;
  // Board art should finish drawing by the time the explain beat ends, so the
  // visual is complete before the tutor moves on to the example / checkpoint.
  const boardReveal = (() => {
    const explainBeat = teachingBeats.find((b) => b.kind === 'explain');
    return explainBeat ? Math.min(1, teachingProgress / Math.max(0.15, explainBeat.end)) : teachingProgress;
  })();
  const avatarState = lectureCompleted
    ? 'complete'
    : (showQuestionPanel || isRecording)
      ? 'listening'
      : (isAdvancing || isPreparing)
        ? 'thinking'
        : !isPlaying
          ? 'idle'
          : activeBeat?.kind === 'checkpoint'
            ? 'thinking'
            : 'speaking';
  const activity = beatActivity(activeBeat);
  const activityColor = activity.color;
  const captionPlaying = (isPlaying || isAdvancing || isPreparing) && !showQuestionPanel && !lectureCompleted;
  const captionText = (isAdvancing || isPreparing)
    ? (transitionText || 'Let me walk you through the next idea…')
    : (activeBeat?.text || currentNarration);

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    if (voiceMode) pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, voiceMode]);

  // On a hard page refresh courses may not be loaded yet — fetch them so the
  // topic lookup succeeds before loadLecture() runs.
  // Also handles courses beyond DataContext's page-1 limit by fetching individually.
  useEffect(() => {
    const inContext = courses.find((item) => String(item.id) === String(courseId));
    if (inContext || !courseId) {
      setFetchingCourse(false);
    } else {
      getCourseById(courseId)
        .then(res => { if (res.success && res.course) setLocalCourse(res.course); })
        .finally(() => setFetchingCourse(false));
    }
  }, []);

  useEffect(() => {
    loadLecture();
    return () => {
      stopPlayback();
      stopRecognition();
    };
  }, [topicId, voiceMode]);

  useEffect(() => {
    setRevealedFlashcards({});
  }, [lecture?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadStoredNotes = async () => {
      if (!notesStorageKey) {
        setStudentNotes('');
        setNotesSavedAt(null);
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(notesStorageKey);
        if (!cancelled && stored) {
          const parsed = JSON.parse(stored);
          setStudentNotes(parsed?.text || '');
          setNotesSavedAt(parsed?.savedAt || null);
        } else if (!cancelled) {
          setStudentNotes('');
          setNotesSavedAt(null);
        }
      } catch (_) {
        if (!cancelled) {
          setStudentNotes('');
          setNotesSavedAt(null);
        }
      }
    };

    loadStoredNotes();
    return () => {
      cancelled = true;
    };
  }, [notesStorageKey]);

  useEffect(() => {
    if (activeToolPanel !== 'quiz' || !lecture?.id) {
      return;
    }

    let cancelled = false;
    const loadQuizPreview = async () => {
      setQuizPreviewLoading(true);
      try {
        const response = await aiTutorAPI.getQuiz(lecture.id);
        if (!cancelled && response.success) {
          setQuizPreview(response.quiz || null);
        }
      } catch (_) {
        if (!cancelled) {
          setQuizPreview(null);
        }
      } finally {
        if (!cancelled) {
          setQuizPreviewLoading(false);
        }
      }
    };

    loadQuizPreview();
    return () => {
      cancelled = true;
    };
  }, [activeToolPanel, lecture?.id]);

  useEffect(() => {
    if (session && currentChunk && isPlaying && !showQuestionPanel && !lectureCompleted) {
      playChunk();
    } else {
      stopPlayback();
    }

    return () => stopPlayback();
  }, [session?.id, currentChunk?.id, isPlaying, showQuestionPanel, lectureCompleted, voiceMode]);

  // Pre-warm + preload the "Ask Question" greeting so it speaks INSTANTLY on click
  // (no waiting for TTS generation). Runs quietly in the background.
  useEffect(() => {
    if (!session?.id || Platform.OS !== 'web') return undefined;
    const name = `${user?.name || user?.fullName || user?.email?.split('@')[0] || ''}`.trim().split(' ')[0] || 'there';
    const isUrduCourse = course?.language === 'Urdu';
    const text = isUrduCourse
      ? `${name}، آپ کا کیا سوال ہے؟ میں نے آپ کے لیے لیکچر روک دیا ہے۔`
      : `Hello ${name}, what's your question?`;
    if (greetingAudioRef.current?.text === text && greetingAudioRef.current?.audio) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await aiTutorAPI.speakText({ lectureId: lecture?.id, sessionId: session?.id, assetType: 'qa_answer', text });
        const url = res?.asset?.urlPath ? `${baseHost}${res.asset.urlPath}` : res?.audioUrl;
        if (url && !cancelled) {
          const audio = new Audio(url);
          audio.preload = 'auto';
          try { audio.load(); } catch (_) {}
          greetingAudioRef.current = { text, audio };
        }
      } catch (_) { /* greeting will fall back to instant speech-synth */ }
    })();
    return () => { cancelled = true; };
  }, [session?.id, user?.name, course?.language]);

  useEffect(() => {
    setTeachingProgress(0);
    diagramTimersRef.current.forEach(clearTimeout);
    diagramTimersRef.current = [];
    // Show diagram immediately if the chunk has one — don't wait for playback
    if (currentChunk?.diagramData?.nodes?.length) {
      setDiagramStep(0);
    } else {
      setDiagramStep(-1);
    }
  }, [currentChunk?.id]);

  useEffect(() => {
    return () => {
      if (handRaiseTimeoutRef.current) {
        clearTimeout(handRaiseTimeoutRef.current);
        handRaiseTimeoutRef.current = null;
      }
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!currentChunk || !isPlaying || showQuestionPanel || lectureCompleted) {
      return undefined;
    }

    const duration = recommendedDurationMs || Math.min(12000, Math.max(3600, currentNarration.length * 28));
    const startedAt = Date.now();

    // Poll ~7×/sec (lighter than before to keep the screen smooth). Only push a
    // state update when the value actually moved, to avoid needless re-renders.
    const apply = (next) => setTeachingProgress((prev) => (Math.abs(next - prev) >= 0.004 || next >= 1 ? next : prev));
    // Caption sync: a small lead fixes the start latency, and a slight speed
    // multiplier stops it drifting behind as the chunk plays (TTS files carry a
    // little trailing silence + our per-beat length estimate isn't exact, so a
    // pure linear map slowly lags). Together they keep words on the spoken word.
    const CAPTION_LEAD_S = 0.45;
    const CAPTION_SPEED = 1.08;
    const timer = setInterval(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused && audio.duration > 0) {
        // Voice is actually playing → caption/board track the real audio position.
        apply(Math.min(1, (audio.currentTime * CAPTION_SPEED + CAPTION_LEAD_S) / audio.duration));
      } else if (!voiceMode) {
        // Text mode has no spoken audio → wall-clock drives the board reveal.
        const next = Math.min(1, (Date.now() - startedAt) / duration);
        apply(next);
        if (next >= 1) clearInterval(timer);
      }
      // voiceMode but audio not started yet (TTS still generating) → HOLD at the
      // current value so subtitles don't run ahead of the tutor's voice.
    }, 90);

    return () => clearInterval(timer);
  }, [currentChunk?.id, isPlaying, showQuestionPanel, lectureCompleted, recommendedDurationMs, currentNarration]);

  const stopPlayback = () => {
    // Invalidate any in-flight playChunk so a late TTS response never starts a
    // second voice on top of the current one.
    playbackTokenRef.current += 1;
    setIsPreparing(false);
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause?.();
      audioRef.current = null;
    }
    // Detach events before cancelling so stale onend/onerror don't fire scheduleNext
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current.onboundary = null;
      utteranceRef.current = null;
    }
    if (Platform.OS === 'web' && window?.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    diagramTimersRef.current.forEach(clearTimeout);
    diagramTimersRef.current = [];
  };

  // Reveal diagram nodes one by one as narrator speaks
  const scheduleDiagramSteps = (narration, diagramData, totalDurationMs) => {
    const nodes = diagramData?.nodes;
    if (!nodes?.length) return;

    diagramTimersRef.current.forEach(clearTimeout);
    diagramTimersRef.current = [];

    setDiagramStep(-1);

    // Spread reveals across 85% of narration duration so last node appears before end
    const usableDuration = totalDurationMs * 0.85;

    nodes.forEach((_, i) => {
      let delayMs;
      if (i === 0) {
        // First node appears almost immediately when voice starts
        delayMs = 300;
      } else {
        // Remaining nodes spread evenly
        delayMs = Math.round((i / (nodes.length - 1 || 1)) * usableDuration);
        delayMs = Math.max(delayMs, 300);
      }
      const t = setTimeout(() => setDiagramStep(i), delayMs);
      diagramTimersRef.current.push(t);
    });
  };

  const stopRecognition = () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setIsRecording(false);
  };

  const cleanupMediaRecorder = () => {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    setIsRecording(false);
  };

  const loadLecture = async () => {
    setLoading(true);
    stopPlayback();
    stopRecognition();

    try {
      const enrollment = await checkEnrollment(courseId);
      if (!enrollment.success || !enrollment.enrolled) {
        setIsEnrolled(false);
        navigation.navigate('CourseDetail', { courseId, courseName: slugify(course?.name) });
        return;
      }

      setIsEnrolled(true);
      const response = await aiTutorAPI.startSession(topicId, { voiceModeEnabled: voiceMode });
      if (!response.success) {
        throw new Error(response.error || 'Unable to start tutor session');
      }

      let nextLecture = response.lecture;
      if (response.lecture?.id && !(response.lecture.flashcards || []).length) {
        try {
          const flashcardResponse = await aiTutorAPI.getFlashcards(response.lecture.id);
          if (flashcardResponse.success) {
            nextLecture = {
              ...response.lecture,
              flashcards: flashcardResponse.flashcards || [],
            };
          }
        } catch (_) {
        }
      }

      // Warm the first chunk's TTS during the loading screen so the tutor starts
      // speaking the instant the stage appears (no long dead silence on open).
      if (voiceMode && Platform.OS === 'web' && response.chunk) {
        const firstNarration = response.chunk.delivery?.narration_text
          || response.chunk.spokenExplanation || response.chunk.text || '';
        if (firstNarration) {
          try {
            await Promise.race([
              aiTutorAPI.speakText({
                lectureId: response.lecture?.id,
                sessionId: response.session?.id,
                assetType: 'lecture_chunk',
                text: firstNarration,
              }),
              new Promise((resolve) => setTimeout(resolve, 9000)),
            ]);
          } catch (_) { /* best-effort warm */ }
        }
      }

      setLecture(nextLecture);
      setSession(response.session);
      setCurrentChunk(response.chunk);
      setLectureCompleted(response.session?.status === 'lecture_completed');
      setChatMessages((response.session?.messages || []).map((message) => ({
        type: message.sender === 'user' ? 'user' : 'ai',
        text: message.content,
      })));
    } catch (error) {
      setLecture(null);
      setSession(null);
      setCurrentChunk(null);
      Toast.show({
        type: 'error',
        text1: 'Lecture Unavailable',
        text2: error.message || 'Unable to load this AI lecture package.',
      });
    } finally {
      setLoading(false);
    }
  };

  const speakChunk = async (text) => {
    if (!text || !autoSpeakEnabled) return;
    const myToken = (playbackTokenRef.current += 1);
    setIsSpeakingChunk(true);
    try {
      const res = await aiTutorAPI.speakText({ text: text.slice(0, 800), voice: 'nova' });
      // Superseded while generating → don't start a (now overlapping) voice.
      if (playbackTokenRef.current !== myToken) { setIsSpeakingChunk(false); return; }
      if (res.audioUrl && Platform.OS === 'web') {
        const audio = new Audio(res.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsSpeakingChunk(false);
        audio.onerror = () => setIsSpeakingChunk(false);
        audio.play();
      } else {
        setIsSpeakingChunk(false);
      }
    } catch (e) {
      setIsSpeakingChunk(false);
    }
  };

  const scheduleNext = (delay) => {
    if (!session?.id) {
      return;
    }

    stopPlayback();
    playbackRef.current = setTimeout(async () => {
      // Block auto-advance until the user explicitly clicks Next or Skip.
      if (checkpointTextRef.current && !checkpointUserAdvancedRef.current) return;
      // Show a "moving on" beat so the gap between chunks feels like the teacher
      // is transitioning, not frozen.
      const advToken = playbackTokenRef.current;
      setIsAdvancing(true);
      try {
        const response = await aiTutorAPI.getNextChunk(session.id);
        // A manual skip/stop happened during the fetch → drop this stale advance.
        if (playbackTokenRef.current !== advToken) { setIsAdvancing(false); return; }
        if (response.lectureCompleted || !response.chunk) {
          setIsAdvancing(false);
          setLectureCompleted(true);
          setIsPlaying(false);
          setShowCompleteDialog(true);
          await fetchCourses();
          return;
        }

        // Warm the next chunk's TTS while still showing the "moving on" state, so
        // the voice starts the instant the new board appears (no silent gap).
        if (voiceMode && Platform.OS === 'web') {
          const nextNarration = response.chunk.delivery?.narration_text
            || response.chunk.spokenExplanation || response.chunk.text || '';
          if (nextNarration) {
            try {
              await Promise.race([
                aiTutorAPI.speakText({
                  lectureId: lecture?.id,
                  sessionId: response.session?.id,
                  assetType: 'lecture_chunk',
                  text: nextNarration,
                }),
                new Promise((resolve) => setTimeout(resolve, 9000)),
              ]);
            } catch (_) { /* best-effort warm */ }
          }
        }

        // Skipped/stopped during the warm → don't apply this stale chunk.
        if (playbackTokenRef.current !== advToken) { setIsAdvancing(false); return; }

        setSession(response.session);
        setCurrentChunk(response.chunk);
        setIsAdvancing(false);
        if (autoSpeakEnabled && !voiceMode) {
          speakChunk(response.chunk?.spokenExplanation || response.chunk?.text || '');
        }
      } catch (error) {
        setIsAdvancing(false);
        setIsPlaying(false);
        Toast.show({
          type: 'error',
          text1: 'Playback Paused',
          text2: error.message || 'Unable to continue the lecture.',
        });
      }
    }, delay);
  };

  const playChunk = async () => {
    if (!currentNarration) return;

    // Claim this playback. If a stop/skip/advance happens during the async TTS
    // fetch below, our token becomes stale and we abort instead of double-playing.
    const myToken = (playbackTokenRef.current += 1);

    // Resuming this very chunk after a pause? Pick up where the voice left off
    // instead of replaying it from the start. Consume the snapshot once.
    const resuming = resumeChunkRef.current === currentChunk?.id && resumeAtRef.current > 0.2;
    const resumeAt = resuming ? resumeAtRef.current : 0;
    resumeChunkRef.current = null;
    resumeAtRef.current = 0;

    const diagramData = currentChunk?.diagramData;
    const fallbackDelay = Math.min(12000, Math.max(3600, currentNarration.length * 28));
    const estimatedDuration = recommendedDurationMs || fallbackDelay;

    if (!voiceMode) {
      if (diagramData?.nodes?.length) {
        scheduleDiagramSteps(currentNarration, diagramData, estimatedDuration);
      }
      scheduleNext(estimatedDuration);
      return;
    }

    if (Platform.OS === 'web') {
      // The TTS for this chunk takes a moment to generate — show the teacher as
      // "thinking / moving on" instead of a dead pause until audio actually starts.
      setIsPreparing(true);
      try {
        const audioResponse = await aiTutorAPI.speakText({
          lectureId: lecture?.id,
          sessionId: session?.id,
          assetType: 'lecture_chunk',
          text: currentNarration,
        });

        // A newer chunk/stop superseded us while TTS was generating → abort.
        if (playbackTokenRef.current !== myToken) { setIsPreparing(false); return; }

        if (audioResponse?.asset?.urlPath) {
          const audio = new Audio(`${baseHost}${audioResponse.asset.urlPath}`);
          audioRef.current = audio;
          audio.onplaying = () => setIsPreparing(false);
          // Seek back to the paused spot (a hair earlier so the word isn't clipped).
          const seekIfResuming = () => {
            if (resuming) { try { audio.currentTime = Math.max(0, resumeAt - 0.6); } catch (_) {} }
          };
          audio.onloadedmetadata = () => {
            seekIfResuming();
            // Don't rewind/replay the diagram on resume — just show it filled in.
            if (resuming && diagramData?.nodes?.length) {
              setDiagramStep(diagramData.nodes.length - 1);
            } else if (diagramData?.nodes?.length) {
              const durationMs = (audio.duration || estimatedDuration / 1000) * 1000;
              scheduleDiagramSteps(currentNarration, diagramData, durationMs);
            }
          };
          if (audio.readyState >= 1) seekIfResuming(); // metadata already cached
          audio.onended = () => scheduleNext(250);
          audio.onerror = () => scheduleNext(4000);
          if (!resuming && diagramData?.nodes?.length) {
            // Schedule based on estimated duration as fallback while audio loads
            scheduleDiagramSteps(currentNarration, diagramData, estimatedDuration);
          }
          await audio.play();
          setIsPreparing(false);
          return;
        }
      } catch (_) {
      }

      // Superseded during the await/catch → don't start the speech-synth fallback.
      if (playbackTokenRef.current !== myToken) { setIsPreparing(false); return; }

      setIsPreparing(false);
      if (window?.speechSynthesis) {
        if (diagramData?.nodes?.length) {
          scheduleDiagramSteps(currentNarration, diagramData, estimatedDuration);
        }
        const utterance = new SpeechSynthesisUtterance(currentNarration);
        // Keep a ref so Chrome doesn't GC the utterance before its events fire
        utteranceRef.current = utterance;
        // Word-boundary event: sync text reveal to exact spoken word position
        utterance.onboundary = (event) => {
          if (event.name === 'word' && currentNarration.length > 0) {
            setTeachingProgress(Math.min(1, event.charIndex / currentNarration.length));
          }
        };
        utterance.onend = () => { utteranceRef.current = null; setTeachingProgress(1); scheduleNext(250); };
        utterance.onerror = () => { utteranceRef.current = null; scheduleNext(4000); };
        window.speechSynthesis.cancel();
        // Small delay after cancel avoids Chrome's "interrupted" error
        setTimeout(() => { if (utteranceRef.current === utterance) window.speechSynthesis.speak(utterance); }, 80);
        return;
      }
    }

    if (diagramData?.nodes?.length) {
      scheduleDiagramSteps(currentNarration, diagramData, estimatedDuration);
    }
    scheduleNext(estimatedDuration);
  };

  // Snapshot the voice position so resuming continues this chunk instead of
  // restarting it from the top. Call this BEFORE stopPlayback() nulls the audio.
  const rememberResumePoint = () => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0.2) {
      resumeAtRef.current = audio.currentTime;
      resumeChunkRef.current = currentChunk?.id ?? null;
    }
  };

  const pauseLectureSession = async () => {
    if (!session || !isPlaying) {
      return true;
    }

    // Always pause locally first so the student is never stuck even if the
    // backend write hiccups (e.g. a transient DB error).
    rememberResumePoint();
    stopPlayback();
    setIsPlaying(false);

    try {
      await aiTutorAPI.pauseSession(session.id);
    } catch (_) {
      // Non-fatal: playback is already paused on the client.
    }
    return true;
  };

  // Instantly stops local TTS/audio without a server round-trip (used by Voice Q&A)
  const pauseLecturePlayback = () => {
    rememberResumePoint();
    stopPlayback();
    setIsPlaying(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_) {}
      audioRef.current = null;
    }
  };

  const resumeLectureSession = async () => {
    if (!session || isPlaying) {
      return true;
    }

    const response = await aiTutorAPI.resumeSession(session.id);
    if (!response.success) {
      throw new Error(response.error || 'Unable to resume tutor session');
    }

    setSession(response.session);
    setCurrentChunk(response.chunk);
    setShowQuestionPanel(false);
    setActiveToolPanel(null);
    setIsPlaying(true);
    return true;
  };

  const togglePause = async () => {
    if (!session) return;

    try {
      if (isPlaying) {
        await pauseLectureSession();
      } else {
        await resumeLectureSession();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Session Error',
        text2: error.message || 'Unable to update tutor state.',
      });
    }
  };

  const handleExitLecture = async () => {
    // Stop the lecture right here before leaving the page.
    setIsPlaying(false);
    stopPlayback();
    stopRecognition();
    try {
      if (session?.id) {
        // Best-effort: persist the pause so resuming later returns to this chunk.
        await aiTutorAPI.pauseSession(session.id);
      }
    } catch (_) {
      // Leaving anyway — don't block navigation on a pause failure.
    }
    navigation.navigate('CourseDetail', { courseId, courseName: slugify(course?.name) });
  };

  const submitLectureQuestion = async (rawPrompt) => {
    const prompt = `${rawPrompt || ''}`.trim();
    if (!prompt || !session) return;
    if (handRaiseTimeoutRef.current) {
      clearTimeout(handRaiseTimeoutRef.current);
      handRaiseTimeoutRef.current = null;
    }
    setQuestion('');
    setSubmittingQuestion(true);
    setChatMessages((prev) => [...prev, { type: 'user', text: prompt }]);

    try {
      const response = await aiTutorAPI.askQuestion(session.id, prompt);
      if (!response.success || !response.aiMessage?.content) {
        throw new Error(response.error || 'I could not answer that question right now.');
      }
      setChatMessages((prev) => [...prev, { type: 'ai', text: response.aiMessage.content }]);
      setHandRaised(false);
      setTimeout(() => {
        resumeLectureSession().catch(() => {});
      }, 2200);
    } catch (error) {
      setChatMessages((prev) => [...prev, { type: 'ai', text: error.message || 'I could not answer that question right now.' }]);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const askQuestion = async () => {
    await submitLectureQuestion(question);
  };

  const startVoiceInput = async () => {
    if (session && isPlaying) {
      await openQuestionPanel();
    } else {
      setShowQuestionPanel(true);
    }

    if (Platform.OS !== 'web') {
      Toast.show({
        type: 'info',
        text1: 'Voice Input',
        text2: 'Voice input currently works on web browsers with microphone access.',
      });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isRecording) {
      if (recognitionRef.current) {
        stopRecognition();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (!SpeechRecognition) {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        Toast.show({
          type: 'error',
          text1: 'Not Supported',
          text2: 'This browser does not support live mic capture for lecture questions.',
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        mediaChunksRef.current = [];

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.onstart = () => setIsRecording(true);
        recorder.ondataavailable = (event) => {
          if (event.data?.size) {
            mediaChunksRef.current.push(event.data);
          }
        };
        recorder.onerror = () => cleanupMediaRecorder();
        recorder.onstop = async () => {
          try {
            const audioBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            if (!audioBlob.size) {
              cleanupMediaRecorder();
              return;
            }

            const extension = (recorder.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
            const formData = new FormData();
            formData.append('audio', audioBlob, `lecture-question.${extension}`);

            const response = await aiTutorAPI.transcribeAudio(formData);
            const transcript = `${response?.transcript || ''}`.trim();
            if (transcript) {
              setQuestion(transcript);
              submitLectureQuestion(transcript).catch(() => {});
            } else {
              Toast.show({
                type: 'info',
                text1: 'No Speech Detected',
                text2: 'Please try speaking a little closer to the microphone.',
              });
            }
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Mic Upload Failed',
              text2: error.message || 'Unable to transcribe your lecture question right now.',
            });
          } finally {
            cleanupMediaRecorder();
          }
        };
        recorder.start();
        Toast.show({
          type: 'info',
          text1: 'Recording Started',
          text2: 'Speak your lecture question, then tap the mic again to submit.',
        });
        return;
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Microphone Unavailable',
          text2: error.message || 'Unable to access microphone permissions.',
        });
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      const finalResult = event.results?.[event.results.length - 1];
      setQuestion(transcript);
      setShowQuestionPanel(true);
      if (finalResult?.isFinal && transcript) {
        setIsRecording(false);
        submitLectureQuestion(transcript).catch(() => {});
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
  };

  const exportFlashcards = () => {
    const cards = lecture?.flashcards || [];
    if (!cards.length || Platform.OS !== 'web') {
      Toast.show({
        type: 'info',
        text1: 'Export Unavailable',
        text2: cards.length ? 'Flashcard export is available on web.' : 'No flashcards available for this lecture.',
      });
      return;
    }

    const courseName = course?.name || 'Course';
    const topicTitle = topic?.title || lecture?.title || 'Topic';
    const cardsHtml = cards.map((card, i) => `
      <div class="card">
        <div class="front"><span class="label">Q${i + 1}</span><p>${String(card.frontText).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div>
        <div class="back"><span class="label">Answer</span><p>${String(card.backText).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div>
      </div>`).join('');

    const primary = theme.colors.primary;
    const html = `<!DOCTYPE html><html><head><title>${courseName} – ${topicTitle} – Flashcards</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a}
        h1{font-size:26px;color:${primary};margin-bottom:4px}
        h2{font-size:18px;color:#374151;font-weight:600;margin-top:0;margin-bottom:4px}
        .divider{border:none;border-top:2px solid ${primary};margin:12px 0 20px}
        .meta{color:#6b7280;font-size:13px;margin-bottom:24px}
        .card{border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden;page-break-inside:avoid}
        .front{padding:16px;background:#f8fafc}
        .back{padding:16px;background:#eef2ff;border-top:1px solid #e5e7eb}
        .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${primary};display:block;margin-bottom:6px}
        p{margin:0;font-size:15px;line-height:1.6}
      </style></head><body>
      <h1>${courseName}</h1>
      <h2>${topicTitle}</h2>
      <hr class="divider"/>
      <p class="meta">${cards.length} flashcards · Exported on ${new Date().toLocaleDateString()}</p>
      ${cardsHtml}
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const exportNotesPDF = () => {
    if (!studentNotes.trim() || Platform.OS !== 'web') {
      Toast.show({
        type: 'info',
        text1: 'Export Unavailable',
        text2: studentNotes.trim() ? 'Notes export is available on web.' : 'No notes to export yet.',
      });
      return;
    }

    const courseName = course?.name || 'Course';
    const topicTitle = topic?.title || lecture?.title || 'Topic';
    const primary = theme.colors.primary;
    const html = `<!DOCTYPE html><html><head><title>${courseName} – ${topicTitle} – Notes</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a}
        h1{font-size:26px;color:${primary};margin-bottom:4px}
        h2{font-size:18px;color:#374151;font-weight:600;margin-top:0;margin-bottom:4px}
        .divider{border:none;border-top:2px solid ${primary};margin:12px 0 20px}
        .meta{color:#6b7280;font-size:13px;margin-bottom:24px}
        pre{white-space:pre-wrap;font-family:inherit;font-size:15px;line-height:1.7;margin:0}
      </style></head><body>
      <h1>${courseName}</h1>
      <h2>${topicTitle}</h2>
      <hr class="divider"/>
      <p class="meta">Class Notes · Exported on ${new Date().toLocaleDateString()}</p>
      <pre>${studentNotes.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const goToNextChunk = async () => {
    if (!session?.id || lectureCompleted) return;

    stopPlayback();
    setIsPlaying(false);

    try {
      const response = await aiTutorAPI.getNextChunk(session.id);
      if (response.lectureCompleted || !response.chunk) {
        setLectureCompleted(true);
        setShowCompleteDialog(true);
        await fetchCourses();
        return;
      }

      setSession(response.session);
      setCurrentChunk(response.chunk);
      setShowQuestionPanel(false);
      setIsPlaying(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Next Chunk Unavailable',
        text2: error.message || 'Unable to advance to the next lecture chunk.',
      });
    }
  };

  const openQuestionPanel = async () => {
    if (!session || !isPlaying) {
      setShowQuestionPanel(true);
      setActiveToolPanel('chat');
      return;
    }

    await togglePause();
  };

  const closeToolPanel = () => {
    if (activeToolPanel === 'chat') {
      setShowQuestionPanel(false);
    }
    setActiveToolPanel(null);
  };

  const openToolPanel = async (panel) => {
    if (panel === 'chat') {
      await openQuestionPanel();
      return;
    }

    setActiveToolPanel((current) => (current === panel ? null : panel));
    if (showQuestionPanel) {
      setShowQuestionPanel(false);
    }
  };

  const scheduleAutoResumeAfterRaiseHand = () => {
    if (handRaiseTimeoutRef.current) {
      clearTimeout(handRaiseTimeoutRef.current);
    }

    handRaiseTimeoutRef.current = setTimeout(async () => {
      if (question.trim() || submittingQuestion || !showQuestionPanel) {
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          type: 'ai',
          text: `No problem ${studentName}, I will continue the lecture from the same point now.`,
        },
      ]);
      setHandRaised(false);

      try {
        await resumeLectureSession();
      } catch (_) {
      }
    }, 10000);
  };

  const handleRaiseHand = () => {
    openInlineQA();
  };

  // ── Inline classroom Q&A ────────────────────────────────────────────────
  const stopQaAudio = () => {
    if (qaAudioRef.current) { try { qaAudioRef.current.pause(); } catch (_) {} qaAudioRef.current = null; }
    if (typeof window !== 'undefined' && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  };

  const cleanupQaRecorder = () => {
    qaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    qaStreamRef.current = null;
    qaRecorderRef.current = null;
    qaChunksRef.current = [];
    setQaListening(false);
  };

  // Record the spoken question and transcribe it server-side (Whisper). This is
  // far more reliable across browsers (incl. Opera) than the Web Speech API.
  const startQaListening = async () => {
    if (Platform.OS !== 'web') return;
    if (qaRecorderRef.current) {
      // Already recording → stop and submit.
      stopQaListening();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      Toast.show({ type: 'error', text1: 'Mic not supported', text2: 'Please type your question instead.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      qaStreamRef.current = stream;
      qaChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      qaRecorderRef.current = recorder;
      recorder.onstart = () => setQaListening(true);
      recorder.ondataavailable = (e) => { if (e.data?.size) qaChunksRef.current.push(e.data); };
      recorder.onerror = () => cleanupQaRecorder();
      recorder.onstop = async () => {
        const shouldSubmit = qaSubmitOnStopRef.current;
        const chunks = qaChunksRef.current;
        const mime = recorder.mimeType || 'audio/webm';
        cleanupQaRecorder();
        if (!shouldSubmit) return;
        try {
          const blob = new Blob(chunks, { type: mime });
          if (!blob.size) return;
          setQaTranscribing(true);
          const ext = mime.includes('ogg') ? 'ogg' : 'webm';
          const formData = new FormData();
          formData.append('audio', blob, `lecture-question.${ext}`);
          const response = await aiTutorAPI.transcribeAudio(formData);
          // Backend returns transcript as { model, text } — pull the string out.
          const t = response?.transcript;
          const transcript = `${(typeof t === 'string' ? t : (t?.text || '')) || ''}`.trim();
          if (transcript) {
            // Drop the transcript into the field. If the student finished via the
            // Tick/Enter (submit-after-stop), send it straight through.
            setQaInput((prev) => {
              const combined = `${prev ? `${prev} ` : ''}${transcript}`.trim();
              if (qaSubmitAfterStopRef.current) {
                qaSubmitAfterStopRef.current = false;
                setTimeout(() => submitInlineQA(combined), 0);
              }
              return combined;
            });
          } else {
            qaSubmitAfterStopRef.current = false;
            Toast.show({ type: 'info', text1: 'Didn\'t catch that', text2: 'Try again, a bit closer to the mic.' });
          }
        } catch (error) {
          Toast.show({ type: 'error', text1: 'Voice failed', text2: error.message || 'Please type your question instead.' });
        } finally {
          setQaTranscribing(false);
        }
      };
      qaSubmitOnStopRef.current = true;
      recorder.start();
    } catch (error) {
      cleanupQaRecorder();
      Toast.show({ type: 'error', text1: 'Microphone blocked', text2: error.message || 'Allow mic access, or type your question.' });
    }
  };

  const stopQaListening = () => {
    qaSubmitOnStopRef.current = true;
    if (qaRecorderRef.current) {
      try { qaRecorderRef.current.stop(); } catch (_) { cleanupQaRecorder(); }
    } else {
      cleanupQaRecorder();
    }
  };

  const abortQaListening = () => {
    qaSubmitOnStopRef.current = false;
    if (qaRecorderRef.current) {
      try { qaRecorderRef.current.stop(); } catch (_) {}
    }
    cleanupQaRecorder();
  };

  // One smart mic button: recording → stop & transcribe; text waiting → submit;
  // empty → start recording (also interrupts the greeting if it's still playing).
  const handleQaMic = () => {
    if (qaListening) {
      stopQaListening();
    } else if (qaTranscribing) {
      // wait for transcription to land
    } else {
      // Start (re)recording — interrupt the greeting if it's still talking.
      stopQaAudio();
      setQaGreetingPlaying(false);
      startQaListening();
    }
  };

  // Tick / Enter — finish and send: if still recording, stop → transcribe → send;
  // otherwise send the typed text.
  const finishAndSubmit = () => {
    if (qaPhase === 'thinking') return;
    if (qaListening) {
      qaSubmitAfterStopRef.current = true;
      stopQaListening();
    } else if (`${qaInput || ''}`.trim()) {
      submitInlineQA(qaInput);
    }
  };

  // Voice-first: greet the student by name INSTANTLY, then open the mic.
  const playGreetingThenListen = () => {
    const name = `${studentName || ''}`.trim().split(' ')[0] || 'there';
    const isUrduCourse = course?.language === 'Urdu';
    const greeting = isUrduCourse
      ? `${name}، آپ کا کیا سوال ہے؟ میں نے آپ کے لیے لیکچر روک دیا ہے۔`
      : `Hello ${name}, what's your question?`;
    setQaGreeting(greeting);
    setQaGreetingPlaying(true);
    const beginListening = () => {
      setQaGreetingPlaying(false);
      // Only auto-start if the student hasn't already started typing/recording.
      if (!qaRecorderRef.current && !`${qaInput || ''}`.trim()) startQaListening();
    };
    if (Platform.OS !== 'web') { beginListening(); return; }

    // 1) Instant: pre-warmed greeting audio (consistent tutor voice).
    const warm = greetingAudioRef.current;
    if (warm?.text === greeting && warm.audio) {
      try {
        const audio = warm.audio;
        audio.currentTime = 0;
        audio.onended = () => beginListening();
        audio.onerror = () => beginListening();
        qaAudioRef.current = audio;
        const p = audio.play();
        if (p && typeof p.then === 'function') p.catch(() => beginListening());
        return;
      } catch (_) { /* fall through */ }
    }

    // 2) Instant fallback: browser speech synthesis (no generation wait).
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance(greeting);
        u.lang = isUrduCourse ? 'ur-PK' : 'en-US';
        u.rate = 1.0;
        u.onend = beginListening;
        u.onerror = beginListening;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return;
      } catch (_) { /* fall through */ }
    }

    beginListening();
  };

  const openInlineQA = () => {
    pauseLecturePlayback();
    stopQaAudio();
    setShowVoiceQA(false);
    setActiveToolPanel(null);
    setHandRaised(true);
    setQaQuestion('');
    setQaAnswer('');
    setQaVisual(null);
    setQaInput('');
    setQaGreeting('');
    setQaPhase('composing');
    setQaActive(true);
    // Voice-first greeting → auto mic.
    playGreetingThenListen();
  };

  const speechFromMarkdown = (md) => `${md || ''}`
    .replace(/```[\s\S]*?```/g, ' — see the code on the board — ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#*_>|]/g, ' ')
    .replace(/^\s*[-•]\s*/gm, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  const speakInlineAnswer = async (text) => {
    const speech = speechFromMarkdown(text).slice(0, 900);
    if (!speech || Platform.OS !== 'web') { setQaPhase('done'); return; }
    try {
      const res = await aiTutorAPI.speakText({ lectureId: lecture?.id, sessionId: session?.id, assetType: 'qa_answer', text: speech });
      const url = res?.asset?.urlPath ? `${baseHost}${res.asset.urlPath}` : res?.audioUrl;
      if (url) {
        const audio = new Audio(url);
        qaAudioRef.current = audio;
        audio.onended = () => { qaAudioRef.current = null; setQaPhase('done'); };
        audio.onerror = () => { qaAudioRef.current = null; setQaPhase('done'); };
        await audio.play();
        return;
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(speech);
      u.onend = () => setQaPhase('done');
      u.onerror = () => setQaPhase('done');
      window.speechSynthesis.cancel();
      setTimeout(() => { try { window.speechSynthesis.speak(u); } catch (_) {} }, 60);
      return;
    }
    setQaPhase('done');
  };

  const submitInlineQA = async (raw) => {
    // Only accept a real string; ignore events/objects passed by handlers.
    const provided = typeof raw === 'string' ? raw : '';
    const q = `${provided || qaInput || ''}`.trim();
    if (!q || !session || qaPhase === 'thinking') return;
    stopQaListening();
    stopQaAudio();
    setQaQuestion(q);
    setQaInput('');
    setQaAnswer('');
    setQaVisual(null);
    setQaPhase('thinking');
    setChatMessages((prev) => [...prev, { type: 'user', text: q }]);
    try {
      const response = await aiTutorAPI.askQuestion(session.id, q);
      if (!response.success || !response.aiMessage?.content) {
        throw new Error(response.error || 'I could not answer that one right now.');
      }
      const answer = response.aiMessage.content;
      const visual = response.visual || response.aiMessage?.contextSnapshot?.visual || null;
      setQaAnswer(answer);
      setQaVisual(visual && visual.type === 'diagram' && (visual.nodes || []).length >= 2 ? visual : null);
      setChatMessages((prev) => [...prev, { type: 'ai', text: answer }]);
      setQaPhase('answering');
      speakInlineAnswer(answer);
    } catch (error) {
      setQaAnswer(error.message || 'I could not answer that one right now.');
      setQaPhase('done');
    }
  };

  const closeInlineQA = async (resume = true) => {
    stopQaAudio();
    abortQaListening();
    setQaGreetingPlaying(false);
    setQaActive(false);
    setHandRaised(false);
    setQaPhase('composing');
    if (resume) {
      try { await resumeLectureSession(); } catch (_) { setIsPlaying(true); }
    }
  };

  // Parse a concise markdown answer into board blocks (code / bullets / prose).
  const parseAnswerBlocks = (md) => {
    const text = `${md || ''}`.trim();
    if (!text) return [];
    const blocks = [];
    const codeRe = /```(\w+)?\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    const pushProse = (chunk) => {
      const t = `${chunk || ''}`.trim();
      if (!t) return;
      const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const bullets = lines.filter((l) => /^([-•*]|\d+[.)])\s+/.test(l));
      if (bullets.length >= 2 && bullets.length >= lines.length - 1) {
        blocks.push({ type: 'bullets', items: lines.map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, '')) });
      } else {
        blocks.push({ type: 'text', text: lines.join(' ') });
      }
    };
    while ((m = codeRe.exec(text)) !== null) {
      pushProse(text.slice(last, m.index));
      blocks.push({ type: 'code', lang: (m[1] || 'code').toLowerCase(), code: (m[2] || '').replace(/\s+$/, '') });
      last = codeRe.lastIndex;
    }
    pushProse(text.slice(last));
    return blocks;
  };

  const renderAnswerBlock = (block, index, textColor) => {
    const tc = textColor || (isDark ? '#f1f5f9' : '#0f172a');
    if (block.type === 'code') {
      const lines = `${block.code || ''}`.split(/\r?\n/);
      return (
        <View key={index} style={[styles.terminalWrap, { marginVertical: 6 }]}>
          <View style={styles.terminalBar}>
            <View style={[styles.terminalDot, { backgroundColor: '#ff5f57' }]} />
            <View style={[styles.terminalDot, { backgroundColor: '#febc2e' }]} />
            <View style={[styles.terminalDot, { backgroundColor: '#28c840' }]} />
            <Text style={styles.terminalLangLabel}>{block.lang}</Text>
          </View>
          <View style={styles.terminalBody}>
            {lines.map((line, li) => (
              <View key={li} style={styles.terminalLine}>
                <Text style={styles.terminalLineNum}>{li + 1}</Text>
                <Text style={styles.terminalLineCode}>{line || ' '}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }
    if (block.type === 'bullets') {
      return (
        <View key={index} style={[styles.chalkNoteBlock, { marginVertical: 6 }]}>
          {block.items.map((it, bi) => (
            <View key={bi} style={styles.chalkBulletRow}>
              <Text style={[styles.chalkBulletArrow, { color: tc }]}>▸</Text>
              <Text style={[styles.chalkBulletText, { color: tc }]}>{it}</Text>
            </View>
          ))}
        </View>
      );
    }
    return <Text key={index} style={[styles.qaAnswerText, { color: tc }]}>{block.text}</Text>;
  };

  const renderInlineQA = () => {
    if (!qaActive) return null;
    const accent = '#f59e0b';
    const qaBg    = isDark ? '#0d0f1f' : '#ffffff';
    const qaText  = isDark ? '#f1f5f9' : '#0f172a';
    const qaText2 = isDark ? '#94a3b8' : '#475569';
    const qaBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    const qaAvatarState = qaPhase === 'thinking' || qaTranscribing
      ? 'thinking'
      : (qaPhase === 'answering' || qaGreetingPlaying)
        ? 'speaking'
        : qaListening
          ? 'listening'
          : qaPhase === 'done'
            ? 'complete'
            : 'idle';
    const phaseLabel = {
      composing: qaGreetingPlaying ? 'Greeting…' : qaListening ? '● Listening… speak now' : qaTranscribing ? 'Transcribing…' : 'Your turn',
      thinking: 'Thinking…',
      answering: 'Answering on the board',
      done: 'Answered',
    }[qaPhase] || '';
    const blocks = (qaPhase === 'answering' || qaPhase === 'done') ? parseAnswerBlocks(qaAnswer) : [];


    const qaFooterJSX = (
      <View style={[styles.qaFooter, { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: isDark ? '#080c1a' : '#f1f5f9', borderTopColor: qaBorder }]}>
        {qaPhase === 'composing' ? (
          <>
            <TouchableOpacity
              onPress={handleQaMic}
              style={[styles.qaMic, qaListening ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : { borderColor: `${accent}66` }]}
              accessibilityLabel={qaListening ? 'Stop recording' : 'Speak your question'}
            >
              <Icon
                name={qaListening ? 'stop' : 'mic-outline'}
                size={18}
                color={qaListening ? '#fff' : accent}
              />
            </TouchableOpacity>
            <TextInput
              style={styles.qaInputField}
              value={qaInput}
              onChangeText={setQaInput}
              placeholder={qaListening ? 'Listening… speak now, then tap ✓' : qaTranscribing ? 'Transcribing your question…' : 'Speak (mic) or type your question…'}
              placeholderTextColor="#64748b"
              editable={!qaTranscribing}
              onSubmitEditing={finishAndSubmit}
              blurOnSubmit={false}
              onKeyPress={(e) => {
                if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                  e.preventDefault?.();
                  finishAndSubmit();
                }
              }}
              returnKeyType="send"
              autoFocus
            />
            <TouchableOpacity
              onPress={finishAndSubmit}
              disabled={!(qaListening || qaInput.trim())}
              style={[styles.qaTickBtn, { opacity: (qaListening || qaInput.trim()) ? 1 : 0.4 }]}
              accessibilityLabel="Submit question"
            >
              <Icon name="checkmark" size={22} color="#04110b" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => { stopQaAudio(); setQaAnswer(''); setQaVisual(null); setQaQuestion(''); setQaInput(''); setQaPhase('composing'); }}
              style={styles.qaSecondaryBtn}
            >
              <Icon name="add" size={16} color="#cbd5e1" />
              <Text style={styles.qaSecondaryText}>Ask another</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => closeInlineQA(true)} style={styles.qaResumeBtn}>
              <Icon name="play-skip-forward" size={16} color="#fff" />
              <Text style={styles.qaResumeText}>{qaPhase === 'answering' ? 'Skip — Resume' : 'Resume lecture'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );

    return (
      <Modal visible={qaActive} transparent animationType={isMobile ? 'slide' : 'fade'} statusBarTranslucent onRequestClose={() => closeInlineQA(true)}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isMobile ? qaBg : (isDark ? 'rgba(5,7,18,0.88)' : 'rgba(255,255,255,0.88)'), ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } : {}) }]}>
          <ScrollView
            style={{ height: windowHeight - 70, backgroundColor: qaBg }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
          >
            {/* ── Header ── */}
            <View style={[styles.qaHeader, { borderBottomColor: qaBorder }]}>
              <View style={styles.qaHeaderLeft}>
                <View style={styles.qaSSBrand}><MaterialIcon name="robot" size={22} color="#FF8C42" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.qaHeaderTitle, { color: qaText }]}>SkillSphere AI</Text>
                  <Text style={[styles.qaHeaderSub, { color: qaText2 }]}>Your AI Learning Companion</Text>
                </View>
                <View style={[styles.qaPhasePill, { borderColor: `${accent}66`, backgroundColor: `${accent}1f` }]}>
                  <View style={[styles.qaPhaseDot, { backgroundColor: accent }]} />
                  <Text style={[styles.qaPhaseText, { color: accent }]}>{phaseLabel}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => closeInlineQA(true)} style={styles.qaClose} accessibilityLabel="Resume lecture">
                <Icon name="close" size={18} color={qaText} />
              </TouchableOpacity>
            </View>

            {!!qaQuestion && (
              <View style={[styles.qaQuestionChip, { borderColor: `${accent}44`, backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.10)' }]}>
                <Text style={[styles.qaQuestionLabel, { color: accent }]}>YOU ASKED</Text>
                <Text style={[styles.qaQuestionText, { color: qaText }]}>{qaQuestion}</Text>
              </View>
            )}

            {qaPhase === 'answering' && <QASpeakingBanner />}

            {/* ── Content ── */}
            <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 12 }}>
              {qaPhase === 'composing' && (
                <View style={{ gap: 16 }}>
                  {!!qaGreeting && !qaListening && !qaTranscribing && <Text style={[styles.qaGreetingText, { color: qaText }]}>{qaGreeting}</Text>}
                  <QAPhaseVisual isListening={qaListening} isTranscribing={qaTranscribing} />
                  {!qaListening && !qaTranscribing && (
                    <>
                      <Text style={[styles.qaPrompt, { color: qaText2 }]}>Tap the mic and speak, or type your question below — then press ✓.</Text>
                      <View>
                        <Text style={[styles.qaChipsHint, { color: qaText2 }]}>QUICK ASKS</Text>
                        <View style={styles.qaChipsRow}>
                          {[
                            { icon: 'bulb-outline',        label: 'Give an example',   ask: 'Give a simple real-world example of this.' },
                            { icon: 'git-network-outline', label: 'Draw a diagram',    ask: 'Draw a simple diagram to explain how this works.' },
                            { icon: 'color-wand-outline',  label: 'Explain it simply', ask: 'Explain this in the simplest way possible.' },
                            { icon: 'code-slash-outline',  label: 'Show me in code',   ask: 'Show me a small code example for this.' },
                          ].map((c) => (
                            <TouchableOpacity key={c.label} style={[styles.qaChip, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)' }]} onPress={() => submitInlineQA(c.ask)} activeOpacity={0.75}>
                              <Icon name={c.icon} size={14} color="#fbbf24" />
                              <Text style={[styles.qaChipText, { color: qaText }]}>{c.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              )}
              {qaPhase === 'thinking' && <ThinkingIndicator accent={accent} label="Let me think about that…" />}
              {(qaPhase === 'answering' || qaPhase === 'done') && (
                <>
                  {!!qaVisual && (
                    <View style={styles.qaDiagramWrap}>
                      <DiagramCanvas
                        diagramData={qaVisual}
                        currentStep={(qaVisual.nodes?.length || 1) - 1}
                        isDark={isDark}
                        width={isMobile ? (width - 64) : Math.min(820, width - 280)}
                      />
                      {!!qaVisual.caption && <Text style={[styles.qaDiagramCaption, { color: qaText2 }]}>{qaVisual.caption}</Text>}
                    </View>
                  )}
                  {!!`${qaAnswer || ''}`.trim() && (
                    <View style={styles.qaAnswerContainer}>
                      {blocks.map((b, i) => renderAnswerBlock(b, i, qaText))}
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
          {qaFooterJSX}
        </View>
      </Modal>
    );
  };

  const toggleFlashcardReveal = (cardId) => {
    setRevealedFlashcards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const saveStudentNotes = async () => {
    if (!notesStorageKey) {
      return;
    }

    setSavingNotes(true);
    const savedAt = new Date().toISOString();

    try {
      await AsyncStorage.setItem(notesStorageKey, JSON.stringify({
        text: studentNotes,
        savedAt,
      }));
      setNotesSavedAt(savedAt);
      Toast.show({
        type: 'success',
        text1: 'Notes Saved',
        text2: 'Your lecture notes are saved on this device.',
      });
    } catch (_) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Unable to save notes on this device right now.',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const openQuiz = () => {
    if (!lecture?.id) {
      Toast.show({
        type: 'error',
        text1: 'Quiz Unavailable',
        text2: 'This lecture package is missing its quiz reference.',
      });
      return;
    }

    if (!lectureCompleted) {
      Toast.show({
        type: 'info',
        text1: 'Finish the Lecture',
        text2: 'Complete the lecture before opening the quiz.',
      });
      return;
    }

    navigation.navigate('Quiz', { courseId, topicId, lectureId: lecture.id });
  };

  const restartLecture = async () => {
    if (!session?.id) {
      return;
    }

    try {
      stopPlayback();
      stopRecognition();
      setShowCompleteDialog(false);
      const response = await aiTutorAPI.restartSession(session.id);
      if (!response.success) {
        throw new Error(response.error || 'Unable to restart this lecture');
      }

      setSession(response.session);
      setLecture(response.lecture || lecture);
      setCurrentChunk(response.chunk);
      setLectureCompleted(false);
      setShowQuestionPanel(false);
      setActiveToolPanel(null);
      setIsPlaying(true);
      setTeachingProgress(0);
      Toast.show({
        type: 'success',
        text1: 'Lecture Restarted',
        text2: 'Starting again from the first chunk.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Restart Failed',
        text2: error.message || 'Unable to restart this lecture right now.',
      });
    }
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <Text style={[styles.sidebarTitle, { color: theme.colors.textPrimary }]}>Course Progress</Text>
      <ScrollView>
        {(course?.topics || []).map((item) => {
          const isCurrent = String(item.id) === String(topicId);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.sidebarItem, isCurrent && { borderLeftColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}
              disabled={item.status === 'locked'}
              onPress={() => navigation.replace('Learning', { courseId, topicId: item.id })}
            >
              <Text style={[styles.sidebarItemText, { color: item.status === 'locked' ? theme.colors.textTertiary : theme.colors.textPrimary }]}>
                {item.title}
              </Text>
              {isCurrent && !!lectureDurationLabel && (
                <Text style={[styles.sidebarItemDuration, { color: theme.colors.textSecondary }]}>{lectureDurationLabel}</Text>
              )}
              <Text style={[styles.sidebarItemStatus, { color: item.completed ? '#10B981' : isCurrent ? theme.colors.primary : theme.colors.textTertiary }]}>
                {item.completed ? 'Done' : item.status === 'locked' ? 'Locked' : isCurrent ? `${progress}%` : 'Ready'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const getProgressiveItems = (items) => {
    // Show the full board immediately. Items animate in once (per chunk) via
    // <Reveal>, then stay put — no per-frame growth, so the board never jumps
    // or "jerks" while the narration plays.
    return Array.isArray(items) ? items.filter(Boolean) : [];
  };

  const getVisibleNarration = () => {
    if (!currentNarration) return '';
    const words = currentNarration.split(/\s+/).filter(Boolean);
    if (!isPlaying) return words.join(' '); // show full text when paused
    // Use floor (not ceil) so word appears only when actually spoken
    const visibleWordCount = Math.min(words.length, Math.max(1, Math.floor(words.length * teachingProgress) + 1));
    return words.slice(0, visibleWordCount).join(' ');
  };

  const liveNarration = getVisibleNarration();

  const renderVisualDock = () => {
    const rawBullets = currentSlide?.bullets;
    const parsedBullets = Array.isArray(rawBullets) ? rawBullets : (typeof rawBullets === 'string' ? (() => { try { return JSON.parse(rawBullets); } catch { return []; } })() : []);
    const slideBullets = parsedBullets.slice(0, 4);
    const visualTitle = currentVisual?.title || currentVisual?.visualType || currentChunk?.title || 'Lesson Visual';
    const visualMode = (currentVisual?.visualMode || panelContent.visualType || 'slide').toLowerCase();
    const modeLabel = { diagram: 'Diagram', flowchart: 'Flowchart', whiteboard: 'Whiteboard', slide: 'Slide', comparison_table: 'Comparison', mixed: 'Mixed', none: 'Visual' }[visualMode] || 'Visual';
    const modeColor = { diagram: '#8b5cf6', flowchart: '#3b82f6', whiteboard: '#10b981', slide: '#f59e0b', comparison_table: '#06b6d4', mixed: '#ec4899' }[visualMode] || '#6366f1';

    return (
      <View style={styles.boardVisualRail}>
        {/* LIVE VISUAL card */}
        <View style={[styles.boardSideCard, { borderColor: `${modeColor}40` }]}>
          <View style={styles.railCardHeader}>
            <View style={[styles.railDot, { backgroundColor: modeColor }]} />
            <Text style={[styles.boardSideEyebrow, { color: modeColor, marginBottom: 0 }]}>Live Visual</Text>
            <View style={[styles.railModeBadge, { backgroundColor: `${modeColor}22`, borderColor: `${modeColor}44` }]}>
              <Text style={[styles.railModeBadgeText, { color: modeColor }]}>{modeLabel}</Text>
            </View>
          </View>
          <Text style={styles.boardSideTitle} numberOfLines={2}>{visualTitle}</Text>
        </View>

        {!!slideBullets.length && (
          <View style={styles.boardSideCard}>
            <View style={styles.railCardHeader}>
              <View style={[styles.railDot, { backgroundColor: '#60a5fa' }]} />
              <Text style={[styles.boardSideEyebrow, { color: '#60a5fa', marginBottom: 0 }]}>Key Points</Text>
            </View>
            {slideBullets.map((bullet, index) => (
              <View key={`${bullet}-${index}`} style={styles.railBulletRow}>
                <View style={styles.railBulletDot} />
                <Text style={styles.boardSideBullet} numberOfLines={2}>{bullet}</Text>
              </View>
            ))}
          </View>
        )}

        {!!checkpointText && (
          <View style={[styles.boardSideCard, styles.boardCheckpointCard]}>
            <View style={styles.railCardHeader}>
              <View style={[styles.railDot, { backgroundColor: '#fb923c' }]} />
              <Text style={[styles.boardSideEyebrow, { color: '#fb923c', marginBottom: 0 }]}>Checkpoint</Text>
            </View>
            <Text style={styles.boardCheckpointText} numberOfLines={5}>{checkpointText}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderBoardSurface = () => {
    const diagramData = currentChunk?.diagramData;

    // Safely parse JSON fields — Sequelize may return them as strings on some DB setups
    const safeJSON = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') return raw;
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
      return null;
    };
    const safeBullets = (() => { const p = safeJSON(currentChunk.slideBullets); return Array.isArray(p) ? p : []; })();
    const safeVisualData = (() => { const p = safeJSON(currentChunk.visualData); return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {}; })();

    // ── Guided Steps (real website screenshots) — highest-priority board ──
    const guidedSteps = (() => {
      const gs = safeVisualData.guidedSteps;
      return Array.isArray(gs) ? gs.filter((s) => s && (s.instruction || s.image)) : [];
    })();
    if (guidedSteps.length) {
      // Highlight the step the tutor is currently on (synced to the voice).
      const activeStep = Math.min(guidedSteps.length - 1, Math.max(0, Math.floor(teachingProgress * guidedSteps.length)));
      // Hand the active step to the auto-scroll effect so the board follows the voice.
      guidedActiveRef.current = activeStep;
      const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return 'python.org'; } };
      return (
        <View style={styles.guidedWrap}>
          {guidedSteps.map((s, i) => {
            const isActive = isPlaying && i === activeStep;
            const isLast = i === guidedSteps.length - 1;
            return (
              <View
                key={`gs-${currentChunk.id}-${i}`}
                onLayout={(e) => { guidedOffsetsRef.current[i] = e.nativeEvent.layout.y; }}
              >
              <Reveal active from={16} delay={Math.min(i, 5) * 70}>
                <View style={[styles.guidedStep, isActive && styles.guidedStepActive]}>
                  <View style={styles.guidedStepHeader}>
                    <View style={[styles.guidedNum, isActive && styles.guidedNumActive]}>
                      <Text style={[styles.guidedNumText, isActive && { color: '#04110b' }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.guidedInstruction, isActive && { color: '#fff' }]}>{s.instruction || ''}</Text>
                    {isActive && (
                      <View style={styles.guidedLiveTag}>
                        <View style={styles.guidedLiveDot} />
                        <Text style={styles.guidedLiveText}>HERE</Text>
                      </View>
                    )}
                  </View>

                  {!!s.image && (
                    <View style={[styles.browserFrame, isActive && styles.browserFrameActive]}>
                      <View style={styles.browserBar}>
                        <View style={[styles.browserDot, { backgroundColor: '#ff5f57' }]} />
                        <View style={[styles.browserDot, { backgroundColor: '#febc2e' }]} />
                        <View style={[styles.browserDot, { backgroundColor: '#28c840' }]} />
                        <View style={styles.browserUrlPill}>
                          <Icon name="lock-closed" size={10} color="#34d399" />
                          <Text style={styles.browserUrlText} numberOfLines={1}>{s.url ? hostOf(s.url) : 'python.org'}</Text>
                        </View>
                      </View>
                      <Image source={{ uri: `${baseHost}${s.image}` }} style={styles.guidedImage} resizeMode="contain" />
                    </View>
                  )}

                  {!s.image && (
                    <View style={styles.guidedDesktopNote}>
                      <Icon name="desktop-outline" size={15} color="#94a3b8" />
                      <Text style={styles.guidedDesktopText}>On your computer</Text>
                    </View>
                  )}

                  {!!s.caption && <Text style={styles.guidedCaption}>{s.caption}</Text>}
                </View>

                {!isLast && <View style={styles.guidedConnector} />}
              </Reveal>
              </View>
            );
          })}
        </View>
      );
    }

    // Build effective board content — override narration fallback when visualMode has richer data
    const vm = currentChunk.visualMode;
    const effectiveBoard = (() => {
      const base = boardContent;
      // If backend returned narration but chunk has a real visual mode with bullets, override
      if ((!base || base.type === 'narration') && safeBullets.length > 0) {
        if (vm === 'flowchart')
          return { type: 'flowchart', title: base?.title || currentChunk.title,
            steps: (safeVisualData.steps?.length > 0 ? safeVisualData.steps : safeBullets.slice(0, 6).map((b, i) => ({ id: `s-${i}`, label: String(b) }))) };
        if (vm === 'comparison_table')
          return { type: 'comparison_table', title: base?.title || currentChunk.title,
            columns: safeVisualData.columns || ['Concept', 'Detail'],
            rows: (safeVisualData.rows?.length > 0 ? safeVisualData.rows : safeBullets.slice(0, 5).map(b => { const s = String(b); const i = s.indexOf(': '); return i > 0 ? { left: s.slice(0, i).trim(), right: s.slice(i + 2).trim() } : { left: s, right: '' }; })) };
        if (vm === 'diagram')
          return { type: 'diagram', title: base?.title || currentChunk.title,
            nodes: (safeVisualData.nodes?.length > 0 ? safeVisualData.nodes : safeBullets.slice(0, 6).map((b, i) => ({ id: `n-${i}`, label: String(b) }))) };
        if (vm === 'slide' || vm === 'mixed')
          return { type: 'slide_summary', title: base?.title || currentChunk.title, bullets: safeBullets.slice(0, 5).map(String) };
        if (vm === 'whiteboard')
          return { type: 'whiteboard_notes', title: base?.title || currentChunk.title, notes: safeBullets.slice(0, 4).map(String) };
      }
      // If boardContent has a visual type but empty data, fill from safe sources
      if (base?.type === 'flowchart' && !base.steps?.length)
        return { ...base, steps: (safeVisualData.steps?.length > 0 ? safeVisualData.steps : safeBullets.slice(0, 6).map((b, i) => ({ id: `s-${i}`, label: String(b) }))) };
      if (base?.type === 'comparison_table' && !base.rows?.length)
        return { ...base, rows: (safeVisualData.rows?.length > 0 ? safeVisualData.rows : safeBullets.slice(0, 5).map(b => { const s = String(b); const i = s.indexOf(': '); return i > 0 ? { left: s.slice(0, i).trim(), right: s.slice(i + 2).trim() } : { left: s, right: '' }; })) };
      if (base?.type === 'diagram' && !base.nodes?.length)
        return { ...base, nodes: (safeVisualData.nodes?.length > 0 ? safeVisualData.nodes : safeBullets.slice(0, 6).map((b, i) => ({ id: `n-${i}`, label: String(b) }))) };
      // If vm explicitly says comparison_table but base came back as a generic slide/whiteboard,
      // build the comparison table from visualData rows or bullets (leaves all other types untouched).
      if (vm === 'comparison_table' && base?.type !== 'comparison_table' && safeVisualData.rows?.length > 0)
        return { type: 'comparison_table', title: base?.title || currentChunk.title,
          columns: safeVisualData.columns || ['Concept', 'Detail'],
          rows: safeVisualData.rows };
      return base;
    })();

    if (diagramData?.nodes?.length) {
      // While actively speaking, reveal nodes one-by-one (teacher drawing it out);
      // when paused/idle show the whole diagram so the board is never half-empty.
      const diagramShowStep = isPlaying && diagramStep >= 0
        ? diagramStep
        : (diagramData.nodes.length - 1);
      return (
        <View style={styles.diagramWrap}>
          <DiagramCanvas
            diagramData={diagramData}
            currentStep={diagramShowStep}
            isDark={isDark}
            width={isMobile ? (width - 64) : Math.min(760, width - 320)}
          />
          {!!currentChunk.visualCaption && (
            <Text style={styles.diagramCaption}>{currentChunk.visualCaption}</Text>
          )}
        </View>
      );
    }

    if (!effectiveBoard) {
      // Plain text — render as a readable whiteboard paragraph
      const bodyText = currentChunk.learningObjective || currentChunk.summary || '';
      const sentences = bodyText.split(/(?<=[.!?])\s+/).filter(Boolean);
      return (
        <View style={styles.plainTextBlock}>
          {sentences.map((sentence, i) => (
            <Text key={i} style={styles.plainTextLine}>{sentence}</Text>
          ))}
        </View>
      );
    }

    if (effectiveBoard.type === 'flowchart') {
      const rawSteps = effectiveBoard.steps?.length > 0 ? effectiveBoard.steps : [];
      const steps = getProgressiveItems(rawSteps);
      return (
        <View style={styles.flowchartWrap}>
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            return (
              <View key={step.id || index}>
                <View style={[
                  styles.flowchartNode,
                  isLast
                    ? { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.35)' }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
                ]}>
                  <View style={[
                    styles.flowchartBadge,
                    { backgroundColor: isLast ? '#10b981' : theme.colors.primary },
                  ]}>
                    <Text style={styles.flowchartBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.flowchartLabel, isLast && { color: '#6ee7b7' }]}>{step.label}</Text>
                    {!!step.cue && <Text style={styles.flowchartCue}>{step.cue}</Text>}
                  </View>
                </View>
                {!isLast && (
                  <View style={styles.flowchartConnector}>
                    <View style={[styles.flowchartConnectorLine, { backgroundColor: theme.colors.primary + '50' }]} />
                    <Text style={[styles.flowchartConnectorArrow, { color: theme.colors.primary }]}>▼</Text>
                    <View style={[styles.flowchartConnectorLine, { backgroundColor: theme.colors.primary + '50' }]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
    }

    if (effectiveBoard.type === 'comparison_table') {
      const rows = getProgressiveItems(effectiveBoard.rows?.length > 0 ? effectiveBoard.rows : []);
      const [colLeft = 'Concept', colRight = 'Detail'] = effectiveBoard.columns || [];
      const vsBadge = (() => {
        const l = colLeft.toLowerCase();
        const r = colRight.toLowerCase();
        // Show → when right column is clearly a description/detail (not a true comparison side)
        if (/(note|detail|desc|explanation|purpose|example|usage|info)/.test(r)) return '→';
        // Show → when left is input-type and right is output-type
        if (/(before|input|source|from|step|cause|key|tool|name|concept)/.test(l) && /(after|output|result|to|effect)/.test(r)) return '→';
        return 'VS';
      })();
      return (
        <View style={styles.comparisonWrap}>
          {/* Column headers */}
          <View style={styles.comparisonHeader}>
            <View style={[styles.comparisonHeaderCell, { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' }]}>
              <Text style={[styles.comparisonHeaderText, { color: '#93c5fd' }]}>{colLeft}</Text>
            </View>
            <View style={styles.comparisonVsBadge}>
              <Text style={styles.comparisonVsText}>{vsBadge}</Text>
            </View>
            <View style={[styles.comparisonHeaderCell, { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '55' }]}>
              <Text style={[styles.comparisonHeaderText, { color: theme.colors.primary }]}>{colRight}</Text>
            </View>
          </View>
          {/* Data rows */}
          {rows.map((row, index) => (
            <View key={`${row.left}-${index}`} style={[
              styles.comparisonRow,
              { backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' },
            ]}>
              <View style={[styles.comparisonCell, { borderLeftWidth: 3, borderLeftColor: '#3b82f6' }]}>
                <Text style={styles.comparisonCellText}>{row.left}</Text>
              </View>
              <View style={styles.comparisonDivider} />
              <View style={[styles.comparisonCell, { borderLeftWidth: 3, borderLeftColor: theme.colors.primary }]}>
                <Text style={styles.comparisonCellText}>{row.right || '—'}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (effectiveBoard.type === 'diagram') {
      const nodeColors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
      const visibleNodes = getProgressiveItems(effectiveBoard.nodes?.length > 0 ? effectiveBoard.nodes : []);
      return (
        <View style={styles.conceptNodeWrap}>
          {visibleNodes.map((node, index) => {
            const color = node.color || nodeColors[index % nodeColors.length];
            const isPrimary = node.emphasis === 'primary' || index === 0;
            const isLast = index === visibleNodes.length - 1;
            return (
              <View key={node.id || index}>
                <View style={[
                  styles.conceptNodeCard,
                  { borderColor: color + (isPrimary ? 'cc' : '70'),
                    backgroundColor: color + (isPrimary ? '28' : '14'),
                    borderWidth: isPrimary ? 1.5 : 1 },
                ]}>
                  <View style={[styles.conceptNodeBadge, { backgroundColor: color }]}>
                    <Text style={styles.conceptNodeBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.conceptNodeText, isPrimary && { fontWeight: '700', color: '#f1f5f9' }]}>{node.label}</Text>
                </View>
                {!isLast && (
                  <View style={styles.conceptNodeConnector}>
                    <View style={[styles.conceptNodeConnectorLine, { backgroundColor: color + '55' }]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
    }

    if (effectiveBoard.type === 'code') {
      const lang = (effectiveBoard.snippetLanguage || 'text').toLowerCase();
      const lines = `${effectiveBoard.snippet || ''}`.split(/\r?\n/);
      const visibleLines = getProgressiveItems(lines, 1);
      return (
        <View style={styles.terminalWrap}>
          <View style={styles.terminalBar}>
            <View style={[styles.terminalDot, { backgroundColor: '#ff5f57' }]} />
            <View style={[styles.terminalDot, { backgroundColor: '#febc2e' }]} />
            <View style={[styles.terminalDot, { backgroundColor: '#28c840' }]} />
            <Text style={styles.terminalLangLabel}>{lang}</Text>
          </View>
          <View style={styles.terminalBody}>
            {visibleLines.map((line, i) => (
              <Reveal key={i} active from={6} delay={Math.min(i, 8) * 35}>
                <View style={styles.terminalLine}>
                  <Text style={styles.terminalLineNum}>{i + 1}</Text>
                  <Text style={styles.terminalLineCode}>{line}</Text>
                </View>
              </Reveal>
            ))}
          </View>
          {!!effectiveBoard.snippetExplanation && (
            <View style={styles.terminalFooter}>
              <Text style={styles.terminalFooterIcon}>ℹ</Text>
              <Text style={styles.terminalFooterText}>{effectiveBoard.snippetExplanation}</Text>
            </View>
          )}
        </View>
      );
    }

    if (effectiveBoard.type === 'checkpoint') {
      return <Text style={styles.boardQuestion}>{effectiveBoard.question}</Text>;
    }

    // Rich, full lesson slide — fills the board with structured, readable content:
    // numbered points + key terms + a worked example + the analogy.
    const renderLessonSlide = (rawBullets, emphasis) => {
      const safeArr = (v) => { const p = safeJSON(v); return Array.isArray(p) ? p.filter(Boolean) : []; };
      let bullets = (Array.isArray(rawBullets) ? rawBullets : []).map((b) => `${b}`.trim()).filter(Boolean);
      // Supplement sparse boards with the chunk's slide bullets so it never looks empty.
      if (bullets.length < 2) {
        const extra = safeArr(currentChunk.slideBullets).map((b) => `${b}`.trim());
        bullets = Array.from(new Set([...bullets, ...extra])).filter(Boolean);
      }
      if (!bullets.length) {
        const obj = `${currentChunk.learningObjective || currentChunk.summary || ''}`;
        bullets = obj.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      }
      const visibleBullets = getProgressiveItems(bullets);
      const keyTerms = safeArr(currentChunk.keyTerms)
        .map((t) => (t && typeof t === 'object' ? `${t.term || t.label || t.name || ''}` : `${t}`))
        .map((t) => t.trim()).filter(Boolean).slice(0, 8);
      const examples = safeArr(currentChunk.examples).map((e) => `${e}`.trim()).filter(Boolean);
      const exampleText = examples[0] || '';
      const analogyText = `${emphasis || currentChunk.analogyIfHelpful || ''}`.trim();

      return (
        <View style={styles.lessonSlide}>
          <View style={styles.lessonBullets}>
            {visibleBullets.map((b, i) => (
              // Each point "writes itself" in as the teacher reaches it.
              <Reveal key={`lb-${i}`} active from={10} delay={Math.min(i, 5) * 45}>
                <View style={styles.lessonBulletRow}>
                  <View style={styles.lessonBulletBadge}>
                    <Text style={styles.lessonBulletBadgeText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.lessonBulletText}>{b}</Text>
                </View>
              </Reveal>
            ))}
          </View>

          {keyTerms.length > 0 && (
            <Reveal active from={10}>
              <View style={styles.lessonSection}>
                <Text style={styles.lessonSectionLabel}>KEY TERMS</Text>
                <View style={styles.lessonChipsRow}>
                  {keyTerms.map((t, i) => (
                    <Reveal key={`kt-${i}`} active from={6} delay={Math.min(i, 6) * 40}>
                      <View style={styles.lessonChip}>
                        <Text style={styles.lessonChipText}>{t}</Text>
                      </View>
                    </Reveal>
                  ))}
                </View>
              </View>
            </Reveal>
          )}

          {!!exampleText && (
            <Reveal active from={12} delay={80}>
              <View style={styles.lessonExampleCard}>
                <Icon name="bulb" size={18} color="#fbbf24" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonExampleLabel}>EXAMPLE</Text>
                  <Text style={styles.lessonExampleText}>{exampleText}</Text>
                </View>
              </View>
            </Reveal>
          )}

          {!!analogyText && (
            <Reveal active from={12} delay={120}>
              <View style={styles.lessonAnalogyCard}>
                <Icon name="color-wand" size={16} color="#93c5fd" />
                <Text style={styles.lessonAnalogyText}>{analogyText}</Text>
              </View>
            </Reveal>
          )}
        </View>
      );
    };

    if (effectiveBoard.type === 'slide_summary' || effectiveBoard.type === 'recap') {
      return renderLessonSlide(effectiveBoard.bullets, '');
    }

    if (effectiveBoard.type === 'whiteboard_notes' || effectiveBoard.type === 'narration') {
      const wbTerms = (() => { const p = safeJSON(currentChunk.keyTerms); return Array.isArray(p) ? p : []; })();
      return (
        <IntelligentWhiteboard
          title={effectiveBoard.title || currentChunk.title}
          notes={effectiveBoard.notes}
          keyTerms={wbTerms}
          emphasis={effectiveBoard.emphasis || currentChunk.analogyIfHelpful}
          progress={teachingProgress}
          playing={isPlaying && !showQuestionPanel && !lectureCompleted}
          width={isMobile ? (width - 72) : Math.min(840, width - 300)}
          accent={activityColor}
        />
      );
    }

    return renderLessonSlide([], '');
  };

  const renderSupportPanel = () => {
    if (!supportPanel) {
      return null;
    }

    const accent = supportPanel.type === 'checkpoint'
      ? '#f59e0b'
      : supportPanel.type === 'watch_for_this'
        ? '#ef4444'
        : '#06b6d4';

    return (
      <View style={[styles.supportCard, { backgroundColor: isDark ? '#101827' : '#ffffff', borderColor: `${accent}55` }]}>
        <Text style={[styles.supportLabel, { color: accent }]}>{supportPanel.title}</Text>
        <Text style={[styles.supportText, { color: theme.colors.textPrimary }]}>{supportPanel.text}</Text>
      </View>
    );
  };

  const renderStageInsights = () => {
    const visibleReinforcement = getProgressiveItems(reinforcementPoints, 2);
    const visibleConfusion = getProgressiveItems(confusionPoints, 1);

    if (!visibleReinforcement.length && !visibleConfusion.length && !supportPanel) {
      return null;
    }

    return (
      <View style={styles.stageInsightsGrid}>
        {!!supportPanel && renderSupportPanel()}
        {!!visibleReinforcement.length && (
          <View style={[styles.insightCard, { backgroundColor: isDark ? '#101827' : '#f8fafc', borderColor: isDark ? 'rgba(59,130,246,0.18)' : '#bfdbfe' }]}>
            <Text style={[styles.insightLabel, { color: '#60a5fa' }]}>Key explanation points</Text>
            {visibleReinforcement.map((point, index) => (
              <Text key={`${point}-${index}`} style={[styles.insightText, { color: theme.colors.textPrimary }]}>- {point}</Text>
            ))}
          </View>
        )}
        {!!visibleConfusion.length && (
          <View style={[styles.insightCard, { backgroundColor: isDark ? '#1a1408' : '#fff7ed', borderColor: isDark ? 'rgba(245,158,11,0.18)' : '#fdba74' }]}>
            <Text style={[styles.insightLabel, { color: '#f59e0b' }]}>Watch for this</Text>
            {visibleConfusion.map((point, index) => (
              <Text key={`${point}-${index}`} style={[styles.insightText, { color: theme.colors.textPrimary }]}>- {point}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ─── Sidebar panel renderers (LearningScreen style) ───────────────────────

  const renderChatSidePanel = () => (
    <View style={styles.aiPanelContainer}>
      <View style={[styles.aiPanelHeader, { backgroundColor: isDark ? theme.colors.card : theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.aiPanelAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
          <Icon name="chatbubble-ellipses" size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aiPanelTitle, { color: theme.colors.textPrimary }]}>AI Chat</Text>
          <Text style={[styles.aiPanelSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {showQuestionPanel ? 'Lecture paused — ask away' : 'Ask about this lecture'}
          </Text>
        </View>
        <View style={[styles.aiOnlineDot, { backgroundColor: theme.colors.success }]} />
      </View>

      <ScrollView
        ref={chatScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.aiPanelMessages, chatMessages.length === 0 && !submittingQuestion && styles.aiPanelMessagesEmpty]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
      >
        {chatMessages.length === 0 && !submittingQuestion ? (
          <View style={styles.aiPanelEmpty}>
            <View style={[styles.aiPanelEmptyIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <Icon name="chatbubble-ellipses-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={[styles.aiPanelEmptyTitle, { color: theme.colors.textPrimary }]}>Ask your AI Tutor</Text>
            <Text style={[styles.aiPanelEmptySub, { color: theme.colors.textTertiary }]}>Questions about this lecture answered instantly</Text>
          </View>
        ) : (
          chatMessages.map((message, index) => (
            <View key={`msg-${index}`} style={[styles.aiChatRow, message.type === 'user' ? styles.aiChatRowUser : styles.aiChatRowAI]}>
              {message.type !== 'user' && (
                <View style={[styles.aiChatAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Icon name="sparkles" size={12} color={theme.colors.primary} />
                </View>
              )}
              <View style={[styles.aiChatBubble,
                message.type === 'user'
                  ? { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 }
                  : { backgroundColor: isDark ? '#2f2f2f' : '#f4f4f8', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8e8f0', borderBottomLeftRadius: 4 },
              ]}>
                {message.type === 'user'
                  ? <Text style={[styles.aiChatText, { color: '#fff' }]}>{message.text}</Text>
                  : <MarkdownText textColor={theme.colors.textPrimary}>{message.text}</MarkdownText>
                }
              </View>
            </View>
          ))
        )}
        {submittingQuestion && (
          <View style={[styles.aiChatRow, styles.aiChatRowAI]}>
            <View style={[styles.aiChatAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
              <Icon name="sparkles" size={12} color={theme.colors.primary} />
            </View>
            <View style={[styles.aiChatBubble, { backgroundColor: isDark ? '#2f2f2f' : '#f4f4f8', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8e8f0', paddingVertical: 14, borderBottomLeftRadius: 4 }]}>
              <View style={styles.aiTypingRow}>
                <View style={[styles.aiTypingDot, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.aiTypingDot, { backgroundColor: theme.colors.primary, opacity: 0.55 }]} />
                <View style={[styles.aiTypingDot, { backgroundColor: theme.colors.primary, opacity: 0.25 }]} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.aiPanelInputArea, { backgroundColor: isDark ? theme.colors.background : '#fff', borderTopColor: theme.colors.border }]}>
        <View style={[styles.aiPanelInputBox, { backgroundColor: isDark ? '#2f2f2f' : theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
          <TextInput
            style={[styles.aiPanelInput, { color: theme.colors.textPrimary }]}
            value={question}
            onChangeText={setQuestion}
            placeholder={isRecording ? 'Listening…' : 'Ask about this lecture…'}
            placeholderTextColor={isRecording ? theme.colors.error : theme.colors.textTertiary}
            multiline
            maxLength={500}
            onSubmitEditing={askQuestion}
          />
          <View style={styles.aiPanelInputBtns}>
            <TouchableOpacity style={styles.aiIconBtn} onPress={startVoiceInput}>
              <Icon name={isRecording ? 'stop-circle' : 'mic-outline'} size={20} color={isRecording ? theme.colors.error : theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.aiSendBtn, { backgroundColor: question.trim() && !submittingQuestion ? theme.colors.primary : (isDark ? '#444' : '#d4d4d4') }]}
              onPress={askQuestion}
              disabled={!question.trim() || submittingQuestion}
            >
              {submittingQuestion
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="arrow-up" size={16} color={question.trim() ? '#fff' : (isDark ? '#888' : '#aaa')} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFlashcardsSidePanel = () => (
    <View style={styles.aiPanelContainer}>
      <View style={[styles.aiPanelHeader, { backgroundColor: isDark ? theme.colors.card : theme.colors.surface, borderBottomColor: theme.colors.border }, isMobile && { padding: 7 }]}>
        {!isMobile && <View style={[styles.aiPanelAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
          <Icon name="albums" size={16} color={theme.colors.primary} />
        </View>}
        <View style={{ flex: 1, flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 6 : 0 }}>
          <Text style={[styles.aiPanelTitle, { color: theme.colors.textPrimary }, isMobile && { fontSize: 12 }]}>Flashcards</Text>
          <Text style={[styles.aiPanelSubtitle, { color: theme.colors.textSecondary }]}>{(lecture?.flashcards || []).length} cards</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.aiPanelMessages} showsVerticalScrollIndicator={false}>
        {(lecture?.flashcards || []).length === 0 ? (
          <View style={styles.aiPanelEmpty}>
            <View style={[styles.aiPanelEmptyIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <Icon name="albums-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={[styles.aiPanelEmptyTitle, { color: theme.colors.textPrimary }]}>No flashcards yet</Text>
            <Text style={[styles.aiPanelEmptySub, { color: theme.colors.textTertiary }]}>Flashcards will appear after the lecture loads</Text>
          </View>
        ) : (
          (lecture.flashcards || []).map((card, index) => {
            const cardId = card.id || index;
            const revealed = Boolean(revealedFlashcards[cardId]);
            return (
              <TouchableOpacity key={cardId} activeOpacity={0.9} onPress={() => toggleFlashcardReveal(cardId)}
                style={[styles.aiFlashcard, { borderColor: theme.colors.border, backgroundColor: isDark ? '#101827' : '#f8fafc' }]}>
                <View style={styles.aiFlashcardHeader}>
                  <Text style={[styles.aiFlashcardLabel, { color: theme.colors.primary }]}>{revealed ? 'Answer' : 'Prompt'}</Text>
                  <Text style={[styles.aiFlashcardHint, { color: theme.colors.textTertiary }]}>{revealed ? 'Tap to hide' : 'Tap to reveal'}</Text>
                </View>
                <Text style={[styles.aiFlashcardText, { color: theme.colors.textPrimary }]}>{revealed ? card.backText : card.frontText}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      <View style={[styles.aiPanelFooter, { borderTopColor: theme.colors.border, backgroundColor: isDark ? theme.colors.background : '#fff' }]}>
        <TouchableOpacity style={[styles.aiFooterBtn, { backgroundColor: theme.colors.primary }]} onPress={exportFlashcards}>
          <Icon name="download-outline" size={16} color="#fff" />
          <Text style={styles.aiFooterBtnText}>Export Flashcards</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotesSidePanel = () => (
    <View style={styles.aiPanelContainer}>
      <View style={[styles.aiPanelHeader, { backgroundColor: isDark ? theme.colors.card : theme.colors.surface, borderBottomColor: theme.colors.border }, isMobile && { padding: 7 }]}>
        {!isMobile && <View style={[styles.aiPanelAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
          <Icon name="document-text" size={16} color={theme.colors.primary} />
        </View>}
        <View style={{ flex: 1, flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 6 : 0 }}>
          <Text style={[styles.aiPanelTitle, { color: theme.colors.textPrimary }, isMobile && { fontSize: 12 }]}>Class Notes</Text>
          {!isMobile && <Text style={[styles.aiPanelSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>{lecture?.title}</Text>}
        </View>
      </View>
      <TextInput
        style={[styles.aiNotesEditor, { color: theme.colors.textPrimary, backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor: theme.colors.border }]}
        value={studentNotes}
        onChangeText={setStudentNotes}
        multiline
        textAlignVertical="top"
        placeholder="Write your class notes here..."
        placeholderTextColor={theme.colors.textTertiary}
      />
      <View style={[styles.aiPanelFooter, { borderTopColor: theme.colors.border, backgroundColor: isDark ? theme.colors.background : '#fff', flexWrap: 'wrap', gap: 8 }]}>
        <Text style={[styles.aiNotesSaved, { color: theme.colors.textTertiary, flex: 1, minWidth: 80 }]}>
          {notesSavedAt ? `Saved ${new Date(notesSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}
        </Text>
        <TouchableOpacity style={[styles.aiFooterBtn, { backgroundColor: '#10b981' }]} onPress={exportNotesPDF}>
          <Icon name="download-outline" size={16} color="#fff" />
          <Text style={styles.aiFooterBtnText}>Export PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aiFooterBtn, { backgroundColor: theme.colors.primary }]} onPress={saveStudentNotes} disabled={savingNotes}>
          <Icon name="save-outline" size={16} color="#fff" />
          <Text style={styles.aiFooterBtnText}>{savingNotes ? 'Saving…' : 'Save Notes'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMoreSidePanel = () => (
    <View style={styles.aiPanelContainer}>
      <View style={[styles.aiPanelHeader, { backgroundColor: isDark ? theme.colors.card : theme.colors.surface, borderBottomColor: theme.colors.border }, isMobile && { padding: 7 }]}>
        {!isMobile && <View style={[styles.aiPanelAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
          <Icon name="ellipsis-horizontal" size={16} color={theme.colors.primary} />
        </View>}
        <View style={{ flex: 1, flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 6 : 0 }}>
          <Text style={[styles.aiPanelTitle, { color: theme.colors.textPrimary }, isMobile && { fontSize: 12 }]}>More Options</Text>
          {!isMobile && <Text style={[styles.aiPanelSubtitle, { color: theme.colors.textSecondary }]}>Quick classroom utilities</Text>}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.aiPanelMessages, { gap: 12 }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.moreCard, { backgroundColor: '#0f766e' }]}
          onPress={restartLecture}
        >
          <Icon name="refresh" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.moreCardTitle}>Restart Lecture</Text>
            <Text style={styles.moreCardSub}>Start this lecture from the beginning.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moreCard, { backgroundColor: '#3b82f6' }]}
          onPress={exportFlashcards}
        >
          <Icon name="download-outline" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.moreCardTitle}>Export Flashcards</Text>
            <Text style={styles.moreCardSub}>Download revision flashcards as PDF.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moreCard, { backgroundColor: voiceMode ? '#4f46e5' : '#475569' }]}
          onPress={() => setVoiceMode((prev) => !prev)}
        >
          <MaterialIcon name={voiceMode ? 'volume-high' : 'volume-off'} size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.moreCardTitle}>{voiceMode ? 'Voice On' : 'Voice Off'}</Text>
            <Text style={styles.moreCardSub}>Switch between voice and text delivery.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moreCard, { backgroundColor: handRaised ? '#f59e0b' : '#334155' }]}
          onPress={handleRaiseHand}
        >
          <MaterialIcon name="hand-wave-outline" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.moreCardTitle}>{handRaised ? 'Hand Raised' : 'Raise Hand'}</Text>
            <Text style={styles.moreCardSub}>Pause the lecture and ask a question.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moreCard, { backgroundColor: '#1d4ed8' }]}
          onPress={openQuiz}
        >
          <Icon name="help-circle-outline" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.moreCardTitle}>Open Quiz</Text>
            <Text style={styles.moreCardSub}>{lectureCompleted ? 'Ready to attempt.' : 'Complete the lecture first to unlock.'}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ─── Legacy tool panel (kept for any fallback) ─────────────────────────────
  const renderToolPanel = () => {
    if (!activeToolPanel) {
      return null;
    }

    if (activeToolPanel === 'chat') {
      return (
        <View style={[styles.toolPanelCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(148,163,184,0.12)' : theme.colors.border }]}>
          <View style={styles.toolPanelHeader}>
            <View>
              <Text style={[styles.toolPanelTitle, { color: theme.colors.textPrimary }]}>AI Chat</Text>
              <Text style={[styles.toolPanelSubtitle, { color: theme.colors.textSecondary }]}>Ask about the current chunk without losing your place.</Text>
            </View>
            <TouchableOpacity onPress={closeToolPanel} accessibilityRole="button" accessibilityLabel="Close AI chat panel">
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatScrollContent} showsVerticalScrollIndicator={false}>
            {!chatMessages.length && !submittingQuestion && (
              <View style={[styles.chatEmptyState, { borderColor: theme.colors.border }]}>
                <MaterialIcon name="chat-processing-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.chatEmptyTitle, { color: theme.colors.textPrimary }]}>Ask about this lecture point</Text>
                <Text style={[styles.chatEmptyText, { color: theme.colors.textSecondary }]}>The AI Tutor answers from the active lecture context and lets you continue smoothly.</Text>
              </View>
            )}
            {chatMessages.map((message, index) => (
              <View key={`${message.type}-${index}`} style={[styles.chatBubble, message.type === 'user' ? styles.chatBubbleUser : [styles.chatBubbleAi, { borderColor: theme.colors.border }]]}>
                <Text style={[styles.chatRole, { color: message.type === 'user' ? 'rgba(255,255,255,0.75)' : theme.colors.primary }]}>{message.type === 'user' ? 'You' : 'AI Tutor'}</Text>
                {message.type === 'user'
                  ? <Text style={{ color: '#fff', lineHeight: 21 }}>{message.text}</Text>
                  : <MarkdownText textColor={theme.colors.textPrimary}>{message.text}</MarkdownText>
                }
              </View>
            ))}
            {submittingQuestion && (
              <View style={[styles.chatBubble, styles.chatBubbleAi, { borderColor: theme.colors.border }]}>
                <Text style={[styles.chatRole, { color: theme.colors.primary }]}>AI Tutor</Text>
                <Text style={{ color: theme.colors.textSecondary }}>Preparing a contextual explanation...</Text>
              </View>
            )}
          </ScrollView>
          <View style={[styles.inputRow, { borderColor: theme.colors.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: isRecording ? theme.colors.error : theme.colors.primary }]} onPress={startVoiceInput} accessibilityRole="button" accessibilityLabel="Start voice input">
              <Icon name={isRecording ? 'stop' : 'mic'} size={18} color="#fff" />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, {
                color: theme.colors.textPrimary,
                backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              }]}
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={askQuestion}
              placeholder={isRecording ? 'Listening...' : 'Type your question...'}
              placeholderTextColor={theme.colors.textTertiary}
              multiline
            />
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.colors.primary }]} onPress={askQuestion} disabled={submittingQuestion} accessibilityRole="button" accessibilityLabel="Send AI question">
              {submittingQuestion ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeToolPanel === 'notes') {
      return (
        <View style={[styles.toolPanelCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(148,163,184,0.12)' : theme.colors.border }]}>
          <View style={styles.toolPanelHeader}>
            <View>
              <Text style={[styles.toolPanelTitle, { color: theme.colors.textPrimary }]}>Class Notepad</Text>
              <Text style={[styles.toolPanelSubtitle, { color: theme.colors.textSecondary }]}>Write your own notes during class and save them on this device.</Text>
            </View>
            <TouchableOpacity onPress={closeToolPanel} accessibilityRole="button" accessibilityLabel="Close notes panel">
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.notesReferenceCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: theme.colors.border }]}>
            <Text style={[styles.notesReferenceTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>{lecture.title}</Text>
            <Text style={[styles.notesReferenceMeta, { color: theme.colors.textSecondary }]} numberOfLines={3}>
              {panelContent.learningObjective || currentChunk.learningObjective || lecture.summary}
            </Text>
          </View>
          <TextInput
            style={[styles.notesEditor, { color: theme.colors.textPrimary, backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor: theme.colors.border }]}
            value={studentNotes}
            onChangeText={setStudentNotes}
            multiline
            textAlignVertical="top"
            placeholder="Write your class notes here..."
            placeholderTextColor={theme.colors.textTertiary}
          />
          <View style={styles.notesFooterRow}>
            <Text style={[styles.notesSavedLabel, { color: theme.colors.textSecondary }]}>
              {notesSavedAt ? `Saved ${new Date(notesSavedAt).toLocaleString()}` : 'Not saved yet'}
            </Text>
            <AppButton title={savingNotes ? 'Saving...' : 'Save Notes'} onPress={saveStudentNotes} variant="primary" disabled={savingNotes} />
          </View>
        </View>
      );
    }

    if (activeToolPanel === 'flashcards') {
      return (
        <View style={[styles.toolPanelCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(148,163,184,0.12)' : theme.colors.border }]}>
          <View style={styles.toolPanelHeader}>
            <View>
              <Text style={[styles.toolPanelTitle, { color: theme.colors.textPrimary }]}>Flashcards</Text>
              <Text style={[styles.toolPanelSubtitle, { color: theme.colors.textSecondary }]}>Review core prompts and reveal answers when ready.</Text>
            </View>
            <TouchableOpacity onPress={closeToolPanel} accessibilityRole="button" accessibilityLabel="Close flashcards panel">
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.toolPanelScrollContent}>
            {(lecture.flashcards || []).map((card, index) => {
              const cardId = card.id || index;
              const revealed = Boolean(revealedFlashcards[cardId]);
              return (
                <TouchableOpacity key={cardId} activeOpacity={0.92} onPress={() => toggleFlashcardReveal(cardId)} style={[styles.flashcard, { borderColor: theme.colors.border, backgroundColor: isDark ? '#101827' : '#f8fafc' }]}>
                  <View style={styles.flashcardHeader}>
                    <Text style={[styles.flashcardLabel, { color: theme.colors.primary }]}>{revealed ? 'Answer' : 'Prompt'}</Text>
                    <Text style={[styles.flashcardHint, { color: theme.colors.textTertiary }]}>{revealed ? 'Tap to hide' : 'Tap to reveal'}</Text>
                  </View>
                  <Text style={[styles.flashcardFront, { color: theme.colors.textPrimary }]}>{revealed ? card.backText : card.frontText}</Text>
                  <View style={[styles.flashcardDivider, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.flashcardMeta, { color: theme.colors.textSecondary }]}>{revealed ? 'Use this answer to confirm your recall.' : 'Try answering from memory before revealing the back.'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <AppButton title="Export Flashcards" onPress={exportFlashcards} variant="outline" />
        </View>
      );
    }

    if (activeToolPanel === 'quiz') {
      const questions = quizPreview?.questions || [];
      return (
        <View style={[styles.toolPanelCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(148,163,184,0.12)' : theme.colors.border }]}>
          <View style={styles.toolPanelHeader}>
            <View>
              <Text style={[styles.toolPanelTitle, { color: theme.colors.textPrimary }]}>Quiz Panel</Text>
              <Text style={[styles.toolPanelSubtitle, { color: theme.colors.textSecondary }]}>Preview readiness before opening the full quiz flow.</Text>
            </View>
            <TouchableOpacity onPress={closeToolPanel} accessibilityRole="button" accessibilityLabel="Close quiz panel">
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.quizPreviewCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: theme.colors.border }]}>
            <Text style={[styles.quizPreviewLabel, { color: theme.colors.textSecondary }]}>Quiz status</Text>
            <Text style={[styles.quizPreviewValue, { color: theme.colors.textPrimary }]}>{lectureCompleted ? 'Ready to attempt' : 'Locked until lecture completion'}</Text>
            <Text style={[styles.quizPreviewMeta, { color: theme.colors.textSecondary }]}>
              {lectureCompleted ? 'Finish with the stored lecture and move straight into the graded quiz.' : 'Complete this lecture first to unlock the next topic through the quiz.'}
            </Text>
          </View>
          {quizPreviewLoading ? (
            <View style={styles.quizLoadingWrap}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.toolPanelSubtitle, { color: theme.colors.textSecondary }]}>Loading quiz preview...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.toolPanelScrollContent}>
              {!!quizPreview?.instructions && <Text style={[styles.notesBody, { color: theme.colors.textSecondary }]}>{quizPreview.instructions}</Text>}
              {questions.slice(0, 3).map((item, index) => (
                <View key={item.id || index} style={[styles.quizQuestionPreview, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.quizQuestionIndex, { color: theme.colors.primary }]}>Question {index + 1}</Text>
                  <Text style={[styles.quizQuestionText, { color: theme.colors.textPrimary }]}>{item.prompt}</Text>
                </View>
              ))}
              {!questions.length && (
                <Text style={[styles.notesBody, { color: theme.colors.textSecondary }]}>No preview questions are available yet for this lecture package.</Text>
              )}
            </ScrollView>
          )}
          <AppButton title="Open Full Quiz" onPress={openQuiz} variant="primary" disabled={!lectureCompleted} />
        </View>
      );
    }

    return (
      <View style={[styles.toolPanelCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(148,163,184,0.12)' : theme.colors.border }]}>
        <View style={styles.toolPanelHeader}>
          <View>
            <Text style={[styles.toolPanelTitle, { color: theme.colors.textPrimary }]}>Essentials</Text>
            <Text style={[styles.toolPanelSubtitle, { color: theme.colors.textSecondary }]}>Quick classroom utilities and lecture actions.</Text>
          </View>
          <TouchableOpacity onPress={closeToolPanel} accessibilityRole="button" accessibilityLabel="Close essentials panel">
            <Icon name="close" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.essentialsGrid}>
          <TouchableOpacity style={[styles.essentialsCard, { backgroundColor: '#0f766e' }]} onPress={restartLecture}>
            <Icon name="refresh" size={18} color="#fff" />
            <Text style={styles.essentialsTitle}>Restart</Text>
            <Text style={styles.essentialsMeta}>Start this lecture from the beginning.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.essentialsCard, { backgroundColor: '#3b82f6' }]} onPress={exportFlashcards}>
            <Icon name="download" size={18} color="#fff" />
            <Text style={styles.essentialsTitle}>Export</Text>
            <Text style={styles.essentialsMeta}>Download revision flashcards.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.essentialsCard, { backgroundColor: voiceMode ? '#4f46e5' : '#475569' }]} onPress={() => setVoiceMode((prev) => !prev)}>
            <MaterialIcon name={voiceMode ? 'volume-high' : 'volume-off'} size={18} color="#fff" />
            <Text style={styles.essentialsTitle}>{voiceMode ? 'Voice On' : 'Voice Off'}</Text>
            <Text style={styles.essentialsMeta}>Switch spoken delivery mode.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.essentialsCard, { backgroundColor: handRaised ? '#f59e0b' : '#334155' }]} onPress={handleRaiseHand}>
            <MaterialIcon name="hand-wave-outline" size={18} color="#fff" />
            <Text style={styles.essentialsTitle}>{handRaised ? 'Hand Raised' : 'Raise Hand'}</Text>
            <Text style={styles.essentialsMeta}>Mark attention for the current topic.</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (fetchingCourse || (!course || !topic)) {
    if (fetchingCourse || coursesLoading || courses.length === 0) {
      return <LectureSkeleton isDark={isDark} theme={theme} />;
    }
    return (
      <MainLayout showSidebar={false} showHeader={true} showBack={true}>
        <View style={styles.centered}>
          <EmptyState icon="alert-circle-outline" title="Topic not found" subtitle="The topic you're looking for doesn't exist." />
        </View>
      </MainLayout>
    );
  }

  if (loading) {
    return <LectureSkeleton isDark={isDark} theme={theme} />;
  }

  if (!isEnrolled) {
    return (
      <MainLayout showSidebar={false} showHeader={true} showBack={true}>
        <View style={styles.centered}>
          <EmptyState icon="lock-closed-outline" title="Not Enrolled" subtitle="You need to enroll in this course to access lectures." />
        </View>
      </MainLayout>
    );
  }

  if (!lecture || !currentChunk) {
    return (
      <MainLayout showSidebar={false} showHeader={true} showBack={true}>
        <View style={styles.centered}>
          <EmptyState icon="sparkles-outline" title="Lecture Not Ready" subtitle="This topic does not have a generated lecture package yet." />
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="EnrolledCourses"
      onNavigate={handleNavigate}
      showHeader={false}
      customSidebar={renderSidebar()}
      customSidebarVisible={showTopicsSidebar}
      onCustomSidebarToggle={setShowTopicsSidebar}
      customMenuIcon="book-open-variant"
      hideHeaderToggle={true}
    >
      <View
        style={[
          styles.mainContent,
          {
            backgroundColor: isDark ? '#0f0f1a' : theme.colors.background,
            height: windowHeight,
          },
        ]}
      >
        {/* ── Icon Rail ── */}
        <ScrollView
          style={[styles.iconRail, {
            backgroundColor: isDark ? '#0d0d1f' : '#1e293b',
            borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)',
            width: 78,
            display: isMobile ? 'none' : 'flex',
          }]}
          contentContainerStyle={[styles.iconRailContent, isMobile && { paddingTop: 10, paddingBottom: 10, gap: 2 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, activeToolPanel === 'topics' && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => openToolPanel('topics')}
            accessibilityLabel="Open topics"
            activeOpacity={0.7}
          >
            <MaterialIcon
              name="book-open-variant"
              size={24}
              color={activeToolPanel === 'topics' ? theme.colors.primary : '#fff'}
            />
            {!isMobile && <Text style={[styles.railLabel, { color: activeToolPanel === 'topics' ? theme.colors.primary : '#fff' }]}>Topics</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, !isPlaying && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={togglePause}
            accessibilityLabel={isPlaying ? 'Pause lecture' : 'Resume lecture'}
            activeOpacity={0.7}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={24} color={!isPlaying ? theme.colors.primary : '#fff'} />
            {!isMobile && <Text style={[styles.railLabel, { color: !isPlaying ? theme.colors.primary : '#fff' }]}>
              {isPlaying ? 'Pause' : 'Resume'}
            </Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, handRaised && { backgroundColor: '#f59e0b22', borderColor: '#f59e0b50' }]}
            onPress={handleRaiseHand}
            accessibilityLabel={handRaised ? 'Lower hand' : 'Raise hand'}
            activeOpacity={0.7}
          >
            <Icon name="hand-left-outline" size={24} color={handRaised ? '#f59e0b' : '#fff'} />
            {!isMobile && <Text style={[styles.railLabel, { color: handRaised ? '#f59e0b' : '#fff', textAlign: 'center' }]}>{'Ask\nQuestion'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, activeToolPanel === 'flashcards' && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => openToolPanel('flashcards')}
            accessibilityLabel="Open flashcards"
            activeOpacity={0.7}
          >
            <Icon name={activeToolPanel === 'flashcards' ? 'albums' : 'albums-outline'} size={24} color={activeToolPanel === 'flashcards' ? theme.colors.primary : '#fff'} />
            {!isMobile && <Text style={[styles.railLabel, { color: activeToolPanel === 'flashcards' ? theme.colors.primary : '#fff' }]}>Cards</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, activeToolPanel === 'notes' && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => openToolPanel('notes')}
            accessibilityLabel="Open notes"
            activeOpacity={0.7}
          >
            <Icon name={activeToolPanel === 'notes' ? 'document-text' : 'document-text-outline'} size={24} color={activeToolPanel === 'notes' ? theme.colors.primary : '#fff'} />
            {!isMobile && <Text style={[styles.railLabel, { color: activeToolPanel === 'notes' ? theme.colors.primary : '#fff' }]}>Notes</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, showLiveText && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => setShowLiveText(v => !v)}
            accessibilityLabel={showLiveText ? 'Hide live text' : 'Show live text'}
            activeOpacity={0.7}
          >
            <MaterialIcon name={showLiveText ? 'subtitles' : 'subtitles-outline'} size={24} color={showLiveText ? theme.colors.primary : '#fff'} />
            {!isMobile && <Text style={[styles.railLabel, { color: showLiveText ? theme.colors.primary : '#fff' }]}>Subtitles</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, isMobile && { width: 44, paddingVertical: 8 }, activeToolPanel === 'more' && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => openToolPanel('more')}
            accessibilityLabel="More options"
            activeOpacity={0.7}
          >
            <Icon name="ellipsis-horizontal" size={24} color={activeToolPanel === 'more' ? theme.colors.primary : '#fff'} />
            {!isMobile && <Text style={[styles.railLabel, { color: activeToolPanel === 'more' ? theme.colors.primary : '#fff' }]}>More</Text>}
          </TouchableOpacity>
        </ScrollView>

        {/* ── Slide Panel (desktop/tablet only — on mobile it renders as an overlay inside aiLearningArea) ── */}
        {!isMobile && activeToolPanel && ['topics', 'chat', 'flashcards', 'notes', 'more'].includes(activeToolPanel) && (
          <View
            style={[
              styles.aiSlidePanel,
              {
                backgroundColor: isDark ? '#12122a' : theme.colors.surface,
                borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.border,
              },
            ]}
          >
            {activeToolPanel === 'topics' && renderSidebar()}
            {activeToolPanel === 'chat' && renderChatSidePanel()}
            {activeToolPanel === 'flashcards' && renderFlashcardsSidePanel()}
            {activeToolPanel === 'notes' && renderNotesSidePanel()}
            {activeToolPanel === 'more' && renderMoreSidePanel()}
          </View>
        )}

        {/* ── Main Learning Area ── */}
        <View style={styles.aiLearningArea}>
          {/* Progress header */}
          <View style={styles.progressSection}>
            <TouchableOpacity
              style={[styles.lectureBackBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border }]}
              onPress={handleExitLecture}
              accessibilityLabel="Back — stop lecture"
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.progressLabel}>
              <Icon name="school-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.progressText, { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
                {lecture?.title || topic?.title || 'Live Lecture'}
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFillGreen, { width: `${progress}%` }]} />
              </View>
            </View>
            <Text style={[styles.progressPercent, { color: theme.colors.primary }]}>{progress}%</Text>
          </View>

          {/* ── Virtual Classroom Stage ── */}
          <View style={[styles.classroomStage, isMobile
            ? { height: Math.round(windowHeight * 0.56), backgroundColor: isDark ? '#0d0f1f' : '#0f172a' }
            : { flex: 1, backgroundColor: isDark ? '#0d0f1f' : '#0f172a' }]}>

            {/* Top bar — live state, title, what the teacher is doing, controls */}
            <View style={styles.classroomTopBar}>
              <View style={styles.classroomLivePill}>
                <View style={[styles.classroomLiveDot, { backgroundColor: isAdvancing ? '#f59e0b' : isPlaying ? '#ef4444' : '#64748b' }]} />
                <Text style={styles.classroomLiveLabel}>{isAdvancing ? 'NEXT' : isPlaying ? 'LIVE' : 'PAUSED'}</Text>
              </View>
              <Text style={styles.classroomTitle} numberOfLines={1}>{boardContent?.title || currentChunk.title}</Text>
              <View style={[styles.classroomModeChip, { borderColor: `${activityColor}66`, backgroundColor: `${activityColor}1f` }]}>
                <Icon name={activity.icon} size={13} color={activityColor} />
                {!isMobile && <Text style={[styles.classroomModeText, { color: activityColor }]}>{activity.label}</Text>}
              </View>
              <View style={styles.classroomControls}>
                <TouchableOpacity
                  style={[styles.stageMiniControl, autoSpeakEnabled ? { backgroundColor: 'rgba(99,102,241,0.3)' } : { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                  onPress={() => setAutoSpeakEnabled(v => !v)}
                >
                  <Icon name={autoSpeakEnabled ? 'volume-high' : 'volume-mute-outline'} size={16} color={autoSpeakEnabled ? '#a5b4fc' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.stageMiniControl, { backgroundColor: 'rgba(255,255,255,0.08)' }]} onPress={togglePause}>
                  <Icon name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.stageMiniControl, { backgroundColor: 'rgba(255,255,255,0.08)' }]} onPress={goToNextChunk} disabled={lectureCompleted}>
                  <Icon name="play-skip-forward" size={16} color={lectureCompleted ? '#64748b' : '#fff'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Board body — the hero: where the teacher "writes" */}
            <View style={styles.classroomBoard}>
              <ScrollView
                ref={boardScrollRef}
                style={styles.classroomBoardScroll}
                contentContainerStyle={[styles.classroomBoardContent, isMobile && { paddingHorizontal: 14, paddingVertical: 14 }]}
                showsVerticalScrollIndicator={false}
              >
                <Reveal key={`board-${currentChunk.id}`} active style={{ width: '100%' }}>
                  {renderBoardSurface()}
                </Reveal>
              </ScrollView>

              {/* Checkpoint spotlight — interactive answer box (desktop only; mobile shows in inline panel) */}
              {!isMobile && activeBeat?.kind === 'checkpoint' && !!checkpointText && (
                <Reveal key={`cp-${currentChunk.id}`} active style={[
                  styles.checkpointSpotlight,
                  checkpointStatus === 'correct' && { borderColor: 'rgba(16,185,129,0.7)', backgroundColor: 'rgba(6,40,20,0.96)' },
                  checkpointStatus === 'wrong' && { borderColor: 'rgba(239,68,68,0.7)', backgroundColor: 'rgba(40,6,6,0.96)' },
                  checkpointStatus === 'skipped' && { borderColor: 'rgba(100,116,139,0.5)', backgroundColor: 'rgba(15,15,20,0.96)' },
                ]}>
                  <View style={styles.checkpointBadge}>
                    <Icon name="help-circle" size={15} color={
                      checkpointStatus === 'correct' ? '#10b981' :
                      checkpointStatus === 'wrong' ? '#ef4444' :
                      checkpointStatus === 'skipped' ? '#64748b' : '#fb923c'
                    } />
                    <Text style={[styles.checkpointBadgeText, {
                      color: checkpointStatus === 'correct' ? '#10b981' :
                             checkpointStatus === 'wrong' ? '#ef4444' :
                             checkpointStatus === 'skipped' ? '#64748b' : '#fb923c'
                    }]}>
                      {checkpointStatus === 'correct' ? 'CORRECT' :
                       checkpointStatus === 'wrong' ? 'NOT QUITE' :
                       checkpointStatus === 'skipped' ? 'SKIPPED' : 'QUICK CHECK'}
                    </Text>
                  </View>
                  <Text style={styles.checkpointSpotlightText}>{checkpointText}</Text>

                  {!checkpointStatus && (
                    <>
                      <TextInput
                        style={styles.checkpointInput}
                        placeholder="Type your answer..."
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={checkpointInput}
                        onChangeText={setCheckpointInput}
                        multiline
                        editable={!checkpointEvaluating}
                      />
                      <View style={styles.checkpointActions}>
                        <TouchableOpacity
                          style={[styles.checkpointBtn, styles.checkpointSubmitBtn, (!checkpointInput.trim() || checkpointEvaluating) && { opacity: 0.4 }]}
                          disabled={!checkpointInput.trim() || checkpointEvaluating}
                          onPress={async () => {
                            setCheckpointEvaluating(true);
                            try {
                              const res = await aiTutorAPI.evaluateCheckpoint({
                                question: checkpointText,
                                studentAnswer: checkpointInput.trim(),
                                chunkText: currentChunk?.text || currentNarration,
                                language: lecture?.language,
                              });
                              const s = res.correct ? 'correct' : 'wrong';
                              checkpointStatusRef.current = s;
                              setCheckpointStatus(s);
                              setCheckpointFeedback(res.feedback || '');
                            } catch (err) {
                              console.error('Checkpoint evaluation error:', err);
                              checkpointStatusRef.current = 'skipped';
                              setCheckpointStatus('skipped');
                              setCheckpointFeedback('Could not evaluate answer.');
                            } finally {
                              setCheckpointEvaluating(false);
                            }
                          }}
                        >
                          {checkpointEvaluating
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.checkpointBtnText}>Submit</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.checkpointBtn, styles.checkpointSkipBtn]}
                          disabled={checkpointEvaluating}
                          onPress={() => {
                            checkpointStatusRef.current = 'skipped';
                            checkpointUserAdvancedRef.current = true;
                            setCheckpointStatus('skipped');
                            setCheckpointFeedback('');
                            handleCheckpointAdvance();
                          }}
                        >
                          <Text style={[styles.checkpointBtnText, { color: '#94a3b8' }]}>Skip →</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {(checkpointStatus === 'correct' || checkpointStatus === 'wrong') && (
                    <>
                      {!!checkpointFeedback && (
                        <Text style={[styles.checkpointFeedbackText, {
                          color: checkpointStatus === 'correct' ? '#6ee7b7' : '#fca5a5'
                        }]}>{checkpointFeedback}</Text>
                      )}
                      <TouchableOpacity
                        style={[styles.checkpointBtn, { marginTop: 6, backgroundColor: checkpointStatus === 'correct' ? '#10b981' : '#ef4444', opacity: checkpointEvaluating ? 0.5 : 1 }]}
                        disabled={checkpointEvaluating}
                        onPress={() => {
                          checkpointUserAdvancedRef.current = true;
                          setCheckpointEvaluating(true);
                          handleCheckpointAdvance();
                        }}
                      >
                        <Text style={styles.checkpointBtnText}>Next Chunk →</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Reveal>
              )}

            </View>

            {/* Caption bar — toggled by the Subtitles button (showLiveText) */}
            {showLiveText && (
              <View style={[styles.captionBar, { borderTopColor: `${activityColor}44` }]}>
                <View style={[styles.captionIcon, { backgroundColor: `${activityColor}26`, borderColor: `${activityColor}66` }]}>
                  <Icon name={activity.icon} size={15} color={activityColor} />
                </View>
                <View style={styles.captionTextWrap}>
                  <StageCaption
                    text={captionText}
                    progress={isAdvancing ? 1 : beatProgress}
                    color={activityColor}
                    playing={captionPlaying}
                    windowWords={28}
                    size={16}
                  />
                </View>
                <BeatTimeline beats={teachingBeats} activeIndex={isAdvancing ? teachingBeats.length : (activeBeat?.index ?? 0)} />
              </View>
            )}

            {/* Desktop presenter bar — below subtitles, same visual language as caption bar */}
            {!isMobile && (
              <View style={[styles.desktopPresenterBar, { backgroundColor: isDark ? '#06060f' : '#070a14', borderTopColor: `${activityColor}22` }]} pointerEvents="none">
                <AITeacherAvatar state={avatarState} size={40} showLabel={false} minimal />
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <SpeakingWaveform active={avatarState === 'speaking'} color={activityColor} numBars={38} progress={beatProgress} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: activityColor, opacity: avatarState === 'idle' ? 0.35 : 1 }} />
                  <Text style={{ color: activityColor, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {avatarState === 'speaking' ? 'Speaking' : avatarState === 'thinking' ? 'Thinking' : avatarState === 'listening' ? 'Listening' : avatarState === 'complete' ? 'Done' : 'Ready'}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 8 }}>SkillSphere AI</Text>
                </View>
              </View>
            )}
          </View>

          {/* Mobile inline panel — shows between board and bottom tab bar */}
          {isMobile && (
            <View style={[styles.mobileInlinePanel, {
              backgroundColor: isDark ? '#0f0f1e' : theme.colors.surface,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : theme.colors.border,
            }]}>
              {activeToolPanel && ['topics', 'chat', 'flashcards', 'notes', 'more'].includes(activeToolPanel) ? (
                <>
                  {activeToolPanel === 'topics' && renderSidebar()}
                  {activeToolPanel === 'chat' && renderChatSidePanel()}
                  {activeToolPanel === 'flashcards' && renderFlashcardsSidePanel()}
                  {activeToolPanel === 'notes' && renderNotesSidePanel()}
                  {activeToolPanel === 'more' && renderMoreSidePanel()}
                </>
              ) : activeBeat?.kind === 'checkpoint' && !!checkpointText ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.checkpointBadge}>
                    <Icon name="help-circle" size={15} color={
                      checkpointStatus === 'correct' ? '#10b981' :
                      checkpointStatus === 'wrong' ? '#ef4444' :
                      checkpointStatus === 'skipped' ? '#64748b' : '#fb923c'
                    } />
                    <Text style={[styles.checkpointBadgeText, {
                      color: checkpointStatus === 'correct' ? '#10b981' :
                             checkpointStatus === 'wrong' ? '#ef4444' :
                             checkpointStatus === 'skipped' ? '#64748b' : '#fb923c'
                    }]}>
                      {checkpointStatus === 'correct' ? 'CORRECT' :
                       checkpointStatus === 'wrong' ? 'NOT QUITE' :
                       checkpointStatus === 'skipped' ? 'SKIPPED' : 'QUICK CHECK'}
                    </Text>
                  </View>
                  <Text style={[styles.checkpointSpotlightText, { fontSize: 15, lineHeight: 22, color: isDark ? '#fef3c7' : '#1e293b' }]}>{checkpointText}</Text>
                  {!checkpointStatus && (
                    <>
                      <TextInput
                        style={[styles.checkpointInput, { marginTop: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', color: isDark ? '#fff' : '#1e293b' }]}
                        placeholder="Type your answer..."
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'}
                        value={checkpointInput}
                        onChangeText={setCheckpointInput}
                        onKeyPress={(e) => {
                          if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                            e.preventDefault?.();
                            if (checkpointInput.trim() && !checkpointEvaluating) {
                              setCheckpointEvaluating(true);
                              aiTutorAPI.evaluateCheckpoint({
                                question: checkpointText,
                                studentAnswer: checkpointInput.trim(),
                                chunkText: currentChunk?.text || currentNarration,
                                language: lecture?.language,
                              }).then(res => {
                                const s = res.correct ? 'correct' : 'wrong';
                                checkpointStatusRef.current = s;
                                setCheckpointStatus(s);
                                setCheckpointFeedback(res.feedback || '');
                              }).catch(err => {
                                console.error('Checkpoint evaluation error:', err);
                                checkpointStatusRef.current = 'skipped';
                                setCheckpointStatus('skipped');
                                setCheckpointFeedback('Could not evaluate answer.');
                              }).finally(() => setCheckpointEvaluating(false));
                            }
                          }
                        }}
                        multiline
                        editable={!checkpointEvaluating}
                      />
                      <View style={styles.checkpointActions}>
                        <TouchableOpacity
                          style={[styles.checkpointBtn, styles.checkpointSubmitBtn, (!checkpointInput.trim() || checkpointEvaluating) && { opacity: 0.4 }]}
                          disabled={!checkpointInput.trim() || checkpointEvaluating}
                          onPress={async () => {
                            setCheckpointEvaluating(true);
                            try {
                              const res = await aiTutorAPI.evaluateCheckpoint({
                                question: checkpointText,
                                studentAnswer: checkpointInput.trim(),
                                chunkText: currentChunk?.text || currentNarration,
                                language: lecture?.language,
                              });
                              const s = res.correct ? 'correct' : 'wrong';
                              checkpointStatusRef.current = s;
                              setCheckpointStatus(s);
                              setCheckpointFeedback(res.feedback || '');
                            } catch (err) {
                              console.error('Checkpoint evaluation error:', err);
                              checkpointStatusRef.current = 'skipped';
                              setCheckpointStatus('skipped');
                              setCheckpointFeedback('Could not evaluate answer.');
                            } finally {
                              setCheckpointEvaluating(false);
                            }
                          }}
                        >
                          {checkpointEvaluating
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.checkpointBtnText}>Submit</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.checkpointBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]}
                          disabled={checkpointEvaluating}
                          onPress={() => {
                            checkpointStatusRef.current = 'skipped';
                            checkpointUserAdvancedRef.current = true;
                            setCheckpointStatus('skipped');
                            setCheckpointFeedback('');
                            handleCheckpointAdvance();
                          }}
                        >
                          <Text style={[styles.checkpointBtnText, { color: '#94a3b8' }]}>Skip →</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                  {(checkpointStatus === 'correct' || checkpointStatus === 'wrong') && (
                    <>
                      {!!checkpointFeedback && (
                        <Text style={[styles.checkpointFeedbackText, {
                          color: checkpointStatus === 'correct' ? (isDark ? '#6ee7b7' : '#059669') : (isDark ? '#fca5a5' : '#dc2626')
                        }]}>{checkpointFeedback}</Text>
                      )}
                      <TouchableOpacity
                        style={[styles.checkpointBtn, { marginTop: 6, backgroundColor: checkpointStatus === 'correct' ? '#10b981' : '#ef4444', opacity: checkpointEvaluating ? 0.5 : 1 }]}
                        disabled={checkpointEvaluating}
                        onPress={() => {
                          checkpointUserAdvancedRef.current = true;
                          setCheckpointEvaluating(true);
                          handleCheckpointAdvance();
                        }}
                      >
                        <Text style={styles.checkpointBtnText}>Next Chunk →</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, backgroundColor: isDark ? '#06060f' : '#070a14' }} pointerEvents="none">
                  <AITeacherAvatar state={avatarState} size={50} showLabel={false} minimal />
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activityColor, opacity: avatarState === 'idle' ? 0.4 : 1 }} />
                        <Text style={{ color: activityColor, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' }}>
                          {avatarState === 'speaking' ? 'Speaking' : avatarState === 'thinking' ? 'Thinking' : avatarState === 'listening' ? 'Listening' : avatarState === 'complete' ? 'Done' : 'Ready'}
                        </Text>
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase' }}>SkillSphere AI</Text>
                    </View>
                    <SpeakingWaveform active={avatarState === 'speaking'} color={activityColor} numBars={26} />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Bottom bar / Mobile tab bar */}
          {isMobile ? (
            <View style={[styles.mobileTabBar, {
              backgroundColor: isDark ? '#0d0d1f' : '#1e293b',
              borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
            }]}>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => setShowLiveText(v => !v)}>
                <MaterialIcon name={showLiveText ? 'subtitles' : 'subtitles-outline'} size={22} color={showLiveText ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: showLiveText ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Subtitle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => openToolPanel('topics')}>
                <MaterialIcon name="book-open-variant" size={22} color={activeToolPanel === 'topics' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activeToolPanel === 'topics' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Topics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => openToolPanel('notes')}>
                <Icon name={activeToolPanel === 'notes' ? 'document-text' : 'document-text-outline'} size={22} color={activeToolPanel === 'notes' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activeToolPanel === 'notes' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Notes</Text>
              </TouchableOpacity>
              {/* Centre pill — quiz when complete, play/pause otherwise */}
              {lectureCompleted ? (
                <TouchableOpacity style={[styles.mobileTabCenter, { backgroundColor: '#10b981' }]} onPress={openQuiz} accessibilityLabel="Take quiz">
                  <MaterialIcon name="help-circle" size={26} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.mobileTabCenter, { backgroundColor: theme.colors.primary }]} onPress={togglePause} accessibilityLabel={isPlaying ? 'Pause lecture' : 'Resume lecture'}>
                  <Icon name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => openToolPanel('flashcards')}>
                <Icon name={activeToolPanel === 'flashcards' ? 'albums' : 'albums-outline'} size={22} color={activeToolPanel === 'flashcards' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activeToolPanel === 'flashcards' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Cards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={openInlineQA}>
                <Icon name={qaActive ? 'hand-left' : 'hand-left-outline'} size={22} color={qaActive ? '#f59e0b' : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: qaActive ? '#f59e0b' : 'rgba(255,255,255,0.45)' }]}>Ask</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => openToolPanel('more')}>
                <Icon name={activeToolPanel === 'more' ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={22} color={activeToolPanel === 'more' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activeToolPanel === 'more' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>More</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={[styles.quizButton, { backgroundColor: lectureCompleted ? '#10b981' : (isDark ? '#1a2235' : '#e2e8f0') }]}
                onPress={openQuiz}
                accessibilityLabel="Take quiz"
              >
                <MaterialIcon name="help-circle" size={20} color={lectureCompleted ? '#fff' : (isDark ? '#4b5563' : '#9ca3af')} />
                <Text style={[styles.quizButtonText, { color: lectureCompleted ? '#fff' : (isDark ? '#4b5563' : '#9ca3af') }]}>Take Quiz</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Inline classroom Q&A — pauses the lecture and answers on the board */}
          {renderInlineQA()}
        </View>
      </View>

      <ConfirmDialog
        visible={showCompleteDialog}
        title="Lecture Complete"
        message="The lecture is finished. Open the quiz to unlock the next topic, or take the lecture again from the beginning."
        confirmText="Open Quiz"
        confirmVariant="primary"
        onConfirm={() => {
          setShowCompleteDialog(false);
          openQuiz();
        }}
        onCancel={() => setShowCompleteDialog(false)}
      />

      <VoiceQAOverlay
        visible={showVoiceQA}
        sessionId={session?.id ?? null}
        courseId={courseId}
        language={course?.language}
        topicId={topicId}
        studentName={studentName}
        theme={theme}
        onQuestionAnswered={(question, answer) => {
          // Append to sidebar chat so user can read it later
          setChatMessages(prev => [
            ...prev,
            { type: 'user', text: question },
            { type: 'ai', text: answer },
          ]);
          // Open the chat panel so the conversation is visible
          setActiveToolPanel('chat');
        }}
        onClose={() => {
          setShowVoiceQA(false);
          setHandRaised(false);
          // Resume lecture after overlay closes
          setTimeout(() => setIsPlaying(true), 600);
        }}
      />
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, minHeight: 0, overflow: 'hidden' },
  sessionShell: { gap: 14, flex: 1, minHeight: 0, overflow: 'hidden' },
  sessionToolbar: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sessionToolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, flex: 1.2 },
  toolbarBackButton: { borderRadius: 14 },
  sessionIdentity: { flex: 1, minWidth: 0 },
  sessionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  sessionTitle: { fontSize: 18, fontWeight: '800' },
  sessionSubtitle: { fontSize: 12, marginTop: 2 },
  sessionToolbarCenter: { flex: 1.4, gap: 10 },
  toolbarBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toolbarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolbarBadgeText: { fontSize: 12, fontWeight: '700' },
  sessionToolbarRight: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flex: 1.4, flexWrap: 'nowrap', alignItems: 'center', minWidth: 0 },
  toolbarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolbarActionText: { fontSize: 12, fontWeight: '700' },
  toolbarControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  toolbarDivider: { width: 1, alignSelf: 'stretch' },
  toolbarActionCompact: {
    width: 64,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  toolbarActionCaption: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveIndicatorDot: { width: 10, height: 10, borderRadius: 5 },
  liveIndicatorText: { fontSize: 12, fontWeight: '800' },
  classroomStage: { flex: 1, flexDirection: 'row', gap: 14, minHeight: 0 },
  classroomStageStack: { flexDirection: 'column' },
  classroomMainColumn: { flex: 1, minHeight: 0 },
  stageHeroCard: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    minHeight: 0,
  },
  stageHeroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stageHeroLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  stageMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  stageModePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  stageModePillText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  stageMetaPillText: { fontSize: 11, fontWeight: '700' },
  sessionClockText: { fontSize: 12, fontWeight: '800' },
  stageTutorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  stageTutorPulse: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTutorMeta: { flex: 1, minWidth: 0 },
  stageTutorName: { fontSize: 13, fontWeight: '800' },
  stageTutorLine: { fontSize: 12, marginTop: 2 },
  stageSupportChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  stageSupportLabel: { fontSize: 12, fontWeight: '700' },
  inlineTransitionCard: { borderRadius: 16, padding: 12, borderWidth: 1 },
  stageCanvasFrame: {
    flex: 1,
    minHeight: 360,
    borderRadius: 24,
    padding: 8,
  },
  stageWhiteboard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  stageBoardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  stageBoardSubtext: { color: '#cbd5e1', fontSize: 11, lineHeight: 16, marginTop: 2, maxWidth: 680 },
  stageBoardHeaderActions: { flexDirection: 'row', gap: 8 },
  stageMiniControl: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subtitleDock: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginTop: 8 },
  subtitleDockTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitleDockText: { fontSize: 16, lineHeight: 26, fontWeight: '500', marginTop: 6 },
  contextDrawer: {
    width: 360,
    borderRadius: 28,
    borderWidth: 1,
    padding: 12,
    minHeight: 0,
  },
  contextDrawerOverlay: {
    width: '100%',
    maxHeight: 360,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  progressBarWrap: { flex: 1 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexDirection: 'row' },
  progressFill: { height: '100%' },
  progressValue: { fontSize: 13, fontWeight: '700' },
  lectureTimeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, alignSelf: 'flex-start' },
  lectureTimeBannerText: { fontSize: 13, fontWeight: '700' },
  statusCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 },
  statusTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 15, fontWeight: '700' },
  statusMeta: { fontSize: 12, fontWeight: '700' },
  statusText: { fontSize: 13, lineHeight: 20 },
  metaPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  metaPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  transitionCard: { borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1 },
  transitionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  transitionText: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  topRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  topRowStack: { flexDirection: 'column' },
  whiteboard: { flex: 1, borderRadius: 16, padding: 16 },
  liveBoard: { minHeight: 320 },
  sideStack: { width: 220, gap: 12 },
  tutorPanel: { width: 190, borderRadius: 16, padding: 16, alignItems: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  boardHeaderRow: { marginBottom: 14, gap: 10 },
  boardModeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  boardModeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  boardObjective: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  whiteboardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  whiteboardSummary: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  boardSurface: { flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, gap: 14, flexDirection: 'row', alignItems: 'stretch', minHeight: 0 },
  boardSurfaceStack: { flexDirection: 'column' },
  boardPrimaryColumn: { flex: 1, justifyContent: 'center', minWidth: 0 },
  boardVisualRail: { width: 260, gap: 10 },
  tutorPresenceColumn: { width: 250, alignItems: 'center', justifyContent: 'flex-start' },
  tutorPresenceMobile: { marginBottom: 12 },
  // ── Virtual Classroom Stage ──
  classroomStage: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 0,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0) 24%)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
        }
      : {}),
  },
  classroomTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  classroomLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  classroomLiveDot: { width: 7, height: 7, borderRadius: 4 },
  classroomLiveLabel: { color: '#e2e8f0', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  classroomTitle: { flex: 1, minWidth: 0, color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  classroomModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  classroomModeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  classroomControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  classroomBoard: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    backgroundColor: 'rgba(255,255,255,0.015)',
    // Smart-board look: a faint dotted grid like an infinite canvas (web only).
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }
      : {}),
  },
  classroomBoardScroll: { flex: 1 },
  classroomBoardContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 40,
  },
  desktopPresenterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderTopWidth: 1,
    height: 56,
  },
  checkpointSpotlight: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 16,
    backgroundColor: 'rgba(20,14,4,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.5)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 12px 40px rgba(251,146,60,0.25)' } : {}),
  },
  checkpointBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkpointBadgeText: { color: '#fb923c', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  checkpointSpotlightText: { color: '#fef3c7', fontSize: 18, lineHeight: 26, fontWeight: '700' },
  checkpointInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  checkpointActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  checkpointBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkpointSubmitBtn: { backgroundColor: '#fb923c' },
  checkpointSkipBtn: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  checkpointBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkpointFeedbackText: { fontSize: 13, lineHeight: 20, fontStyle: 'italic', marginTop: 2 },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 64,
    borderTopWidth: 2,
    backgroundColor: 'rgba(2,6,23,0.6)',
  },
  captionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  captionTextWrap: { flex: 1, minWidth: 0, justifyContent: 'center' },
  // ── Inline classroom Q&A overlay ──
  qaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,7,18,0.80)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } : {}),
  },
  qaCard: {
    // Explicit pixel height (set inline from windowHeight) → reliable in RN-web,
    // so the inner flex column distributes and the footer sits at the bottom.
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    minHeight: 0,
    flexDirection: 'column',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: '#0d0f1f',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
        }
      : {}),
  },
  qaHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  qaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  qaSSBrand: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,140,66,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,140,66,0.45)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  qaHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  qaHeaderSub: { color: '#64748b', fontSize: 11, fontWeight: '600', letterSpacing: 0.2, marginTop: 1 },
  qaPhasePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  qaPhaseDot: { width: 6, height: 6, borderRadius: 3 },
  qaPhaseText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  qaClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  qaQuestionChip: {
    marginHorizontal: 16, marginTop: 12,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  qaQuestionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  qaQuestionText: { color: '#f1f5f9', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  qaBody: { minHeight: 0, paddingHorizontal: 20, paddingTop: 10 },
  qaHeaderAvatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qaAnswerScroll: { paddingBottom: 16, gap: 12, alignItems: 'stretch' },
  qaPrompt: { color: '#94a3b8', fontSize: 16, lineHeight: 26, fontStyle: 'italic' },
  qaThinking: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  // ── Animated "AI is thinking" orb ──
  thinkWrap: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 26, width: '100%' },
  thinkOrb: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  thinkHalo: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2 },
  thinkGlow: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  thinkArc: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: 'transparent' },
  thinkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  thinkLabel: { fontSize: 15, fontStyle: 'italic', fontWeight: '700' },
  thinkDots: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 10, paddingBottom: 2 },
  thinkDot: { width: 6, height: 6, borderRadius: 3 },
  qaThinkingText: { color: '#cbd5e1', fontSize: 15, fontStyle: 'italic' },
  qaAnswerText: { color: '#f1f5f9', fontSize: 18, lineHeight: 29, fontWeight: '400', marginVertical: 4 },
  qaFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#080c1a',
  },
  qaMic: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  qaInputField: {
    flex: 1, minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    color: '#f1f5f9', fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  qaAskBtn: { backgroundColor: '#f59e0b', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexShrink: 0 },
  qaAskText: { color: '#0b1020', fontSize: 14, fontWeight: '800' },
  qaTickBtn: { backgroundColor: '#34d399', borderRadius: 12, width: 48, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qaGreetingText: { color: '#f8fafc', fontSize: 22, lineHeight: 30, fontWeight: '700' },
  qaListeningRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  qaListeningPulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  qaListeningText: { flex: 1, color: '#fecaca', fontSize: 15, fontWeight: '600' },
  qaSecondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  qaSecondaryText: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  qaResumeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 12 },
  qaResumeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  qaChipsHint: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  qaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  qaChipText: { color: '#fde68a', fontSize: 13, fontWeight: '700' },
  qaAnswerContainer: { width: '100%', borderLeftWidth: 3, borderLeftColor: 'rgba(245,158,11,0.6)', paddingLeft: 16, gap: 6 },
  qaDiagramWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 6,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    backgroundColor: 'rgba(139,92,246,0.06)',
    minHeight: 180,
  },
  qaDiagramCaption: { color: '#a5b4fc', fontSize: 13, fontStyle: 'italic', marginTop: 8, textAlign: 'center', paddingHorizontal: 12 },
  boardSideCard: { borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)', borderRadius: 14, padding: 12, backgroundColor: 'rgba(2,6,23,0.26)' },
  boardSideEyebrow: { color: '#93c5fd', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 6 },
  boardSideTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  boardSideText: { color: '#cbd5e1', fontSize: 12, lineHeight: 19 },
  boardSideBullet: { color: '#e2e8f0', fontSize: 12, lineHeight: 18, marginBottom: 6 },
  boardCheckpointCard: { backgroundColor: 'rgba(124,45,18,0.24)', borderColor: 'rgba(251,146,60,0.25)' },
  boardCheckpointText: { color: '#ffedd5', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  boardBodyText: { color: '#e2e8f0', fontSize: 15, lineHeight: 24 },
  diagramWrap: { justifyContent: 'center', alignItems: 'center', paddingVertical: 8, width: '100%' },
  diagramCaption: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

  // ── Plain text block (no boardContent) ────────────────────────────────────
  plainTextBlock: { gap: 12, maxWidth: 820 },
  plainTextLine: { color: '#f1f5f9', fontSize: 20, lineHeight: 32, fontWeight: '400' },

  // ── Chalk-style whiteboard notes ──────────────────────────────────────────
  chalkNoteBlock: { gap: 12, maxWidth: 780, alignSelf: 'center' },
  // ── Rich lesson slide (fills the board) ──
  lessonSlide: { width: '100%', maxWidth: 860, alignSelf: 'center', gap: 16 },
  lessonBullets: { gap: 12 },
  lessonBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  lessonBulletBadge: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.45)',
    marginTop: 2, flexShrink: 0,
  },
  lessonBulletBadgeText: { color: '#a5b4fc', fontSize: 14, fontWeight: '800' },
  lessonBulletText: { flex: 1, color: '#f1f5f9', fontSize: 19, lineHeight: 30, fontWeight: '500' },
  lessonSection: { gap: 8 },
  lessonSectionLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  lessonChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lessonChip: {
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)',
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7,
  },
  lessonChipText: { color: '#67e8f9', fontSize: 14, fontWeight: '700' },
  lessonExampleCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.32)',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 14, padding: 14,
  },
  lessonExampleLabel: { color: '#fbbf24', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  lessonExampleText: { color: '#fde9c8', fontSize: 16, lineHeight: 24, fontWeight: '500' },
  lessonAnalogyCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderLeftWidth: 3, borderLeftColor: '#60a5fa',
    backgroundColor: 'rgba(96,165,250,0.07)',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
  },
  lessonAnalogyText: { flex: 1, color: '#bfdbfe', fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  // ── Guided steps with real screenshots ──
  guidedWrap: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 22 },
  guidedStep: { gap: 12 },
  guidedStepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  guidedNum: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)',
    marginTop: 2, flexShrink: 0,
  },
  guidedNumText: { color: '#34d399', fontSize: 15, fontWeight: '800' },
  guidedInstruction: { flex: 1, color: '#f1f5f9', fontSize: 19, lineHeight: 28, fontWeight: '600' },
  guidedShotFrame: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#0b1020',
    ...(Platform.OS === 'web' ? { boxShadow: '0 10px 30px rgba(0,0,0,0.4)' } : {}),
  },
  guidedImage: { width: '100%', height: 360, backgroundColor: '#0b1020' },
  guidedCaption: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', paddingHorizontal: 4 },
  guidedStepActive: {
    borderRadius: 14, padding: 12, marginHorizontal: -12,
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.28)',
  },
  guidedNumActive: { backgroundColor: '#34d399', borderColor: '#34d399' },
  guidedLiveTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.18)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3, flexShrink: 0,
  },
  guidedLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' },
  guidedLiveText: { color: '#6ee7b7', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  // Browser-window frame for screenshots
  browserFrame: {
    width: '100%', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0b1020',
    ...(Platform.OS === 'web' ? { boxShadow: '0 10px 30px rgba(0,0,0,0.45)' } : {}),
  },
  browserFrameActive: {
    borderColor: 'rgba(16,185,129,0.6)',
    ...(Platform.OS === 'web' ? { boxShadow: '0 12px 40px rgba(16,185,129,0.25)' } : {}),
  },
  browserBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#1b2030', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  browserDot: { width: 10, height: 10, borderRadius: 5 },
  browserUrlPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 4,
  },
  browserUrlText: { color: '#cbd5e1', fontSize: 12, flex: 1 },
  guidedDesktopNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(148,163,184,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', borderStyle: 'dashed',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  guidedDesktopText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  guidedConnector: { width: 2, height: 22, backgroundColor: 'rgba(16,185,129,0.35)', marginLeft: 15, marginVertical: 2, borderRadius: 1 },
  chalkBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  chalkBulletArrow: { color: '#60a5fa', fontSize: 20, lineHeight: 30, fontWeight: '700', flexShrink: 0 },
  chalkBulletText: { flex: 1, color: '#f1f5f9', fontSize: 19, lineHeight: 30, fontWeight: '500' },
  chalkEmphasis: { color: '#93c5fd', fontSize: 17, lineHeight: 26, marginTop: 14, fontStyle: 'italic', borderLeftWidth: 3, borderLeftColor: '#60a5fa', paddingLeft: 14 },

  // ── Terminal / console code block ─────────────────────────────────────────
  terminalWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#0d1117', width: '100%', maxWidth: 820, alignSelf: 'center' },
  terminalBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1c1f26', paddingHorizontal: 14, paddingVertical: 10 },
  terminalDot: { width: 12, height: 12, borderRadius: 6 },
  terminalLangLabel: { color: '#6b7280', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  terminalBody: { padding: 14, gap: 2 },
  terminalLine: { flexDirection: 'row', gap: 12 },
  terminalLineNum: { color: '#4b5563', fontSize: 13, lineHeight: 22, width: 24, textAlign: 'right', fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier', flexShrink: 0 },
  terminalLineCode: { flex: 1, color: '#e5e7eb', fontSize: 15, lineHeight: 24, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier' },
  terminalFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 14, paddingVertical: 10 },
  terminalFooterIcon: { color: '#60a5fa', fontSize: 13, lineHeight: 20, flexShrink: 0 },
  terminalFooterText: { flex: 1, color: '#94a3b8', fontSize: 12, lineHeight: 19 },

  boardBullet: { color: '#e2e8f0', fontSize: 15, lineHeight: 24, marginBottom: 8 },
  boardEmphasis: { color: '#93c5fd', fontSize: 14, lineHeight: 22, marginTop: 12, fontStyle: 'italic' },
  boardQuestion: { color: '#fef3c7', fontSize: 22, lineHeight: 30, fontWeight: '700' },
  sectionLabel: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  sectionText: { color: '#cbd5e1', fontSize: 13, lineHeight: 21 },
  tutorLabel: { fontSize: 14, fontWeight: '700', marginBottom: 16 },
  avatarRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: 'rgba(79,70,229,0.3)', justifyContent: 'center', alignItems: 'center' },
  avatarInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#a855f7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  tutorMeta: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  visualRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  visualCard: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  visualHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  visualEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  visualTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  visualBody: { fontSize: 13, lineHeight: 21 },
  visualHint: { borderRadius: 12, padding: 12, marginTop: 12 },
  visualHintLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  visualHintText: { fontSize: 13, lineHeight: 20 },
  diagramRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  diagramIndex: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  diagramIndexText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  diagramText: { flex: 1, fontSize: 13, lineHeight: 20 },
  flowStep: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  flowStepBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  flowStepBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  flowStepText: { flex: 1, color: '#e2e8f0', fontSize: 14, lineHeight: 21 },
  boardTable: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  boardTableRow: { padding: 12, borderBottomWidth: 1 },
  boardTableTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  boardTableBody: { fontSize: 12, lineHeight: 18 },
  nodeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nodeCard: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  nodeLabel: { fontSize: 12, fontWeight: '600' },
  liveNodeCard: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  liveNodeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ── Flowchart visual component ──────────────────────────────────────────────
  flowchartWrap: { gap: 0, paddingHorizontal: 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flowchartNode: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  flowchartBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  flowchartBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  flowchartLabel: { color: '#f1f5f9', fontSize: 16, lineHeight: 23, fontWeight: '500' },
  flowchartCue: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginTop: 2, fontStyle: 'italic' },
  flowchartConnector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  flowchartConnectorLine: { width: 1.5, height: 8, borderRadius: 1 },
  flowchartConnectorArrow: { fontSize: 12, marginHorizontal: 0, lineHeight: 14 },

  // ── Comparison table visual component ──────────────────────────────────────
  comparisonWrap: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: '100%', maxWidth: 820, alignSelf: 'center' },
  // alignItems: 'stretch' so the VS badge column matches the header cell heights without needing height:'100%'
  comparisonHeader: { flexDirection: 'row', alignItems: 'stretch' },
  comparisonHeaderCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, justifyContent: 'center' },
  comparisonHeaderText: { fontSize: 12, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },
  // height: '100%' removed — parent uses alignItems:'stretch' so this column fills naturally
  comparisonVsBadge: { width: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  comparisonVsText: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  comparisonRow: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  comparisonCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'center' },
  comparisonCellText: { color: '#cbd5e1', fontSize: 13, lineHeight: 19 },
  comparisonDivider: { width: 34, backgroundColor: 'rgba(255,255,255,0.04)' },

  // ── Concept node cards (diagram fallback) ───────────────────────────────────
  conceptNodeWrap: { gap: 4, width: '100%', maxWidth: 620, alignSelf: 'center' },
  conceptNodeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  conceptNodeBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  conceptNodeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  conceptNodeConnector: { alignItems: 'center', height: 14, justifyContent: 'center' },
  conceptNodeConnectorLine: { width: 2, height: 10, borderRadius: 1 },
  conceptNodeText: { flex: 1, color: '#f1f5f9', fontSize: 17, fontWeight: '500', lineHeight: 25 },
  codePanel: { borderWidth: 1, borderRadius: 14, padding: 14, backgroundColor: 'rgba(15,23,42,0.92)' },
  codeLanguage: { color: '#93c5fd', fontSize: 11, fontWeight: '700', marginBottom: 10, letterSpacing: 1 },
  codeText: { color: '#e5e7eb', fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier', fontSize: 13, lineHeight: 20 },
  codeHint: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginTop: 12 },
  teacherCardsRow: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  teacherCard: { flex: 1, minWidth: 210, borderRadius: 16, padding: 14, borderWidth: 1 },
  teacherCardLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  teacherCardText: { fontSize: 13, lineHeight: 20 },
  supportCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  supportLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  supportText: { fontSize: 13, lineHeight: 20 },
  stageInsightsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  insightCard: { flex: 1, minWidth: 220, borderWidth: 1, borderRadius: 18, padding: 14 },
  insightLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  insightText: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  subtitlesCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  subtitlesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subtitlesTitle: { fontSize: 12, fontWeight: '700' },
  modeBadge: { color: '#fff', backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, fontSize: 10, fontWeight: '700' },
  subtitlesText: { fontSize: 15, lineHeight: 24 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  segmentPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: '100%' },
  segmentText: { fontSize: 11, fontWeight: '600' },
  qaCard: { borderRadius: 16, padding: 16, marginBottom: 16, maxHeight: 340 },
  qaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  qaTitle: { fontSize: 15, fontWeight: '700' },
  chatScroll: { maxHeight: 180, marginBottom: 12 },
  chatScrollContent: { paddingBottom: 4 },
  chatEmptyState: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 10 },
  chatEmptyTitle: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  chatEmptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  chatBubble: { padding: 12, borderRadius: 14, marginBottom: 8, maxWidth: '92%', borderWidth: 1 },
  chatBubbleUser: { backgroundColor: '#4F46E5', alignSelf: 'flex-end', borderColor: '#4F46E5' },
  chatBubbleAi: { backgroundColor: 'rgba(79,70,229,0.1)', alignSelf: 'flex-start' },
  chatRole: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputRow: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 18, padding: 10, alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 44, maxHeight: 92, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  toolPanelCard: { flex: 1, borderWidth: 1, borderRadius: 22, padding: 16, minHeight: 0, gap: 14 },
  toolPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  toolPanelTitle: { fontSize: 18, fontWeight: '800' },
  toolPanelSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  toolPanelScrollContent: { paddingBottom: 4, gap: 12 },
  quizPreviewCard: { borderWidth: 1, borderRadius: 18, padding: 14 },
  quizPreviewLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  quizPreviewValue: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  quizPreviewMeta: { fontSize: 13, lineHeight: 19 },
  quizLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  quizQuestionPreview: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  quizQuestionIndex: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  quizQuestionText: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  essentialsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  essentialsCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 18, padding: 14, minHeight: 120 },
  essentialsTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 10 },
  essentialsMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18, marginTop: 6 },
  notesReferenceCard: { borderWidth: 1, borderRadius: 18, padding: 14 },
  notesReferenceTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  notesReferenceMeta: { fontSize: 13, lineHeight: 19 },
  notesEditor: { flex: 1, minHeight: 220, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 22 },
  notesFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  notesSavedLabel: { fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  action: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', gap: 6 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sidebar: { flex: 1, paddingTop: 8, paddingHorizontal: 8 },
  sidebarTitle: { fontSize: 14, fontWeight: '700', padding: 16 },
  sidebarItem: { borderLeftWidth: 3, borderLeftColor: 'transparent', padding: 12, marginHorizontal: 8, marginBottom: 4, borderRadius: 10 },
  sidebarItemText: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sidebarItemDuration: { fontSize: 11, marginBottom: 4 },
  sidebarItemStatus: { fontSize: 11 },
  flashcard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  flashcardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12 },
  flashcardLabel: { fontSize: 12, fontWeight: '700' },
  flashcardHint: { fontSize: 11, fontWeight: '600' },
  flashcardFront: { fontSize: 16, lineHeight: 24, marginBottom: 12, fontWeight: '600' },
  flashcardDivider: { height: 1, marginBottom: 12 },
  flashcardMeta: { fontSize: 12, lineHeight: 18 },
  notesTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  notesBody: { fontSize: 14, lineHeight: 22, marginBottom: 6 },
  noteSection: { marginBottom: 14 },
  noteSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },

  // ── New layout styles (matches LearningScreen) ────────────────────────────
  mainContent: { flexDirection: 'row', overflow: 'hidden' },
  iconRail: { width: 78, borderRightWidth: 1, flexGrow: 0, flexShrink: 0 },
  // Mobile drawer overlay — slides in from the left over the lecture content
  mobilePanelOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 40,
    flexDirection: 'row',
  },
  mobilePanelBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  mobilePanelDrawer: {
    width: 290,
    flexShrink: 0,
    overflow: 'hidden',
  },
  mobileInlinePanel: {
    flex: 1,
    borderTopWidth: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  mobileTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderTopWidth: 1,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  mobileTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  mobileTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  mobileTabCenter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  iconRailContent: { alignItems: 'center', paddingTop: 18, paddingBottom: 18, gap: 4 },
  railBtn: { width: 64, paddingVertical: 11, borderRadius: 12, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'transparent' },
  railLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
  aiSlidePanel: { width: 290, flexShrink: 0, overflow: 'hidden', borderRightWidth: 1 },
  aiLearningArea: { flex: 1, overflow: 'hidden', padding: 14, flexDirection: 'column', backgroundColor: '#0d0f1f' },
  progressSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  lectureBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  progressLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 340, minWidth: 0, flexShrink: 1 },
  progressText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  progressBarContainer: { flex: 1 },
  progressFillGreen: { height: '100%', backgroundColor: '#10b981' },
  progressPercent: { fontSize: 12, fontWeight: '600' },
  stageWhiteboardNew: { padding: 12, borderRadius: 12, overflow: 'hidden' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  quizButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 25 },
  quizButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // ── AI side panel styles ───────────────────────────────────────────────────
  aiPanelContainer: { flex: 1, flexDirection: 'column', overflow: 'hidden' },
  aiPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1 },
  aiPanelAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  aiPanelTitle: { fontSize: 14, fontWeight: '700' },
  aiPanelSubtitle: { fontSize: 11, marginTop: 1 },
  aiOnlineDot: { width: 8, height: 8, borderRadius: 4 },
  aiPanelMessages: { padding: 12, gap: 10, paddingBottom: 8 },
  aiPanelMessagesEmpty: { flex: 1, justifyContent: 'center' },
  aiPanelEmpty: { alignItems: 'center', padding: 24, gap: 10 },
  aiPanelEmptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  aiPanelEmptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  aiPanelEmptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  aiChatRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  aiChatRowUser: { justifyContent: 'flex-end' },
  aiChatRowAI: { justifyContent: 'flex-start' },
  aiChatAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiChatBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 },
  aiChatText: { fontSize: 13, lineHeight: 20 },
  aiTypingRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  aiTypingDot: { width: 7, height: 7, borderRadius: 3.5 },
  aiPanelInputArea: { padding: 10, borderTopWidth: 1 },
  aiPanelInputBox: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 22, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, gap: 6 },
  aiPanelInput: { flex: 1, fontSize: 13, maxHeight: 80, paddingTop: 4, paddingBottom: 4 },
  aiPanelInputBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  aiSendBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  aiFlashcard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
  aiFlashcardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aiFlashcardLabel: { fontSize: 11, fontWeight: '700' },
  aiFlashcardHint: { fontSize: 10, fontWeight: '600' },
  aiFlashcardText: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  aiPanelFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, gap: 10 },
  aiFooterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  aiFooterBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  aiNotesEditor: { flex: 1, margin: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, lineHeight: 20 },
  aiNotesSaved: { flex: 1, fontSize: 11 },
  moreCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  moreCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  moreCardSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },

  // ── Visual rail card header ────────────────────────────────────────────────
  railCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  railDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  railModeBadge: { marginLeft: 'auto', borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  railModeBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  railBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 5 },
  railBulletDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#60a5fa', marginTop: 7, flexShrink: 0 },
});

export default AILearningScreen;
