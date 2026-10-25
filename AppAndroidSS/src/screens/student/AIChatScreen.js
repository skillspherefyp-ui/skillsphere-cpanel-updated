import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from '../../components/ui/UserAvatar';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import MainLayout from '../../components/ui/MainLayout';
import MarkdownText from '../../components/ui/MarkdownText';
import { useTheme } from '../../context/ThemeContext';
import ThemedView from '../../components/ThemedView';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { aiChatAPI, aiTutorAPI } from '../../services/apiClient';
import { getSidebarItems } from '../../utils/sidebarItems';

const HEADER_HEIGHT = 64;

const SUGGESTED_PROMPTS = [
  { icon: 'book-outline', text: 'Explain a concept from my course' },
  { icon: 'code-slash-outline', text: 'Help me debug my code' },
  { icon: 'document-text-outline', text: 'Summarize research paper' },
  { icon: 'bulb-outline', text: 'Quiz me on a topic' },
];

const AIChatScreen = () => {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isPhone = width < 768;
  const isLarge = width >= 1024;

  const sidebarItems = getSidebarItems(user?.role);

  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(isLarge);
  const [isRecording, setIsRecording] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const [speakLoading, setSpeakLoading] = useState(false);

  // Responsive sidebar width
  const sidebarWidth = isLarge ? 260 : isPhone ? width * 0.78 : 220;

  // Mobile sidebar animation
  const mobileSidebarX = useSharedValue(-sidebarWidth);
  const mobileSidebarBackdrop = useSharedValue(0);

  useEffect(() => {
    if (!isPhone) return;
    mobileSidebarX.value = sidebarOpen
      ? withSpring(0, { damping: 20, stiffness: 130 })
      : withTiming(-sidebarWidth, { duration: 200 });
    mobileSidebarBackdrop.value = sidebarOpen
      ? withTiming(0.7, { duration: 220 })
      : withTiming(0, { duration: 180 });
  }, [sidebarOpen, isPhone, sidebarWidth]);

  const mobileSidebarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: mobileSidebarX.value }],
  }));
  const mobileSidebarBackdropStyle = useAnimatedStyle(() => ({
    opacity: mobileSidebarBackdrop.value,
  }));

  const scrollViewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Scroll to bottom whenever messages change (after React commits the update)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isTyping]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await aiChatAPI.getSessions();
      if (response.success) {
        setSessions(response.sessions || []);
        if (response.sessions && response.sessions.length > 0) {
          loadSession(response.sessions[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (error) {
      setMessages([{
        id: '1',
        content: "Hello! I'm SkillSphere AI, your academic assistant. Ask me anything about your courses, coding, writing, or research.",
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await aiChatAPI.getSession(sessionId);
      if (response.success && response.session) {
        setCurrentSession(response.session);
        const formatted = (response.session.messages || []).map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp || msg.createdAt),
        }));
        setMessages(formatted);
        if (!isLarge) setSidebarOpen(false);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat session' });
    }
  };

  const handleNewChat = async () => {
    try {
      const response = await aiChatAPI.createSession({ title: 'New Chat' });
      if (response.success && response.session) {
        setCurrentSession(response.session);
        const formatted = (response.session.messages || []).map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp || msg.createdAt),
        }));
        setMessages(formatted);
        setSessions(prev => [response.session, ...prev]);
        if (!isLarge) setSidebarOpen(false);
      }
    } catch (error) {
      setMessages([{
        id: '1',
        content: "Hello! I'm SkillSphere AI, your academic assistant. Ask me anything!",
        sender: 'ai',
        timestamp: new Date(),
      }]);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const response = await aiChatAPI.deleteSession(sessionId);
      if (response.success) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        setSessions(remaining);
        if (currentSession?.id === sessionId) {
          if (remaining.length > 0) loadSession(remaining[0].id);
          else handleNewChat();
        }
        Toast.show({ type: 'success', text1: 'Deleted', text2: 'Chat deleted' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete chat' });
    }
  };

  const handleSend = async (text) => {
    const messageText = (text || inputText).trim();
    if (!messageText || sendingMessage) return;
    setInputText('');
    setSendingMessage(true);
    setIsTyping(true);

    const tempMsg = {
      id: `temp-${Date.now()}`,
      content: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempMsg]);

    const scrollToBottom = () =>
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);

    const addErrorMsg = (text) => {
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        { id: `err-${Date.now()}`, content: text, sender: 'ai', timestamp: new Date() },
      ]);
    };

    try {
      if (currentSession?.id) {
        const response = await aiChatAPI.sendMessage(currentSession.id, messageText);
        if (response.success) {
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== tempMsg.id);
            return [
              ...filtered,
              { ...response.userMessage, timestamp: new Date(response.userMessage.timestamp || response.userMessage.createdAt) },
              { ...response.aiMessage, timestamp: new Date(response.aiMessage.timestamp || response.aiMessage.createdAt) },
            ];
          });
          setSessions(prev => prev.map(s =>
            s.id === currentSession.id
              ? { ...s, lastMessageAt: new Date(), title: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : '') }
              : s
          ));
        } else {
          // API returned success: false — show the error message if provided
          addErrorMsg(response.message || response.error || "Something went wrong. Please try again.");
        }
      } else {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            content: "I'm here to help you learn. This is a simulated response.",
            sender: 'ai',
            timestamp: new Date(),
          }]);
          scrollToBottom();
        }, 1000);
      }
    } catch (err) {
      addErrorMsg("I'm having trouble connecting. Please try again.");
    } finally {
      setIsTyping(false);
      setSendingMessage(false);
      scrollToBottom();
    }
  };

  const handleVoiceInput = async () => {
    if (Platform.OS !== 'web') {
      Toast.show({ type: 'info', text1: 'Voice Input', text2: 'Requires a web browser' });
      return;
    }

    // ── Stop recording ──────────────────────────────────────────────
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    // ── Start recording ─────────────────────────────────────────────
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported format (webm is widely supported; fallback to default)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all mic tracks immediately so browser releases the mic indicator
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });

        // Extension must match: Whisper accepts webm, mp4, mp3, wav, etc.
        const extension = (mimeType || 'audio/webm').includes('webm') ? '.webm' : '.mp4';
        const formData = new FormData();
        formData.append('audio', blob, `recording${extension}`);

        try {
          setIsTyping(true);
          const response = await aiTutorAPI.transcribeAudio(formData);
          const text = response?.transcript?.text || response?.transcript;
          if (text && typeof text === 'string' && text.trim()) {
            setInputText(prev => prev + (prev ? ' ' : '') + text.trim());
          } else {
            Toast.show({ type: 'error', text1: 'Transcription failed', text2: 'Could not understand the audio' });
          }
        } catch (err) {
          Toast.show({ type: 'error', text1: 'Transcription Error', text2: err?.message || 'Failed to transcribe audio' });
        } finally {
          setIsTyping(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : 'Could not access microphone';
      Toast.show({ type: 'error', text1: 'Microphone Error', text2: msg });
    }
  };

  const handleSpeakMessage = useCallback(async (msg) => {
    if (playingMsgId === msg.id) {
      setPlayingMsgId(null);
      return;
    }
    setSpeakLoading(true);
    setPlayingMsgId(msg.id);
    try {
      const res = await aiTutorAPI.speakText({ text: msg.content, voice: 'nova' });
      if (res.audioUrl && Platform.OS === 'web') {
        const audio = new Audio(res.audioUrl);
        audio.onended = () => setPlayingMsgId(null);
        audio.onerror = () => setPlayingMsgId(null);
        audio.play();
      } else {
        setPlayingMsgId(null);
      }
    } catch (e) {
      console.error('TTS error:', e.message);
      setPlayingMsgId(null);
    } finally {
      setSpeakLoading(false);
    }
  }, [playingMsgId]);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const now = new Date();
    const days = Math.floor((now - d) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ─── Render helpers ───────────────────────────────────────────────

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
    return (
      <Animated.View
        entering={FadeInDown.duration(250).delay(index * 20)}
        style={[
          styles.msgRow,
          isUser ? styles.msgRowUser : styles.msgRowAI,
        ]}
      >
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
            <MCIcon name="robot" size={17} color={theme.colors.primary} />
          </View>
        )}
        <View style={[
          styles.msgBubble,
          isUser
            ? { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: isDark ? '#2f2f2f' : theme.colors.backgroundSecondary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
        ]}>
          {isUser ? (
            <Text style={[styles.msgText, { color: '#fff' }]}>{item.content || item.text}</Text>
          ) : (
            <>
              <MarkdownText style={{ flex: 1 }} textColor={theme.colors.textPrimary}>
                {item.content || item.text}
              </MarkdownText>
              <TouchableOpacity
                onPress={() => handleSpeakMessage(item)}
                style={{ padding: 4, marginTop: 4, alignSelf: 'flex-end', opacity: speakLoading && playingMsgId === item.id ? 0.5 : 1 }}
              >
                <Icon
                  name={playingMsgId === item.id ? 'volume-high' : 'volume-medium-outline'}
                  size={16}
                  color={theme.colors.textTertiary}
                />
              </TouchableOpacity>
            </>
          )}
          <Text style={[styles.msgTime, { color: isUser ? 'rgba(255,255,255,0.6)' : theme.colors.textTertiary }]}>
            {item.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
          </Text>
        </View>
        {isUser && (
          <UserAvatar user={user} size={32} />
        )}
      </Animated.View>
    );
  };

  const renderTyping = () => {
    if (!isTyping) return null;
    return (
      <Animated.View entering={FadeIn.duration(200)} style={[styles.msgRow, styles.msgRowAI]}>
        <View style={[styles.aiAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
          <MCIcon name="robot" size={17} color={theme.colors.primary} />
        </View>
        <View style={[styles.msgBubble, { backgroundColor: isDark ? '#2f2f2f' : theme.colors.backgroundSecondary, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 16 }]}>
          <View style={styles.typingDots}>
            <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: theme.colors.primary, opacity: 0.6 }]} />
            <View style={[styles.dot, { backgroundColor: theme.colors.primary, opacity: 0.3 }]} />
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={[styles.welcomeIcon, { backgroundColor: theme.colors.primary + '20' }]}>
        <MCIcon name="robot" size={38} color={theme.colors.primary} />
      </View>
      <Text style={[styles.welcomeTitle, { color: theme.colors.textPrimary }]}>
        How can I help you today?
      </Text>
      <Text style={[styles.welcomeSub, { color: theme.colors.textSecondary }]}>
        Ask anything about your courses, coding, research, or studying
      </Text>
      <View style={styles.promptsGrid}>
        {SUGGESTED_PROMPTS.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.promptCard, { backgroundColor: isDark ? '#2f2f2f' : theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => handleSend(p.text)}
          >
            <Icon name={p.icon} size={18} color={theme.colors.primary} />
            <Text style={[styles.promptText, { color: theme.colors.textPrimary }]}>{p.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── Sidebar ──────────────────────────────────────────────────────

  const glassBg = 'rgba(15,15,35,0.96)';

  // Shared content — renders in both desktop (themed) and mobile (glass) variants
  const SidebarContent = ({ glass = false }) => {
    const txtPrimary  = glass ? '#FFFFFF'                 : theme.colors.textPrimary;
    const txtTertiary = glass ? 'rgba(255,255,255,0.35)'  : theme.colors.textTertiary;
    const divider     = glass ? 'rgba(255,255,255,0.1)'   : theme.colors.border;
    const activeRowBg = glass ? 'rgba(255,140,66,0.15)'   : (isDark ? 'rgba(255,255,255,0.08)' : theme.colors.primary + '12');
    const activeTxt   = glass ? '#FF8C42'                 : theme.colors.primary;

    return (
      <View style={{ flex: 1, flexDirection: 'column', minHeight: 0 }}>
        <View style={[styles.sidebarTop, { borderBottomColor: divider }]}>
          <View style={styles.sidebarBrandRow}>
            <MCIcon name="robot" size={18} color="#FF8C42" />
            <Text style={[styles.sidebarBrandText, { color: txtPrimary }]}>SkillSphere AI</Text>
            {glass && (
              <TouchableOpacity style={styles.closeSidebarBtn} onPress={() => setSidebarOpen(false)}>
                <Icon name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
            <Icon name="create-outline" size={15} color="#fff" />
            <Text style={styles.newChatBtnText}>New chat</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sessionsList} showsVerticalScrollIndicator={false}>
          {sessions.length === 0 ? (
            <View style={styles.emptySessionsBox}>
              <Icon name="chatbubbles-outline" size={32} color={txtTertiary} />
              <Text style={[styles.emptySessionsText, { color: txtTertiary }]}>No chats yet</Text>
            </View>
          ) : (
            sessions.map(session => {
              const active = currentSession?.id === session.id;
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.sessionRow, active && { backgroundColor: activeRowBg }]}
                  onPress={() => loadSession(session.id)}
                >
                  <Icon name="chatbubble-outline" size={14} color={active ? activeTxt : txtTertiary} />
                  <Text style={[styles.sessionTitle, { color: active ? activeTxt : txtPrimary }]} numberOfLines={1}>
                    {session.title || 'New Chat'}
                  </Text>
                  <Text style={[styles.sessionDate, { color: txtTertiary }]}>
                    {formatDate(session.lastMessageAt || session.createdAt)}
                  </Text>
                  <TouchableOpacity onPress={() => handleDeleteSession(session.id)} style={styles.deleteBtn}>
                    <Icon name="trash-outline" size={13} color={glass ? 'rgba(255,100,100,0.8)' : theme.colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const renderSidebar = () => (
    <View style={{ width: sidebarWidth, flexDirection: 'row' }}>
      <ThemedView colorKey="background" style={{ flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <SidebarContent glass={false} />
      </ThemedView>
      {isWeb ? (
        <View style={{ width: 2, alignSelf: 'stretch', background: 'linear-gradient(180deg, #FF8C42, #7C6FCD)' }} />
      ) : (
        <LinearGradient
          colors={['#FF8C42', '#7C6FCD']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ width: 2 }}
        />
      )}
    </View>
  );

  // ─── Loading state ────────────────────────────────────────────────

  if (loading) {
    return (
      <MainLayout showSidebar={true} sidebarItems={sidebarItems} activeRoute="AITutor" onNavigate={r => navigation.navigate(r)} showHeader={true}>
        <View style={[styles.loadingBox, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading chats…</Text>
        </View>
      </MainLayout>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────

  const bodyHeight = isWeb ? height - HEADER_HEIGHT : undefined;

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="AITutor"
      onNavigate={r => navigation.navigate(r)}
      showHeader={true}
    >
      {/* Root row — explicit pixel height on web so children never overflow */}
      <View style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          ...(isWeb ? { height: bodyHeight, overflow: 'hidden' } : { flex: 1 }),
        },
      ]}>

        {/* ── Chat history sidebar ── */}
        {isPhone ? (
          /* Phone: animated glass overlay with gradient border */
          <>
            {/* Blurred backdrop */}
            <Animated.View
              style={[styles.backdrop, mobileSidebarBackdropStyle]}
              pointerEvents={sidebarOpen ? 'auto' : 'none'}
            >
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSidebarOpen(false)} />
            </Animated.View>

            {/* Sliding panel */}
            <Animated.View style={[styles.mobileSidebarWrapper, mobileSidebarAnimStyle, { width: sidebarWidth + 4 }]}>
              {isWeb ? (
                /* Web: CSS gradient border */
                <View style={{
                  flex: 1,
                  borderTopRightRadius: 24,
                  borderBottomRightRadius: 24,
                  padding: 2,
                  background: 'linear-gradient(180deg, #FF8C42, #7C6FCD)',
                }}>
                  <View style={[styles.mobileSidebarInner, { backgroundColor: isDark ? theme.colors.background : '#ffffff' }]}>
                    <SidebarContent glass={false} />
                  </View>
                </View>
              ) : (
                /* Native: LinearGradient border */
                <LinearGradient
                  colors={['#FF8C42', '#7C6FCD']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ flex: 1, borderTopRightRadius: 24, borderBottomRightRadius: 24, padding: 2 }}
                >
                  <View style={[styles.mobileSidebarInner, { backgroundColor: isDark ? theme.colors.background : '#ffffff' }]}>
                    <SidebarContent glass={false} />
                  </View>
                </LinearGradient>
              )}
            </Animated.View>
          </>
        ) : (
          /* Tablet / desktop: sidebar pushes content */
          sidebarOpen && renderSidebar()
        )}

        {/* ── Main chat column ── */}
        <View style={[styles.chatColumn, { overflow: 'hidden' }]}>

          {/* Sub-header bar */}
          <View style={[styles.subHeader, {
            backgroundColor: isDark ? theme.colors.card : theme.colors.surface,
            borderBottomColor: theme.colors.border,
          }]}>
            <TouchableOpacity
              style={[styles.sidebarToggle, {
                backgroundColor: sidebarOpen
                  ? theme.colors.primary + '20'
                  : (isDark ? 'rgba(255,255,255,0.08)' : theme.colors.backgroundSecondary),
              }]}
              onPress={() => setSidebarOpen(v => !v)}
            >
              <Icon
                name={sidebarOpen ? 'chevron-back' : 'chatbubbles-outline'}
                size={18}
                color={sidebarOpen ? theme.colors.primary : theme.colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={[styles.subHeaderTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {currentSession?.title || 'SkillSphere AI'}
            </Text>
            <View style={[styles.onlineDot, { backgroundColor: theme.colors.success }]} />
          </View>

          {/* Messages list — ScrollView is reliable on web; flex:1 keeps input pinned */}
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.messagesList,
              messages.length === 0 && styles.messagesListEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0
              ? renderWelcome()
              : messages.map((item, index) => (
                  <React.Fragment key={item.id?.toString() || `msg-${index}`}>
                    {renderMessage({ item, index })}
                  </React.Fragment>
                ))
            }
            {renderTyping()}
          </ScrollView>

          {/* ── Input area — sibling of FlatList, always visible at bottom ── */}
          <View style={[styles.inputArea, {
            backgroundColor: isDark ? theme.colors.background : '#fff',
            borderTopColor: theme.colors.border,
          }]}>
            <View style={[styles.inputBox, {
              backgroundColor: isDark ? '#2f2f2f' : theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
            }]}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.textPrimary }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={isRecording ? 'Listening…' : 'Message SkillSphere AI…'}
                placeholderTextColor={isRecording ? theme.colors.error : theme.colors.textTertiary}
                multiline
                maxLength={1000}
                editable={!isRecording}
                onKeyPress={(e) => {
                  if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                    e.preventDefault?.();
                    if (inputText.trim() && !sendingMessage) handleSend();
                  }
                }}
              />
              <View style={styles.inputBtns}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleVoiceInput}>
                  <Icon
                    name={isRecording ? 'stop-circle' : 'mic-outline'}
                    size={22}
                    color={isRecording ? theme.colors.error : theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, {
                    backgroundColor: inputText.trim() && !sendingMessage ? theme.colors.primary : (isDark ? '#444' : '#d4d4d4'),
                  }]}
                  onPress={() => handleSend()}
                  disabled={!inputText.trim() || sendingMessage}
                >
                  {sendingMessage
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Icon name="arrow-up" size={18} color={inputText.trim() ? '#fff' : (isDark ? '#888' : '#aaa')} />
                  }
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.disclaimer, { color: theme.colors.textTertiary }]}>
              SkillSphere AI can make mistakes — verify important information.
            </Text>
          </View>

        </View>
      </View>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14 },

  // Root row
  root: {
    flexDirection: 'row',
  },

  // ── Sidebar ──
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  mobileSidebarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 11,
  },
  mobileSidebarInner: {
    flex: 1,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  sidebar: {
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  sidebarTop: {
    padding: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sidebarBrandText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  closeSidebarBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FF8C42',
  },
  newChatBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionsList: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  sessionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  sessionDate: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 4,
  },
  emptySessionsBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptySessionsText: {
    fontSize: 13,
  },

  // ── Chat column ──
  chatColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  sidebarToggle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Messages ──
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messagesListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    gap: 10,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAI: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  msgBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
  },
  msgTime: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Welcome ──
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 12,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeTitle: {    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 21,
  },
  promptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 16,
    maxWidth: 600,
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    flex: 1,
  },
  promptText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // ── Input area ──
  inputArea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  inputBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 24,
  },
  inputBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
  },
});

export default AIChatScreen;
