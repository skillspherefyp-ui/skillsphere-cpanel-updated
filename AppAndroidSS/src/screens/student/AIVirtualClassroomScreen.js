/**
 * AI Virtual Classroom Screen — Phase 2 Production Edition
 *
 * Route params:
 *   topicId: number (required)
 *   courseId: number
 *   topicTitle: string (optional, for display)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';

import AITeacherAvatar from '../../components/classroom/AITeacherAvatar';
import SubtitleBar from '../../components/classroom/SubtitleBar';
import ClassroomWhiteboard from '../../components/classroom/ClassroomWhiteboard';
import LectureProgressTracker from '../../components/classroom/LectureProgressTracker';
import TypingText from '../../components/classroom/TypingText';
import AutoNotes from '../../components/classroom/AutoNotes';
import ClassroomQuizPanel from '../../components/classroom/ClassroomQuizPanel';
import { getAudioUrl } from '../../services/aiClassroomClient';
import { aiTutorAPI } from '../../services/apiClient';
import { useData } from '../../context/DataContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function flatChunks(lecture) {
  const chunks = [];
  (lecture?.sections || []).forEach((sec, si) => {
    (sec.chunks || []).forEach((ch, ci) => {
      chunks.push({ ...ch, _sectionIndex: si, _chunkIndex: ci, _sectionTitle: sec.title });
    });
  });
  return chunks;
}

function playAudio(url, onEnd) {
  if (Platform.OS !== 'web') { onEnd?.(); return null; }
  try {
    const audio = new window.Audio(url);
    audio.onended = onEnd;
    audio.onerror = onEnd;
    audio.play().catch(onEnd);
    return audio;
  } catch { onEnd?.(); return null; }
}

function extractNote(chunk) {
  const terms = chunk.key_terms || chunk.keyTerms || [];
  const summary = chunk.summary || chunk.spoken_explanation?.slice(0, 140) || chunk.spokenExplanation?.slice(0, 140) || '';
  return { sectionTitle: chunk._sectionTitle || '', keyTerms: terms, summary };
}

// ── Loading screen ────────────────────────────────────────────────────────────

function ClassroomLoader({ topic }) {
  const dotAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 3, duration: 900, useNativeDriver: false }),
        Animated.timing(dotAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const rotate = ringAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.loaderContainer}>
      <View style={styles.loaderCard}>
        <View style={styles.loaderAvatarWrap}>
          <Animated.View style={[styles.loaderRing, { transform: [{ rotate }] }]} />
          <View style={styles.loaderAvatarCore}>
            <Icon name="school-outline" size={32} color="#6C63FF" />
          </View>
        </View>
        <Text style={styles.loaderTitle}>Preparing Your Classroom</Text>
        <Text style={styles.loaderTopic}>{topic || 'AI Lecture'}</Text>
        <Text style={styles.loaderSub}>Generating lecture · diagrams · examples</Text>
        <View style={styles.loaderDots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[styles.dot, {
                opacity: dotAnim.interpolate({
                  inputRange: [i, i + 0.5, i + 1],
                  outputRange: [0.2, 1, 0.2],
                  extrapolate: 'clamp',
                }),
              }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Question Panel ────────────────────────────────────────────────────────────

const QA_GREETINGS = {
  Urdu:    { title: 'سوال پوچھیں',        subtitle: 'لیکچر رکا ہوا ہے · AI تیار ہے' },
  Arabic:  { title: 'اطرح سؤالك',         subtitle: 'المحاضرة متوقفة · AI جاهز' },
  default: { title: 'Ask Your Question',  subtitle: 'Lecture paused · AI is ready' },
};

function QuestionPanel({ onAsk, onDismiss, loading, history, language }) {
  const [q, setQ] = useState('');
  const { title: qTitle, subtitle: qSubtitle } = QA_GREETINGS[language] || QA_GREETINGS.default;

  const submit = () => {
    if (!q.trim()) return;
    onAsk(q.trim());
    setQ('');
  };

  return (
    <View style={styles.qPanel}>
      <View style={styles.qHeader}>
        <View style={styles.qBadge}>
          <Icon name="hand-left-outline" size={14} color="#f59e0b" />
          <Text style={styles.qTitle}>{qTitle}</Text>
        </View>
        <Text style={styles.qSubtitle}>{qSubtitle}</Text>
        <TouchableOpacity style={styles.qClose} onPress={onDismiss}>
          <Icon name="close" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {history.length > 0 && (
        <ScrollView style={styles.qHistory} showsVerticalScrollIndicator={false}>
          {history.map((h, i) => (
            <View key={i} style={[styles.qBubble, h.role === 'user' ? styles.qBubbleUser : styles.qBubbleAI]}>
              <Text style={[styles.qBubbleText, h.role === 'user' ? styles.qBubbleTextUser : styles.qBubbleTextAI]}>
                {h.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.qInputRow}>
        <TextInput
          style={styles.qInput}
          value={q}
          onChangeText={setQ}
          placeholder="Type your question..."
          placeholderTextColor="#4b5563"
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          style={[styles.qSendBtn, (!q.trim() || loading) && styles.qSendBtnDisabled]}
          onPress={submit}
          disabled={!q.trim() || loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.resumeBtn} onPress={onDismiss}>
        <Icon name="play" size={13} color="#10b981" />
        <Text style={styles.resumeBtnText}>Resume Lecture</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AIVirtualClassroomScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { topicId, courseId, topicTitle } = route.params || {};
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { courses } = useData();
  const courseLanguage = courses?.find(c => String(c.id) === String(courseId))?.language;

  // Lecture + session data
  const [lecture, setLecture] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Classroom state
  const [avatarState, setAvatarState] = useState('idle');
  const [playing, setPlaying] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const [lectureComplete, setLectureComplete] = useState(false);

  // Q&A state
  const [showQPanel, setShowQPanel] = useState(false);
  const [qLoading, setQLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Notes + UI
  const [notes, setNotes] = useState([]);
  const [rightTab, setRightTab] = useState('whiteboard');
  const [typingKey, setTypingKey] = useState(0);

  const audioRef = useRef(null);
  const autoAdvanceTimer = useRef(null);
  const sessionIdRef = useRef(null);

  const currentChunk = chunks[chunkIdx] || null;
  const sections = lecture?.sections || [];

  // ── Load lecture via real session API ───────────────────────────────────────

  useEffect(() => {
    loadLecture();
    return () => {
      stopAudio();
      clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  const loadLecture = async () => {
    if (!topicId) { setError('No topic specified'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = await aiTutorAPI.startSession(topicId, { voiceModeEnabled: false });
      const sess = payload.session;
      const lect = payload.lecture;
      if (!lect) throw new Error('Lecture not found for this topic');
      setSessionId(sess?.id || null);
      sessionIdRef.current = sess?.id || null;
      setLecture(lect);
      setChunks(flatChunks(lect));
    } catch (err) {
      setError(err.message || 'Could not start classroom session');
    } finally {
      setLoading(false);
    }
  };

  // ── Playback ────────────────────────────────────────────────────────────────

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause?.();
      audioRef.current = null;
    }
    clearTimeout(autoAdvanceTimer.current);
  };

  const speakChunk = useCallback(async (chunk) => {
    if (!chunk) return;
    stopAudio();

    const text = chunk.spoken_explanation || chunk.spokenExplanation || chunk.explanation || '';
    setSubtitleText(text);
    setSubtitleVisible(true);
    setAvatarState('speaking');
    setPlaying(true);
    setTypingKey(k => k + 1);

    try {
      const res = await aiTutorAPI.speakText({ text: text.slice(0, 1000), voice: 'alloy' });
      const audioUrl = res?.url ? getAudioUrl(res.url) : null;
      if (audioUrl) {
        audioRef.current = playAudio(audioUrl, () => {
          autoAdvanceTimer.current = setTimeout(handleAutoAdvance, 1200);
        });
      } else {
        autoAdvanceTimer.current = setTimeout(handleAutoAdvance, Math.max(4000, text.length * 45));
      }
    } catch {
      autoAdvanceTimer.current = setTimeout(handleAutoAdvance, Math.max(4000, (text || '').length * 45));
    }
  }, [chunkIdx, chunks.length]);

  const handleAutoAdvance = useCallback(() => {
    setChunkIdx((prev) => {
      const prevChunk = chunks[prev];
      if (prevChunk) {
        setNotes(n => [...n, extractNote(prevChunk)]);
      }
      if (prev + 1 >= chunks.length) {
        setLectureComplete(true);
        setAvatarState('complete');
        setPlaying(false);
        setSubtitleText('Lecture complete! Take the quiz to test your knowledge.');
        return prev;
      }
      return prev + 1;
    });
  }, [chunks]);

  useEffect(() => {
    if (!loading && currentChunk && playing && !showQPanel) {
      speakChunk(currentChunk);
    }
  }, [chunkIdx, loading]);

  // ── Controls ────────────────────────────────────────────────────────────────

  const handleStart = () => {
    if (!chunks.length) return;
    setChunkIdx(0);
    setPlaying(true);
    speakChunk(chunks[0]);
  };

  const handleNext = () => {
    if (chunkIdx + 1 >= chunks.length) return;
    stopAudio();
    const next = chunkIdx + 1;
    if (currentChunk) setNotes(n => [...n, extractNote(currentChunk)]);
    setChunkIdx(next);
    if (playing) speakChunk(chunks[next]);
  };

  const handlePrev = () => {
    if (chunkIdx === 0) return;
    stopAudio();
    setChunkIdx(chunkIdx - 1);
    if (playing) speakChunk(chunks[chunkIdx - 1]);
  };

  const handlePause = () => {
    stopAudio();
    setPlaying(false);
    setAvatarState('idle');
    setSubtitleVisible(false);
  };

  const handleResume = () => {
    if (!currentChunk) return;
    setPlaying(true);
    speakChunk(currentChunk);
  };

  const handleRaiseHand = () => {
    stopAudio();
    setAvatarState('listening');
    setShowQPanel(true);
  };

  const handleAskQuestion = async (q) => {
    if (!q) return;
    const sid = sessionIdRef.current;
    if (!sid) {
      Toast.show({ type: 'error', text1: 'Session not ready' });
      return;
    }
    setQLoading(true);
    setAvatarState('thinking');
    const newHistory = [...chatHistory, { role: 'user', content: q }];
    setChatHistory(newHistory);
    try {
      const res = await aiTutorAPI.askQuestion(sid, q);
      const answer = res.answer || res.reply || 'I could not process that question.';
      setChatHistory([...newHistory, { role: 'assistant', content: answer }]);
      setAvatarState('speaking');
    } catch {
      Toast.show({ type: 'error', text1: 'Could not connect to AI tutor' });
      setAvatarState('listening');
    } finally {
      setQLoading(false);
    }
  };

  const handleOpenQuiz = async () => {
    if (quiz) { setShowQuiz(true); return; }
    if (!lecture?.id) return;
    setQuizLoading(true);
    try {
      const res = await aiTutorAPI.getQuiz(lecture.id);
      if (res?.quiz) {
        setQuiz(res.quiz);
        setShowQuiz(true);
      } else {
        Toast.show({ type: 'info', text1: 'No quiz available for this lecture' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load quiz' });
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizSubmit = async (answers) => {
    const res = await aiTutorAPI.submitQuiz(lecture.id, answers);
    return res.result || res;
  };

  const handleDismissQuestion = () => {
    setShowQPanel(false);
    if (playing) speakChunk(currentChunk);
    else setAvatarState('idle');
  };

  const handleQuizComplete = (result) => {
    setShowQuiz(false);
    const passed = result?.passed;
    Toast.show({
      type: passed ? 'success' : 'info',
      text1: passed ? `Passed! Score: ${result.score}%` : `Score: ${result.score}% — Keep studying!`,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <ClassroomLoader topic={topicTitle || lecture?.title || 'AI Lecture'} />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Could not load classroom</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadLecture}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sectionTitle = currentChunk?._sectionTitle || sections[0]?.title || '';
  const chunkTitle = currentChunk?.title || '';
  const explanationText = currentChunk?.spoken_explanation || currentChunk?.spokenExplanation || currentChunk?.explanation || '';
  const totalPct = chunks.length > 0 ? Math.round(((chunkIdx + 1) / chunks.length) * 100) : 0;
  const hasQuiz = !!(lecture?.id);

  return (
    <View style={styles.root}>
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { stopAudio(); navigation.goBack(); }} style={styles.topBackBtn}>
          <Icon name="chevron-back" size={22} color="#9ca3af" />
        </TouchableOpacity>

        <View style={styles.topBrand}>
          <View style={styles.topLiveDot} />
          <Text style={styles.topBrandText}>SkillSphere AI</Text>
        </View>

        <Text style={styles.topTopic} numberOfLines={1}>{topicTitle || lecture?.title || ''}</Text>

        <View style={styles.topStats}>
          <Text style={styles.topStatText}>{totalPct}%</Text>
          {hasQuiz && lectureComplete && (
            <TouchableOpacity style={styles.topQuizBtn} onPress={handleOpenQuiz} disabled={quizLoading}>
              {quizLoading
                ? <ActivityIndicator size="small" color="#f59e0b" />
                : <Icon name="help-circle-outline" size={14} color="#f59e0b" />
              }
              <Text style={styles.topQuizBtnText}>Quiz</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Classroom Body ───────────────────────────────────────────────────── */}
      <View style={[styles.body, isWide ? styles.bodyWide : styles.bodyNarrow]}>

        {/* ── LEFT PANEL: Teacher + Progress ─────────────────────────────────── */}
        <View style={[styles.leftPanel, isWide ? styles.leftPanelWide : styles.leftPanelNarrow]}>
          <AITeacherAvatar state={avatarState} size={isWide ? 92 : 60} showLabel />

          {/* Controls */}
          <View style={styles.controlsCard}>
            {!playing && !lectureComplete && (
              <TouchableOpacity style={styles.startBtn} onPress={chunkIdx === 0 ? handleStart : handleResume}>
                <Icon name={chunkIdx === 0 ? 'play' : 'play-skip-forward'} size={16} color="#fff" />
                <Text style={styles.startBtnText}>{chunkIdx === 0 ? 'Start Lecture' : 'Resume'}</Text>
              </TouchableOpacity>
            )}
            {playing && (
              <TouchableOpacity style={styles.pauseBtn} onPress={handlePause}>
                <Icon name="pause" size={15} color="#f59e0b" />
                <Text style={styles.pauseBtnText}>Pause</Text>
              </TouchableOpacity>
            )}

            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, chunkIdx === 0 && styles.navBtnOff]}
                onPress={handlePrev}
                disabled={chunkIdx === 0}
              >
                <Icon name="chevron-back" size={16} color={chunkIdx === 0 ? '#374151' : '#9ca3af'} />
              </TouchableOpacity>
              <Text style={styles.navCount}>{chunkIdx + 1} / {chunks.length}</Text>
              <TouchableOpacity
                style={[styles.navBtn, chunkIdx + 1 >= chunks.length && styles.navBtnOff]}
                onPress={handleNext}
                disabled={chunkIdx + 1 >= chunks.length}
              >
                <Icon name="chevron-forward" size={16} color={chunkIdx + 1 >= chunks.length ? '#374151' : '#9ca3af'} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.handBtn} onPress={handleRaiseHand}>
              <Icon name="hand-left-outline" size={14} color="#f59e0b" />
              <Text style={styles.handBtnText}>Raise Hand</Text>
            </TouchableOpacity>
          </View>

          {/* Progress tracker (wide only) */}
          {isWide && sections.length > 0 && (
            <View style={styles.progressTrackerWrap}>
              <LectureProgressTracker
                sections={sections}
                currentSectionIndex={currentChunk?._sectionIndex ?? 0}
                currentChunkIndex={currentChunk?._chunkIndex ?? 0}
              />
            </View>
          )}

          {lectureComplete && (
            <View style={styles.completeCard}>
              <Text style={styles.completeEmoji}>🎓</Text>
              <Text style={styles.completeText}>Lecture Complete!</Text>
              <Text style={styles.completeNotes}>{notes.length} notes saved</Text>
              {hasQuiz && (
                <TouchableOpacity style={styles.handBtn} onPress={handleOpenQuiz} disabled={quizLoading}>
                  <Icon name="help-circle-outline" size={14} color="#a78bfa" />
                  <Text style={[styles.handBtnText, { color: '#a78bfa' }]}>Take Quiz</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── CENTER PANEL: Content ─────────────────────────────────────────── */}
        <View style={styles.centerPanel}>
          {currentChunk ? (
            <ScrollView
              style={styles.centerScroll}
              contentContainerStyle={styles.centerScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Section pill */}
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>{sectionTitle}</Text>
              </View>

              {/* Chunk title */}
              <Text style={styles.chunkTitle}>{chunkTitle}</Text>

              {/* Learning objective */}
              {(currentChunk.learning_objective || currentChunk.learningObjective) && (
                <View style={styles.objectiveCard}>
                  <Icon name="flag-outline" size={13} color="#60a5fa" />
                  <Text style={styles.objectiveText}>
                    {currentChunk.learning_objective || currentChunk.learningObjective}
                  </Text>
                </View>
              )}

              {/* Main explanation with typing animation */}
              <View style={styles.explanationCard}>
                <TypingText
                  key={typingKey}
                  text={explanationText}
                  style={styles.explanationText}
                  chunkMs={22}
                />
              </View>

              {/* Examples */}
              {(currentChunk.examples || []).length > 0 && (
                <View style={styles.examplesCard}>
                  <Text style={styles.examplesLabel}>Examples</Text>
                  {(currentChunk.examples || []).map((ex, i) => (
                    <View key={i} style={styles.exRow}>
                      <View style={styles.exBullet} />
                      <Text style={styles.exText}>{ex}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Analogy */}
              {(currentChunk.analogy_if_helpful || currentChunk.analogyIfHelpful) && (
                <View style={styles.analogyCard}>
                  <Icon name="bulb-outline" size={14} color="#f59e0b" />
                  <Text style={styles.analogyText}>
                    {currentChunk.analogy_if_helpful || currentChunk.analogyIfHelpful}
                  </Text>
                </View>
              )}

              {/* Checkpoint */}
              {(currentChunk.checkpoint_question_if_any || currentChunk.checkpointQuestion) && (
                <View style={styles.checkpointCard}>
                  <Text style={styles.checkpointLabel}>Checkpoint</Text>
                  <Text style={styles.checkpointText}>
                    {currentChunk.checkpoint_question_if_any || currentChunk.checkpointQuestion}
                  </Text>
                </View>
              )}

              {/* Mobile: whiteboard below content */}
              {!isWide && (
                <View style={styles.mobileWhiteboardWrap}>
                  <ClassroomWhiteboard chunk={currentChunk} style={{ maxHeight: 240 }} />
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.centerEmpty}>
              <Icon name="school-outline" size={48} color="#1e2a4a" />
              <Text style={styles.centerEmptyText}>Press Start Lecture to begin</Text>
            </View>
          )}
        </View>

        {/* ── RIGHT PANEL: Whiteboard / Notes (wide only) ───────────────────── */}
        {isWide && (
          <View style={styles.rightPanel}>
            {/* Tab bar */}
            <View style={styles.rightTabs}>
              {['whiteboard', 'notes'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.rightTab, rightTab === tab && styles.rightTabActive]}
                  onPress={() => setRightTab(tab)}
                >
                  <Icon
                    name={tab === 'whiteboard' ? 'easel-outline' : 'document-text-outline'}
                    size={13}
                    color={rightTab === tab ? '#6C63FF' : 'rgba(255,255,255,0.4)'}
                  />
                  <Text style={[styles.rightTabText, rightTab === tab && styles.rightTabTextActive]}>
                    {tab === 'whiteboard' ? 'Board' : 'Notes'}
                    {tab === 'notes' && notes.length > 0 && (
                      <Text style={styles.rightTabBadge}> {notes.length}</Text>
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab content */}
            <View style={styles.rightContent}>
              {rightTab === 'whiteboard' ? (
                <ClassroomWhiteboard chunk={currentChunk} style={styles.whiteboardFill} />
              ) : (
                <AutoNotes notes={notes} />
              )}
            </View>

            {/* Section progress tracker at bottom */}
            {sections.length > 0 && (
              <View style={styles.rightProgress}>
                <LectureProgressTracker
                  sections={sections}
                  currentSectionIndex={currentChunk?._sectionIndex ?? 0}
                  currentChunkIndex={currentChunk?._chunkIndex ?? 0}
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Bottom progress strip ─────────────────────────────────────────────── */}
      <View style={styles.bottomStrip}>
        <View style={styles.bottomLeft}>
          <Text style={styles.bottomSection} numberOfLines={1}>{sectionTitle}</Text>
          <Text style={styles.bottomChunk} numberOfLines={1}>{chunkTitle}</Text>
        </View>
        <Text style={styles.bottomPct}>{totalPct}%</Text>
        <View style={styles.bottomTrack}>
          <View style={[styles.bottomFill, { width: `${totalPct}%` }]} />
        </View>
      </View>

      {/* ── Subtitle bar ──────────────────────────────────────────────────────── */}
      <SubtitleBar text={subtitleText} visible={subtitleVisible && playing && !showQPanel} color="#6C63FF" />

      {/* ── Question Panel ────────────────────────────────────────────────────── */}
      {showQPanel && (
        <View style={styles.qOverlay}>
          <QuestionPanel
            onAsk={handleAskQuestion}
            onDismiss={handleDismissQuestion}
            loading={qLoading}
            history={chatHistory}
            language={courseLanguage}
          />
        </View>
      )}

      {/* ── Quiz Panel ────────────────────────────────────────────────────────── */}
      {showQuiz && quiz && (
        <ClassroomQuizPanel
          quiz={quiz}
          onSubmit={handleQuizSubmit}
          onClose={() => setShowQuiz(false)}
          onComplete={handleQuizComplete}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GLASS = {
  backgroundColor: 'rgba(10,14,30,0.85)',
  borderWidth: 1,
  borderColor: 'rgba(40,50,80,0.7)',
  ...(Platform.OS === 'web' ? {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } : {}),
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060818',
  },

  // ── Loader ──
  loaderContainer: {
    flex: 1,
    backgroundColor: '#060818',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderCard: {
    ...GLASS,
    borderRadius: 24,
    padding: 44,
    alignItems: 'center',
    gap: 14,
    maxWidth: 380,
    width: '100%',
  },
  loaderAvatarWrap: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  loaderRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#6C63FF',
    borderStyle: 'dashed',
  },
  loaderAvatarCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(108,99,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTitle: {    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  loaderTopic: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loaderSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
  },
  loaderDots: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C63FF',
  },

  // ── Error ──
  errorContainer: {
    flex: 1,
    backgroundColor: '#060818',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  errorMsg: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  backLink: { color: '#6C63FF', fontSize: 13, marginTop: 4 },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(6,8,24,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(40,50,80,0.6)',
    gap: 10,
    zIndex: 10,
  },
  topBackBtn: { padding: 4 },
  topBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  topLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C63FF',
  },
  topBrandText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  demoBadge: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  demoBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topTopic: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    flex: 1,
  },
  topStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topStatText: {
    color: '#6C63FF',
    fontSize: 13,
    fontWeight: '700',
  },
  topQuizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  topQuizBtnText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Body ──
  body: { flex: 1, overflow: 'hidden' },
  bodyWide: { flexDirection: 'row' },
  bodyNarrow: { flexDirection: 'column' },

  // ── Left panel ──
  leftPanel: {
    ...GLASS,
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  leftPanelWide: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: 'rgba(40,50,80,0.5)',
  },
  leftPanelNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(40,50,80,0.5)',
    gap: 10,
  },
  controlsCard: {
    ...GLASS,
    borderRadius: 14,
    padding: 11,
    gap: 7,
    width: '100%',
    alignItems: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
    justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    width: '100%',
    justifyContent: 'center',
  },
  pauseBtnText: { color: '#f59e0b', fontWeight: '600', fontSize: 13 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(40,50,80,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.3 },
  navCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 38,
    textAlign: 'center',
  },
  handBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    width: '100%',
    justifyContent: 'center',
  },
  handBtnText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  progressTrackerWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  completeCard: {
    alignItems: 'center',
    gap: 4,
    padding: 14,
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    width: '100%',
  },
  completeEmoji: { fontSize: 28 },
  completeText: { color: '#10b981', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  completeNotes: { color: 'rgba(16,185,129,0.6)', fontSize: 11 },

  // ── Center panel ──
  centerPanel: {
    flex: 1,
    minWidth: 0,
  },
  centerScroll: { flex: 1 },
  centerScrollContent: { padding: 22, paddingBottom: 60 },
  sectionPill: {
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  sectionPillText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  chunkTitle: {    color: '#f1f5f9',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  objectiveCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderRadius: 9,
    padding: 10,
    marginBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
  },
  objectiveText: {
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontStyle: 'italic',
  },
  explanationCard: {
    backgroundColor: 'rgba(20,28,56,0.6)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(40,50,80,0.6)',
  },
  explanationText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 26,
  },
  examplesCard: {
    borderRadius: 11,
    padding: 14,
    marginBottom: 14,
    gap: 9,
    backgroundColor: 'rgba(108,99,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.18)',
  },
  examplesLabel: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  exRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  exBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6C63FF',
    marginTop: 8,
  },
  exText: { color: '#c4b5fd', fontSize: 13, lineHeight: 21, flex: 1 },
  analogyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 10,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },
  analogyText: {
    color: '#fde68a',
    fontSize: 13,
    lineHeight: 21,
    flex: 1,
    fontStyle: 'italic',
  },
  checkpointCard: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderRadius: 10,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
    gap: 5,
  },
  checkpointLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  checkpointText: { color: '#6ee7b7', fontSize: 13, lineHeight: 21 },
  centerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  centerEmptyText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 15,
    textAlign: 'center',
  },
  mobileWhiteboardWrap: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(40,50,80,0.5)',
  },

  // ── Right panel ──
  rightPanel: {
    width: 268,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(40,50,80,0.5)',
    ...GLASS,
    flexDirection: 'column',
  },
  rightTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(40,50,80,0.5)',
  },
  rightTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  rightTabActive: {
    borderBottomColor: '#6C63FF',
  },
  rightTabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  rightTabTextActive: {
    color: '#6C63FF',
  },
  rightTabBadge: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  rightContent: {
    flex: 1,
    minHeight: 0,
    padding: 8,
  },
  whiteboardFill: { flex: 1 },
  rightProgress: {
    maxHeight: 180,
    borderTopWidth: 1,
    borderTopColor: 'rgba(40,50,80,0.5)',
    padding: 8,
  },

  // ── Bottom strip ──
  bottomStrip: {
    backgroundColor: 'rgba(6,8,24,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(40,50,80,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomLeft: { flex: 1, minWidth: 0 },
  bottomSection: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  bottomChunk: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  bottomPct: { color: '#6C63FF', fontSize: 12, fontWeight: '700', minWidth: 32, textAlign: 'right' },
  bottomTrack: {
    width: 80,
    height: 3,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bottomFill: {
    height: 3,
    backgroundColor: '#6C63FF',
    borderRadius: 2,
  },

  // ── Q Panel ──
  qOverlay: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  qPanel: {
    ...GLASS,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    maxWidth: 580,
    alignSelf: 'center',
    width: '100%',
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  qBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  qTitle: { color: '#fde68a', fontWeight: '700', fontSize: 13 },
  qSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, flex: 1 },
  qClose: { padding: 4, marginLeft: 'auto' },
  qHistory: { maxHeight: 190 },
  qBubble: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    maxWidth: '90%',
  },
  qBubbleUser: {
    backgroundColor: 'rgba(108,99,255,0.2)',
    alignSelf: 'flex-end',
  },
  qBubbleAI: {
    backgroundColor: 'rgba(30,40,60,0.8)',
    alignSelf: 'flex-start',
  },
  qBubbleText: { fontSize: 13, lineHeight: 20 },
  qBubbleTextUser: { color: '#c4b5fd' },
  qBubbleTextAI: { color: '#e2e8f0' },
  qInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  qInput: {
    flex: 1,
    backgroundColor: 'rgba(20,28,56,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(40,50,80,0.8)',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
  },
  qSendBtn: {
    backgroundColor: '#6C63FF',
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qSendBtnDisabled: { opacity: 0.4 },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    paddingVertical: 2,
  },
  resumeBtnText: { color: '#10b981', fontSize: 13, fontWeight: '600' },
});
