import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
  Animated as RNAnimated,
  FlatList,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import MainLayout from '../../components/ui/MainLayout';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { lectureChatAPI } from '../../services/apiClient';
import { resolveFileUrl, slugify } from '../../utils/urlHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSidebarItems } from '../../utils/sidebarItems';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ── Ask Question panel — exact AILearningScreen design ────────────────────────
const QA_ThinkingIndicator = ({ accent = '#f59e0b' }) => {
  const ring1 = React.useRef(new RNAnimated.Value(0)).current;
  const ring2 = React.useRef(new RNAnimated.Value(0)).current;
  const spin  = React.useRef(new RNAnimated.Value(0)).current;
  const float = React.useRef(new RNAnimated.Value(0)).current;
  const dot0  = React.useRef(new RNAnimated.Value(0)).current;
  const dot1  = React.useRef(new RNAnimated.Value(0)).current;
  const dot2  = React.useRef(new RNAnimated.Value(0)).current;

  React.useEffect(() => {
    const halo = (val) => RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(val, { toValue: 1, duration: 2000, useNativeDriver: USE_NATIVE_DRIVER }),
      RNAnimated.timing(val, { toValue: 0, duration: 0,    useNativeDriver: USE_NATIVE_DRIVER }),
    ]));
    const bounce = (val, delay) => RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.delay(delay),
      RNAnimated.timing(val, { toValue: 1, duration: 380, useNativeDriver: USE_NATIVE_DRIVER }),
      RNAnimated.timing(val, { toValue: 0, duration: 380, useNativeDriver: USE_NATIVE_DRIVER }),
      RNAnimated.delay(760 - delay),
    ]));
    const all = [
      halo(ring1),
      RNAnimated.sequence([RNAnimated.delay(1000), halo(ring2)]),
      RNAnimated.loop(RNAnimated.timing(spin,  { toValue: 1, duration: 3200, useNativeDriver: USE_NATIVE_DRIVER })),
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(float, { toValue: 1, duration: 1300, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(float, { toValue: 0, duration: 1300, useNativeDriver: USE_NATIVE_DRIVER }),
      ])),
      bounce(dot0, 0), bounce(dot1, 190), bounce(dot2, 380),
    ];
    all.forEach((a) => a.start());
    return () => all.forEach((a) => a.stop());
  }, []);

  const haloSt = (val) => ({
    borderColor: accent,
    opacity: val.interpolate({ inputRange: [0,1], outputRange: [0.5,0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0,1], outputRange: [0.6,1.9] }) }],
  });
  const dotSt = (val) => ({
    backgroundColor: accent,
    opacity: val.interpolate({ inputRange: [0,1], outputRange: [0.35,1] }),
    transform: [{ translateY: val.interpolate({ inputRange: [0,1], outputRange: [0,-6] }) }],
  });

  return (
    <View style={qStyles.thinkWrap}>
      <View style={qStyles.thinkOrb}>
        <RNAnimated.View style={[qStyles.thinkHalo, haloSt(ring1)]} />
        <RNAnimated.View style={[qStyles.thinkHalo, haloSt(ring2)]} />
        <View style={[qStyles.thinkGlow, { backgroundColor: `${accent}22` }]} />
        <RNAnimated.View style={[qStyles.thinkArc, { borderTopColor: accent,
          transform: [{ rotate: spin.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] }) }] }]} />
        <RNAnimated.View style={{ transform: [{ translateY: float.interpolate({ inputRange:[0,1], outputRange:[3,-3] }) }] }}>
          <MaterialIcon name="brain" size={28} color={accent} />
        </RNAnimated.View>
      </View>
      <View style={qStyles.thinkLabelRow}>
        <Text style={[qStyles.thinkLabel, { color: accent }]}>Let me think about that…</Text>
        <View style={qStyles.thinkDots}>
          <RNAnimated.View style={[qStyles.thinkDot, dotSt(dot0)]} />
          <RNAnimated.View style={[qStyles.thinkDot, dotSt(dot1)]} />
          <RNAnimated.View style={[qStyles.thinkDot, dotSt(dot2)]} />
        </View>
      </View>
    </View>
  );
};

const parseAnswerBlocks = (md) => {
  const text = `${md || ''}`.trim();
  if (!text) return [];
  const blocks = [];
  const codeRe = /```(\w+)?\n?([\s\S]*?)```/g;
  let last = 0, m;
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

const renderAnswerBlock = (block, index) => {
  if (block.type === 'code') {
    const lines = `${block.code || ''}`.split(/\r?\n/);
    return (
      <View key={index} style={[qStyles.terminalWrap, { marginVertical: 6 }]}>
        <View style={qStyles.terminalBar}>
          <View style={[qStyles.terminalDot, { backgroundColor: '#ff5f57' }]} />
          <View style={[qStyles.terminalDot, { backgroundColor: '#febc2e' }]} />
          <View style={[qStyles.terminalDot, { backgroundColor: '#28c840' }]} />
          <Text style={qStyles.terminalLangLabel}>{block.lang}</Text>
        </View>
        <View style={qStyles.terminalBody}>
          {lines.map((line, li) => (
            <View key={li} style={qStyles.terminalLine}>
              <Text style={qStyles.terminalLineNum}>{li + 1}</Text>
              <Text style={qStyles.terminalLineCode}>{line || ' '}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (block.type === 'bullets') {
    return (
      <View key={index} style={[qStyles.chalkNoteBlock, { marginVertical: 6 }]}>
        {block.items.map((it, bi) => (
          <View key={bi} style={qStyles.chalkBulletRow}>
            <Text style={qStyles.chalkBulletArrow}>▸</Text>
            <Text style={qStyles.chalkBulletText}>{it}</Text>
          </View>
        ))}
      </View>
    );
  }
  return <Text key={index} style={qStyles.qaAnswerText}>{block.text}</Text>;
};

// ─── Phase status visual (listening / transcribing / speaking) ────────────────
const QA_PhaseVisual = ({ phase, isListening }) => {
  const accent = '#f59e0b';
  const innerPulse = React.useRef(new RNAnimated.Value(1)).current;
  const outerPulse = React.useRef(new RNAnimated.Value(1)).current;
  const waveAnims  = React.useRef(Array.from({ length: 10 }, () => new RNAnimated.Value(8))).current;
  const timers     = React.useRef([]);

  React.useEffect(() => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
    innerPulse.stopAnimation(); innerPulse.setValue(1);
    outerPulse.stopAnimation(); outerPulse.setValue(0);

    if (isListening) {
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(innerPulse, { toValue: 1.18, duration: 550, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(innerPulse, { toValue: 1,    duration: 550, useNativeDriver: USE_NATIVE_DRIVER }),
      ])).start();
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(outerPulse, { toValue: 1,  duration: 0,   useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(outerPulse, { toValue: 0,  duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(outerPulse, { toValue: 1,  duration: 0,   useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.delay(300),
      ])).start();
    }
    return () => { timers.current.forEach(t => clearTimeout(t)); timers.current = []; };
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
  return null;
};

function ManualQuestionPanel({ onAsk, onDismiss, loading, history, language, studentName, windowHeight }) {
  const isMobile = Platform.OS !== 'web';
  const [phase, setPhase] = React.useState('composing'); // 'composing' | 'thinking' | 'done'
  const [qaInput, setQaInput] = React.useState('');
  const [qaListening, setQaListening] = React.useState(false);
  const [greeting, setGreeting] = React.useState('');
  const [currentQuestion, setCurrentQuestion] = React.useState('');
  const recognitionRef = React.useRef(null);
  const prevLoadingRef = React.useRef(false);

  React.useEffect(() => {
    const name = `${studentName || ''}`.trim().split(' ')[0] || '';
    const isUrdu = language === 'Urdu';
    const g = isUrdu
      ? `${name ? name + '،' : ''} آپ کا کیا سوال ہے؟ میں نے لیکچر روک دیا ہے۔`
      : `Hello${name ? ' ' + name : ''}, what's your question?`;
    setGreeting(g);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(g);
        u.lang = isUrdu ? 'ur-PK' : 'en-US';
        u.rate = 1.0;
        window.speechSynthesis.speak(u);
      } catch (_) {}
    }
    return () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [studentName, language]);

  React.useEffect(() => {
    if (prevLoadingRef.current && !loading && phase === 'thinking') setPhase('done');
    prevLoadingRef.current = loading;
  }, [loading]);

  React.useEffect(() => { return () => { recognitionRef.current?.abort(); }; }, []);

  const handleQaMic = () => {
    if (Platform.OS !== 'web') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (qaListening) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = language === 'Urdu' ? 'ur-PK' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setQaListening(true);
    rec.onend   = () => setQaListening(false);
    rec.onerror = () => setQaListening(false);
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setQaInput(prev => (prev.trim() ? prev + ' ' + t : t));
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const finishAndSubmit = () => {
    const q = `${qaInput || ''}`.trim();
    if (!q && !qaListening) return;
    if (qaListening) { recognitionRef.current?.stop(); }
    if (q) submitQuestion(q);
  };

  const submitQuestion = (q) => {
    if (!q?.trim()) return;
    setCurrentQuestion(q.trim());
    setPhase('thinking');
    setQaInput('');
    setQaListening(false);
    onAsk(q.trim());
  };

  const resetToComposing = () => {
    setCurrentQuestion('');
    setQaInput('');
    setPhase('composing');
  };

  const accent = '#f59e0b';
  const phaseLabel = {
    composing: qaListening ? '● Listening… speak now' : 'Your turn',
    thinking:  'Thinking…',
    done:      'Answered',
  }[phase] || '';

  const qaAvatarState = phase === 'thinking'
    ? 'thinking'
    : phase === 'done' ? 'complete'
    : qaListening ? 'listening'
    : 'idle';

  const latestAnswer = history.length > 0 && history[history.length - 1].role === 'assistant'
    ? history[history.length - 1].content : '';
  const blocks = phase === 'done' ? parseAnswerBlocks(latestAnswer) : [];


  // cardContent is now just the scrollable area (no wrapper card View)
  const cardContent = (
    <ScrollView
      style={{ height: windowHeight - 70, backgroundColor: '#0d0f1f' }}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={qStyles.qaHeader}>
        <View style={qStyles.qaHeaderLeft}>
          <View style={qStyles.qaSSBrand}><MaterialIcon name="robot" size={22} color="#FF8C42" /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={qStyles.qaHeaderTitle}>SkillSphere AI</Text>
            <Text style={qStyles.qaHeaderSub}>Your AI Learning Companion</Text>
          </View>
          <View style={[qStyles.qaPhasePill, { borderColor: `${accent}66`, backgroundColor: `${accent}1f` }]}>
            <View style={[qStyles.qaPhaseDot, { backgroundColor: accent }]} />
            <Text style={[qStyles.qaPhaseText, { color: accent }]}>{phaseLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDismiss} style={qStyles.qaClose} accessibilityLabel="Resume lecture">
          <Icon name="close" size={18} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      {!!currentQuestion && (
        <View style={[qStyles.qaQuestionChip, { borderColor: `${accent}44` }]}>
          <Text style={[qStyles.qaQuestionLabel, { color: accent }]}>YOU ASKED</Text>
          <Text style={qStyles.qaQuestionText}>{currentQuestion}</Text>
        </View>
      )}

      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 12 }}>
        {phase === 'composing' && (
          <View style={{ gap: 16 }}>
            {!!greeting && !qaListening && <Text style={qStyles.qaGreetingText}>{greeting}</Text>}
            <QA_PhaseVisual phase={phase} isListening={qaListening} />
            {!qaListening && (
              <>
                <Text style={qStyles.qaPrompt}>Tap the mic and speak, or type your question below — then press ✓.</Text>
                <View>
                  <Text style={qStyles.qaChipsHint}>QUICK ASKS</Text>
                  <View style={qStyles.qaChipsRow}>
                    {[
                      { icon: 'bulb-outline',        label: 'Give an example',   ask: 'Give a simple real-world example of this.' },
                      { icon: 'git-network-outline', label: 'Draw a diagram',    ask: 'Draw a simple diagram to explain how this works.' },
                      { icon: 'color-wand-outline',  label: 'Explain it simply', ask: 'Explain this in the simplest way possible.' },
                      { icon: 'code-slash-outline',  label: 'Show me in code',   ask: 'Show me a small code example for this.' },
                    ].map((c) => (
                      <TouchableOpacity key={c.label} style={qStyles.qaChip} onPress={() => submitQuestion(c.ask)} activeOpacity={0.75}>
                        <Icon name={c.icon} size={14} color="#fbbf24" />
                        <Text style={qStyles.qaChipText}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        )}
        {phase === 'thinking' && <QA_ThinkingIndicator accent={accent} />}
        {phase === 'done' && !!latestAnswer && (
          <View style={qStyles.qaAnswerContainer}>
            {blocks.map((b, i) => renderAnswerBlock(b, i))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const footerJSX = (
    <View style={[qStyles.qaFooter, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
      {phase === 'composing' ? (
        <>
          <TouchableOpacity
            onPress={handleQaMic}
            style={[qStyles.qaMic, qaListening
              ? { backgroundColor: '#ef4444', borderColor: '#ef4444' }
              : { borderColor: `${accent}66` }
            ]}
            accessibilityLabel={qaListening ? 'Stop recording' : 'Speak your question'}
          >
            <Icon name={qaListening ? 'stop' : 'mic-outline'} size={18} color={qaListening ? '#fff' : accent} />
          </TouchableOpacity>
          <TextInput
            style={qStyles.qaInputField}
            value={qaInput}
            onChangeText={setQaInput}
            placeholder={qaListening ? 'Listening… speak now, then tap ✓' : 'Speak (mic) or type your question…'}
            placeholderTextColor="#64748b"
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
            style={[qStyles.qaTickBtn, { opacity: (qaListening || qaInput.trim()) ? 1 : 0.4 }]}
            accessibilityLabel="Submit question"
          >
            <Icon name="checkmark" size={22} color="#04110b" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={resetToComposing} style={qStyles.qaSecondaryBtn}>
            <Icon name="add" size={16} color="#cbd5e1" />
            <Text style={qStyles.qaSecondaryText}>Ask another</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={qStyles.qaResumeBtn}>
            <Icon name="play-skip-forward" size={16} color="#fff" />
            <Text style={qStyles.qaResumeText}>{phase === 'thinking' ? 'Skip — Resume' : 'Resume lecture'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <Modal visible transparent animationType={isMobile ? 'slide' : 'fade'} onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, {
        backgroundColor: isMobile ? '#0d0f1f' : 'rgba(5,7,18,0.88)',
        ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } : {}),
      }]}>
        {cardContent}
        {footerJSX}
      </View>
    </Modal>
  );
}

const qStyles = StyleSheet.create({
  qaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,7,18,0.80)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } : {}),
  },
  qaCard: {
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
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
      backgroundSize: '24px 24px',
      boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
    } : {}),
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
  qaQuestionChip: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(245,158,11,0.08)' },
  qaQuestionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  qaQuestionText: { color: '#f1f5f9', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  qaBody: { minHeight: 0, paddingHorizontal: 20, paddingTop: 10 },
  qaAnswerScroll: { paddingBottom: 16, gap: 12, alignItems: 'stretch' },
  qaPrompt: { color: '#94a3b8', fontSize: 16, lineHeight: 26, fontStyle: 'italic' },
  qaGreetingText: { color: '#f8fafc', fontSize: 22, lineHeight: 30, fontWeight: '700' },
  qaListeningRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  qaListeningPulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  qaListeningText: { flex: 1, color: '#fecaca', fontSize: 15, fontWeight: '600' },
  qaChipsHint: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  qaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) },
  qaChipText: { color: '#fde68a', fontSize: 13, fontWeight: '700' },
  qaAnswerContainer: { width: '100%', borderLeftWidth: 3, borderLeftColor: 'rgba(245,158,11,0.6)', paddingLeft: 16, gap: 6 },
  qaAnswerText: { color: '#f1f5f9', fontSize: 18, lineHeight: 29, fontWeight: '400', marginVertical: 4 },
  qaFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', backgroundColor: '#080c1a' },
  qaMic: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  qaInputField: { flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: '#f1f5f9', fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  qaTickBtn: { backgroundColor: '#34d399', borderRadius: 12, width: 48, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qaSecondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  qaSecondaryText: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  qaResumeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 12 },
  qaResumeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  terminalWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#0d1117', width: '100%', maxWidth: 820, alignSelf: 'center' },
  terminalBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1c1f26', paddingHorizontal: 14, paddingVertical: 10 },
  terminalDot: { width: 12, height: 12, borderRadius: 6 },
  terminalLangLabel: { color: '#6b7280', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  terminalBody: { padding: 14, gap: 2 },
  terminalLine: { flexDirection: 'row', gap: 12 },
  terminalLineNum: { color: '#4b5563', fontSize: 13, lineHeight: 22, width: 24, textAlign: 'right', fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier', flexShrink: 0 },
  terminalLineCode: { flex: 1, color: '#e5e7eb', fontSize: 15, lineHeight: 24, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier' },
  chalkNoteBlock: { gap: 12, maxWidth: 780, alignSelf: 'center' },
  chalkBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  chalkBulletArrow: { color: '#60a5fa', fontSize: 20, lineHeight: 30, fontWeight: '700', flexShrink: 0 },
  chalkBulletText: { flex: 1, color: '#f1f5f9', fontSize: 19, lineHeight: 30, fontWeight: '500' },
  thinkWrap: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 26, width: '100%' },
  thinkOrb: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  thinkHalo: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2 },
  thinkGlow: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  thinkArc: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: 'transparent' },
  thinkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  thinkLabel: { fontSize: 15, fontStyle: 'italic', fontWeight: '700' },
  thinkDots: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 10, paddingBottom: 2 },
  thinkDot: { width: 6, height: 6, borderRadius: 3 },
});

const LearningScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const sidebarItems = getSidebarItems(user?.role);
  const handleNavigate = (routeName) => {
    if (routeName === 'CertificateVerify') {
      navigation.navigate(routeName, { fromStudent: true });
    } else {
      navigation.navigate(routeName);
    }
  };
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { courseId, topicId } = route.params;
  const { courses, checkEnrollment, fetchCourses, enrollments, fetchMyEnrollments, updateTopicProgress, getCourseById } = useData();
  const [localCourse, setLocalCourse] = useState(null);
  const course = courses.find(c => c.id === courseId) || localCourse;
  const topic = course?.topics?.find(t => t.id === topicId);

  const isManualMode = course?.creationMode === 'manual';
  const topicMaterials = topic?.materials || [];

  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // 'topics' | 'notes' | null
  const [studentNotes, setStudentNotes] = useState('');
  const [notesSavedAt, setNotesSavedAt] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showQPanel, setShowQPanel] = useState(false);
  const [qLoading, setQLoading] = useState(false);
  const [qHistory, setQHistory] = useState([]);

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(true);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState("Welcome to today's lesson on Machine Learning fundamentals.");
  // Real enrollment progress
  const enrollmentProgress = (() => {
    const e = enrollments.find(en => String(en.courseId) === String(courseId) || String(en.course?.id) === String(courseId));
    return Math.round(e?.progress ?? 0);
  })();

  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const autoNavDone = useRef(false);

  const isWeb = Platform.OS === 'web';
  const isLargeScreen = windowWidth >= 1024;
  const isMobile = windowWidth < 768;

  // Pulse animation for AI avatar
  useEffect(() => {
    if (aiSpeaking) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [aiSpeaking]);

  useEffect(() => {
    checkEnrollmentStatus();
    fetchCourses(); // refresh so topic completion state is current
  }, [courseId]);

  // If this course is not in DataContext (e.g. beyond page-1 limit), fetch it individually.
  useEffect(() => {
    if (!courses.find(c => c.id === courseId) && courseId) {
      getCourseById(courseId).then(res => {
        if (res.success && res.course) setLocalCourse(res.course);
      });
    }
  }, [courseId]);

  // Auto-navigate to first non-completed topic — skip if user is revisiting a completed one
  useEffect(() => {
    if (autoNavDone.current || !course?.topics?.length) return;
    autoNavDone.current = true;
    const currentTopic = course.topics.find(t => String(t.id) === String(topicId));
    // User intentionally opened a completed topic — don't redirect
    if (currentTopic?.completed) return;
    const sorted = [...course.topics].sort((a, b) => a.order - b.order);
    const firstNonCompleted = sorted.find(t => !t.completed) || sorted[0];
    if (String(firstNonCompleted.id) !== String(topicId)) {
      navigation.replace('Learning', { courseId, topicId: firstNonCompleted.id, topics: course.topics });
    }
  }, [course?.topics]);

  // Redirect AI courses to the real AI lecture screen once enrollment is confirmed
  useEffect(() => {
    if (!enrollmentLoading && isEnrolled && course && !isManualMode) {
      navigation.replace('AILearning', { courseId, topicId });
    }
  }, [enrollmentLoading, isEnrolled, isManualMode, course]);

  useEffect(() => {
    if (isManualMode && topicMaterials.length > 0) {
      setSelectedMaterial(topicMaterials[0]);
    } else {
      setSelectedMaterial(null);
    }
  }, [topicId, isManualMode]);

  const notesKey = user?.id && topicId ? `@skillsphere:notes:${user.id}:${topicId}` : null;

  useEffect(() => {
    if (!notesKey) return;
    AsyncStorage.getItem(notesKey).then(saved => { if (saved) setStudentNotes(saved); });
  }, [notesKey]);

  const saveStudentNotes = async () => {
    if (!notesKey) return;
    setSavingNotes(true);
    try {
      await AsyncStorage.setItem(notesKey, studentNotes);
      setNotesSavedAt(new Date());
      Toast.show({ type: 'success', text1: 'Notes Saved' });
    } catch {
      Toast.show({ type: 'error', text1: 'Save Failed' });
    } finally {
      setSavingNotes(false);
    }
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
    const topicTitle = topic?.title || 'Topic';
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

  const checkEnrollmentStatus = async () => {
    setEnrollmentLoading(true);
    const result = await checkEnrollment(courseId);
    if (result.success) {
      setIsEnrolled(result.enrolled);
      if (!result.enrolled) {
        Toast.show({
          type: 'error',
          text1: 'Not Enrolled',
          text2: 'You need to enroll in this course first!',
        });
        navigation.navigate('CourseDetail', { courseId, courseName: slugify(course?.name) });
      }
    }
    setEnrollmentLoading(false);
  };

  // Topic item for course progress sidebar
  const TopicItem = ({ item, index }) => {
    const isCompleted = item.completed;
    const isCurrent = String(item.id) === String(topicId);
    const isLocked = item.status === 'locked' && !item.completed;
    const topicProgress = isCurrent ? enrollmentProgress : 0;

    return (
      <TouchableOpacity
        style={[
          styles.topicItem,
          isCurrent && styles.topicItemCurrent,
          { backgroundColor: isCurrent ? 'rgba(79, 70, 229, 0.1)' : 'transparent' }
        ]}
        onPress={() => {
          if (!isLocked) {
            setActivePanel(null);
            navigation.replace('Learning', { courseId, topicId: item.id });
          }
        }}
        disabled={isLocked}
      >
        <View style={styles.topicIcon}>
          {isCompleted ? (
            <View style={[styles.topicStatusIcon, { backgroundColor: '#10B981' }]}>
              <Icon name="checkmark" size={14} color="#fff" />
            </View>
          ) : isCurrent ? (
            <View style={[styles.topicStatusIcon, { backgroundColor: theme.colors.primary }]}>
              <Icon name="play" size={12} color="#fff" />
            </View>
          ) : (
            <View style={[styles.topicStatusIcon, { backgroundColor: '#6B7280' }]}>
              <Icon name="lock-closed" size={12} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.topicInfo}>
          <Text style={[styles.topicTitle, { color: isLocked ? theme.colors.textTertiary : theme.colors.textPrimary }]}>
            {item.title}
          </Text>
          <View style={styles.topicMeta}>
            <Text style={[styles.topicDuration, { color: theme.colors.textTertiary }]}>
              {item.duration || '15 min'}
            </Text>
            {isCompleted && (
              <Text style={[styles.topicStatus, { color: '#10B981' }]}>Completed</Text>
            )}
            {isCurrent && (
              <Text style={[styles.topicStatus, { color: theme.colors.primary }]}>{topicProgress}%</Text>
            )}
            {isLocked && (
              <Text style={[styles.topicStatus, { color: theme.colors.textTertiary }]}>Locked</Text>
            )}
          </View>
          {isCurrent && (
            <View style={styles.topicProgressBar}>
              <View style={[styles.topicProgressFill, { width: `${topicProgress}%`, backgroundColor: theme.colors.primary }]} />
            </View>
          )}
        </View>
        <Icon name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  // Topics Sidebar Content
  const renderTopicsSidebar = () => (
    <View style={styles.topicsSidebarContent}>
      <View style={styles.sidebarHeader}>
        <View style={styles.sidebarHeaderIcon}>
          <MaterialIcon name="book-open-variant" size={20} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sidebarTitle, { color: theme.colors.textPrimary }]}>Course Progress</Text>
          <Text style={[styles.sidebarSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>{course?.name}</Text>
        </View>
      </View>

      <View style={styles.sidebarProgress}>
        <Text style={[styles.sidebarProgressText, { color: theme.colors.textSecondary }]}>
          {course?.topics?.filter(t => t.completed).length || 0} of {course?.topics?.length || 0} topics
        </Text>
        <Text style={[styles.sidebarProgressPercent, { color: theme.colors.primary }]}>
          {Math.round(((course?.topics?.filter(t => t.completed).length || 0) / (course?.topics?.length || 1)) * 100)}%
        </Text>
      </View>
      <View style={[styles.sidebarProgressBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : theme.colors.border }]}>
        <View
          style={[
            styles.sidebarProgressFill,
            {
              width: `${((course?.topics?.filter(t => t.completed).length || 0) / (course?.topics?.length || 1)) * 100}%`,
              backgroundColor: theme.colors.primary
            }
          ]}
        />
      </View>

      <ScrollView style={styles.topicsList} showsVerticalScrollIndicator={false}>
        {course?.topics?.map((item, index) => (
          <TopicItem key={item.id} item={item} index={index} />
        ))}
      </ScrollView>
    </View>
  );

  if (!course || !topic) {
    return (
      <MainLayout
        showSidebar={false}
        showHeader={true}
        showBack={true}
      >
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Topic not found"
            subtitle="The topic you're looking for doesn't exist"
          />
        </View>
      </MainLayout>
    );
  }

  if (enrollmentLoading) {
    return (
      <MainLayout
        showSidebar={false}
        showHeader={true}
        showBack={true}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Checking enrollment...
          </Text>
        </View>
      </MainLayout>
    );
  }

  if (!isEnrolled) {
    return (
      <MainLayout
        showSidebar={false}
        showHeader={true}
        showBack={true}
      >
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Not Enrolled"
            subtitle="You need to enroll in this course to access lectures"
          />
        </View>
      </MainLayout>
    );
  }

  const togglePanel = (panel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const handleAskQuestion = async (q) => {
    if (!q) return;
    const newHistory = [...qHistory, { role: 'user', content: q }];
    setQHistory(newHistory);
    setQLoading(true);
    try {
      const res = await lectureChatAPI.sendMessage(courseId, topicId, q);
      const answer = res.aiMessage?.content || res.reply || 'I could not process that question.';
      setQHistory([...newHistory, { role: 'assistant', content: answer }]);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to get answer' });
    } finally {
      setQLoading(false);
    }
  };

  const handleOpenAsk = () => setShowQPanel(true);
  const handleDismissAsk = () => setShowQPanel(false);

  const handleCompleteTopic = () => {
    setShowCompleteDialog(true);
  };

  const confirmCompleteTopic = async () => {
    setShowCompleteDialog(false);
    const result = await updateTopicProgress({
      courseId,
      topicId,
      completed: true,
    });

    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: result.error || 'Failed to update topic progress',
      });
      return;
    }

    await Promise.all([fetchCourses(), fetchMyEnrollments()]);

    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: 'Topic completed!',
    });

    setTimeout(() => navigation.goBack(), 1200);
  };

  // ─── Manual-mode helpers ──────────────────────────────────────────────────

  const getYouTubeEmbedUrl = (url) => {
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=0&rel=0`;
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=0&rel=0`;
    return url;
  };

  const isYouTubeUrl = (url = '') =>
    url.includes('youtube.com') || url.includes('youtu.be');

  const isGoogleUrl = (url = '') =>
    url.includes('drive.google.com') || url.includes('docs.google.com');

  const getGoogleEmbedUrl = (url) => {
    // drive.google.com/file/d/ID/view → .../preview
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
    if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    // docs/sheets/slides: replace /edit or /view with /preview
    if (url.includes('docs.google.com')) {
      return url.replace(/\/(edit|view|pub)(\?.*)?$/, '/preview');
    }
    return url;
  };

  const getLinkMeta = (url = '') => {
    if (isYouTubeUrl(url))                           return { label: 'YouTube',      icon: 'logo-youtube',  color: '#FF0000' };
    if (url.includes('drive.google.com'))             return { label: 'Google Drive', icon: 'logo-google',   color: '#4285F4' };
    if (url.includes('docs.google.com/spreadsheets')) return { label: 'Google Sheets',icon: 'logo-google',   color: '#0F9D58' };
    if (url.includes('docs.google.com/presentation'))return { label: 'Google Slides',icon: 'logo-google',   color: '#F4B400' };
    if (url.includes('docs.google.com'))              return { label: 'Google Docs',  icon: 'logo-google',   color: '#4285F4' };
    if (url.includes('vimeo.com'))                    return { label: 'Vimeo',         icon: 'videocam',      color: '#1AB7EA' };
    if (url.includes('github.com'))                   return { label: 'GitHub',        icon: 'logo-github',   color: '#24292e' };
    if (url.includes('figma.com'))                    return { label: 'Figma',         icon: 'color-palette', color: '#F24E1E' };
    return { label: 'Link', icon: 'link', color: '#6366f1' };
  };

  const getEmbedUrl = (url) => {
    if (isYouTubeUrl(url)) return getYouTubeEmbedUrl(url);
    if (isGoogleUrl(url))  return getGoogleEmbedUrl(url);
    return url;
  };

  const openMaterial = (material) => {
    const url = resolveFileUrl(material.uri);
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const getMaterialIcon = (type) => {
    if (type === 'pdf') return 'document-text';
    if (type === 'image') return 'image';
    if (type === 'link') return 'link';
    return 'document';
  };

  const getMaterialColor = (type) =>
    type === 'link' ? '#6366f1' : theme.colors.primary;

  const renderMaterialViewer = (material) => {
    if (!material) {
      return (
        <View style={styles.viewerEmpty}>
          <Icon name="folder-open-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.viewerEmptyText}>No materials added to this topic yet</Text>
        </View>
      );
    }

    const resolvedUri = resolveFileUrl(material.uri);
    const isYT = material.isYoutube || isYouTubeUrl(material.uri);

    if (material.type === 'link') {
      const meta = getLinkMeta(material.uri);
      const embedUrl = getEmbedUrl(material.uri);

      if (Platform.OS === 'web') {
        const iframeH = isMobile ? Math.round(windowHeight * 0.38) : '100%';
        return (
          <View style={styles.embeddedLinkWrapper}>
            <View style={[styles.iframeWrapper, isMobile && { minHeight: Math.round(windowHeight * 0.38) }]}>
              <iframe
                src={embedUrl}
                title={material.title || meta.label}
                style={{ width: '100%', height: iframeH, border: 'none', borderRadius: 8, display: 'block' }}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </View>
            <TouchableOpacity
              style={[styles.openExternalBtn, { borderColor: meta.color + '50' }]}
              onPress={() => openMaterial(material)}
              activeOpacity={0.75}
            >
              <Icon name={meta.icon} size={15} color={meta.color} />
              <Text style={[styles.openExternalText, { color: meta.color }]}>
                Open in {meta.label}
              </Text>
              <Icon name="open-outline" size={14} color={meta.color} />
            </TouchableOpacity>
          </View>
        );
      }

      // Mobile fallback
      return (
        <View style={styles.videoFallback}>
          <Icon name={meta.icon} size={72} color={meta.color} />
          <Text style={styles.videoFallbackTitle}>{material.title || meta.label}</Text>
          <TouchableOpacity
            style={[styles.linkViewerBtn, { backgroundColor: meta.color }]}
            onPress={() => openMaterial(material)}
          >
            <Icon name="open-outline" size={20} color="#fff" />
            <Text style={styles.linkViewerBtnText}>Open in {meta.label}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (material.type === 'pdf') {
      if (Platform.OS === 'web') {
        // Mobile browsers can't render PDFs in iframes — use Google Docs viewer instead
        const pdfSrc = isMobile
          ? `https://docs.google.com/viewer?url=${encodeURIComponent(resolvedUri)}&embedded=true`
          : resolvedUri;
        const iframeH = isMobile ? Math.round(windowHeight * 0.40) : '100%';
        return (
          <View style={[styles.iframeWrapper, isMobile && { minHeight: Math.round(windowHeight * 0.40) }]}>
            <iframe
              src={pdfSrc}
              title={material.title || 'PDF'}
              style={{ width: '100%', height: iframeH, border: 'none', borderRadius: 8, display: 'block' }}
            />
          </View>
        );
      }
      return (
        <TouchableOpacity style={styles.videoFallback} onPress={() => openMaterial(material)}>
          <Icon name="document-text" size={72} color="#e74c3c" />
          <Text style={styles.videoFallbackTitle}>{material.title || material.fileName || 'PDF Document'}</Text>
          <Text style={styles.videoFallbackSub}>Tap to open PDF</Text>
        </TouchableOpacity>
      );
    }

    if (material.type === 'image') {
      return (
        <Image
          source={{ uri: resolvedUri }}
          style={styles.materialImage}
          resizeMode="contain"
        />
      );
    }

    // Fallback for any other type
    return (
      <TouchableOpacity style={styles.videoFallback} onPress={() => openMaterial(material)}>
        <Icon name="document" size={72} color={theme.colors.primary} />
        <Text style={styles.videoFallbackTitle}>{material.title || material.fileName || 'Open Material'}</Text>
        <Text style={styles.videoFallbackSub}>Tap to open</Text>
      </TouchableOpacity>
    );
  };

  // ─── Notes Panel ──────────────────────────────────────────────────────────
  const renderNotesPanel = () => (
    <View style={[styles.chatPanelContainer]}>
      <View style={[styles.chatPanelHeader, {
        backgroundColor: isDark ? theme.colors.card : theme.colors.surface,
        borderBottomColor: theme.colors.border,
      }]}>
        <View style={[styles.chatPanelAvatarSmall, { backgroundColor: theme.colors.primary + '20' }]}>
          <Icon name="document-text" size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chatPanelTitle, { color: theme.colors.textPrimary }]}>Class Notes</Text>
          <Text style={[styles.chatPanelSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {topic?.title || 'Current Topic'}
          </Text>
        </View>
      </View>

      <TextInput
        style={[styles.notesEditor, {
          color: theme.colors.textPrimary,
          backgroundColor: isDark ? '#0b1220' : '#f8fafc',
          borderColor: theme.colors.border,
        }]}
        value={studentNotes}
        onChangeText={setStudentNotes}
        multiline
        textAlignVertical="top"
        placeholder="Write your class notes here..."
        placeholderTextColor={theme.colors.textTertiary}
      />

      <View style={[styles.notesPanelFooter, {
        borderTopColor: theme.colors.border,
        backgroundColor: isDark ? theme.colors.background : '#fff',
      }]}>
        <Text style={[styles.notesSavedText, { color: theme.colors.textTertiary }]}>
          {notesSavedAt ? `Saved ${new Date(notesSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}
        </Text>
        <TouchableOpacity style={[styles.notesFooterBtn, { backgroundColor: '#10b981' }]} onPress={exportNotesPDF}>
          <Icon name="download-outline" size={14} color="#fff" />
          <Text style={styles.notesFooterBtnText}>Export PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.notesFooterBtn, { backgroundColor: theme.colors.primary }]} onPress={saveStudentNotes} disabled={savingNotes}>
          <Icon name="save-outline" size={14} color="#fff" />
          <Text style={styles.notesFooterBtnText}>{savingNotes ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── AI-mode data ─────────────────────────────────────────────────────────

  // Key concepts data
  const keyConcepts = [
    'Neurons process info',
    'Connection weights',
    'Activation functions'
  ];

  return (
    <MainLayout
      showSidebar={true}
      sidebarItems={sidebarItems}
      activeRoute="EnrolledCourses"
      onNavigate={handleNavigate}
      showHeader={false}
    >
      <View style={[styles.mainContent, {
        backgroundColor: '#0d0f1f',
        height: Platform.OS === 'web' ? windowHeight : undefined,
      }]}>

        {/* ── Teams-style icon rail (desktop/tablet only) ───────────────── */}
        <View style={[styles.iconRail, {
          backgroundColor: isDark ? '#0d0d1f' : '#1e293b',
          borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)',
          display: isMobile ? 'none' : 'flex',
        }]}>
          <TouchableOpacity
            style={[styles.railBtn, activePanel === 'topics' && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => togglePanel('topics')}
            activeOpacity={0.7}
          >
            <MaterialIcon
              name="book-open-variant"
              size={24}
              color={activePanel === 'topics' ? theme.colors.primary : '#fff'}
            />
            <Text style={[styles.railLabel, { color: activePanel === 'topics' ? theme.colors.primary : '#fff' }]}>
              Topics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, activePanel === 'notes' && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '50' }]}
            onPress={() => togglePanel('notes')}
            activeOpacity={0.7}
          >
            <Icon
              name={activePanel === 'notes' ? 'document-text' : 'document-text-outline'}
              size={24}
              color={activePanel === 'notes' ? theme.colors.primary : '#fff'}
            />
            <Text style={[styles.railLabel, { color: activePanel === 'notes' ? theme.colors.primary : '#fff' }]}>Notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.railBtn, showQPanel && { backgroundColor: '#f59e0b22', borderColor: '#f59e0b50' }]}
            onPress={handleOpenAsk}
            activeOpacity={0.7}
          >
            <Icon name="hand-left-outline" size={24} color={showQPanel ? '#f59e0b' : '#fff'} />
            <Text style={[styles.railLabel, { color: showQPanel ? '#f59e0b' : '#fff', textAlign: 'center' }]}>{'Ask\nQuestion'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sliding panel (Topics or Notes — desktop/tablet only) ──────── */}
        {!isMobile && activePanel && (
          <View style={[styles.slidePanel, {
            backgroundColor: isDark ? '#12122a' : theme.colors.surface,
            borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.border,
            ...(isWeb && { height: windowHeight }),
          }]}>
            {activePanel === 'topics' && renderTopicsSidebar()}
            {activePanel === 'notes' && renderNotesPanel()}
          </View>
        )}

        {/* ── Main learning area ──────────────────────────────────────── */}
        <View style={[styles.learningArea, { backgroundColor: '#0d0f1f' }, isMobile && { padding: 0 }]}>
          {/* Header bar */}
          {isMobile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: isDark ? '#06060f' : '#0f172a', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <TouchableOpacity
                style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 }}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Icon name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
                <Icon name="book-outline" size={16} color={theme.colors.primary} />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                  {topic?.title || course?.name || 'Learning'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${enrollmentProgress}%`, backgroundColor: '#10b981', borderRadius: 3 }} />
                </View>
              </View>
              <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600', flexShrink: 0 }}>{enrollmentProgress}%</Text>
            </View>
          ) : (
            <View style={styles.progressSection}>
              <TouchableOpacity
                style={[styles.lectureBackBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border }]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Icon name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.progressLabel}>
                <Icon name="book-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.progressText, { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
                  {topic?.title || course?.name || 'Learning'}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFillGreen, { width: `${enrollmentProgress}%` }]} />
                </View>
              </View>
              <Text style={[styles.progressPercent, { color: theme.colors.primary }]}>{enrollmentProgress}%</Text>
            </View>
          )}

          {isManualMode ? (
            /* ── Manual Mode ─── */
            <>
              <View style={[styles.manualFlexArea, isMobile && { flexDirection: 'column', height: Math.round(windowHeight * 0.56), flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]}>
                <View style={[styles.manualContentArea, { flex: 1 }]}>
                  <View style={[styles.manualHeader, { backgroundColor: isDark ? '#1a1a2e' : '#1e293b' }]}>
                    <Icon name={getMaterialIcon(selectedMaterial?.type)} size={16}
                      color={getMaterialColor(selectedMaterial?.type)} />
                    <Text style={styles.manualHeaderTitle} numberOfLines={1}>
                      {selectedMaterial?.title || selectedMaterial?.fileName || topic?.title || 'Topic Materials'}
                    </Text>
                    {selectedMaterial?.type === 'link' && (
                      <TouchableOpacity style={styles.manualOpenBtn} onPress={() => openMaterial(selectedMaterial)}>
                        <Icon name="open-outline" size={14} color="#fff" />
                        <Text style={styles.manualOpenBtnText}>Open</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {topicMaterials.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={[styles.materialTabsBar, { backgroundColor: isDark ? '#12122a' : '#0f172a' }]}
                      contentContainerStyle={styles.materialTabsContent}
                    >
                      {topicMaterials.map((mat, idx) => {
                        const isActive = selectedMaterial?.id === mat.id || (!selectedMaterial && idx === 0);
                        return (
                          <TouchableOpacity
                            key={mat.id || idx}
                            style={[styles.materialTab, isActive && { backgroundColor: theme.colors.primary }]}
                            onPress={() => setSelectedMaterial(mat)}
                          >
                            <Icon name={getMaterialIcon(mat.type)} size={13} color={isActive ? '#fff' : '#9ca3af'} />
                            <Text style={[styles.materialTabText, { color: isActive ? '#fff' : '#9ca3af' }]} numberOfLines={1}>
                              {mat.title || mat.fileName || `Material ${idx + 1}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  <View style={[styles.materialViewerBox, { backgroundColor: isDark ? '#1a1a2e' : '#1e293b', flex: 1 }]}>
                    {topicMaterials.length === 0 ? (
                      <View style={styles.viewerEmpty}>
                        <Icon name="folder-open-outline" size={48} color="rgba(255,255,255,0.25)" />
                        <Text style={styles.viewerEmptyText}>No materials added to this topic yet</Text>
                      </View>
                    ) : (
                      renderMaterialViewer(selectedMaterial || topicMaterials[0])
                    )}
                  </View>
                </View>
              </View>

              {/* Mobile inline panel — sibling to viewer, fills space between viewer and tab bar */}
              {isMobile && (
                <View style={[styles.mobileInlinePanel, {
                  backgroundColor: isDark ? '#12122a' : theme.colors.surface,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : theme.colors.border,
                }]}>
                  {activePanel === 'topics' ? (
                    renderTopicsSidebar()
                  ) : activePanel === 'notes' ? (
                    renderNotesPanel()
                  ) : activePanel === 'materials' ? (
                    <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} showsVerticalScrollIndicator={false}>
                      <Text style={{ color: isDark ? 'rgba(255,255,255,0.35)' : theme.colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>MATERIALS</Text>
                      {topicMaterials.length === 0 ? (
                        <Text style={{ color: theme.colors.textTertiary, fontSize: 13, fontStyle: 'italic' }}>No materials added to this topic yet.</Text>
                      ) : topicMaterials.map((mat, idx) => {
                        const isActive = selectedMaterial?.id === mat.id || (!selectedMaterial && idx === 0);
                        return (
                          <TouchableOpacity
                            key={mat.id || idx}
                            onPress={() => { setSelectedMaterial(mat); togglePanel('materials'); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isActive ? `${theme.colors.primary}66` : (isDark ? 'rgba(255,255,255,0.08)' : theme.colors.border), backgroundColor: isActive ? `${theme.colors.primary}18` : 'transparent' }}
                          >
                            <Icon name={getMaterialIcon(mat.type)} size={18} color={isActive ? theme.colors.primary : getMaterialColor(mat.type)} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: isActive ? theme.colors.primary : theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{mat.title || mat.fileName || `Material ${idx + 1}`}</Text>
                              <Text style={{ color: theme.colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 1 }}>{mat.type}</Text>
                            </View>
                            {isActive && <Icon name="checkmark-circle" size={16} color={theme.colors.primary} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                        {topic?.title}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: 13, lineHeight: 20 }}>
                        {topic?.description || 'Select a tab below to view notes, topics, or ask a question.'}
                      </Text>
                    </ScrollView>
                  )}
                </View>
              )}
            </>
          ) : (
            /* ── AI Mode (placeholder — AI courses redirect to AILearning) ─── */
            <View style={[styles.aiFlexArea, isMobile && { flexDirection: 'column', height: Math.round(windowHeight * 0.56), flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]}>
              <View style={[styles.manualContentArea, isMobile ? { height: Math.round(windowHeight * 0.42), backgroundColor: isDark ? '#1a1a2e' : '#1e293b' } : { flex: 1, backgroundColor: isDark ? '#1a1a2e' : '#1e293b' }]}>
                <View style={[styles.manualHeader, { backgroundColor: isDark ? '#12122a' : '#0f172a' }]}>
                  <MaterialIcon name="presentation" size={16} color="#fff" />
                  <Text style={styles.manualHeaderTitle} numberOfLines={1}>Virtual Whiteboard</Text>
                  {aiSpeaking && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBadgeText}>Live</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.manualOpenBtn, { marginLeft: 4 }]}
                    onPress={() => { setIsPlaying(p => !p); setAiSpeaking(s => !s); }}
                  >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={13} color="#fff" />
                    <Text style={styles.manualOpenBtnText}>{isPlaying ? 'Pause' : 'Resume'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.aiStatusBar}>
                    <RNAnimated.View style={[styles.aiStatusAvatar, { transform: [{ scale: pulseAnim }], opacity: aiSpeaking ? 1 : 0.5 }]}>
                      <MaterialIcon name="robot" size={20} color="#fff" />
                    </RNAnimated.View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiStatusName}>AI Tutor</Text>
                      <Text style={styles.aiStatusSub} numberOfLines={1}>{currentSubtitle}</Text>
                    </View>
                    {aiSpeaking ? (
                      <View style={styles.soundWaveRow}>
                        {[6, 12, 18, 24, 16, 20, 12, 7].map((h, i) => (
                          <View key={i} style={[styles.soundBar, { height: h }]} />
                        ))}
                      </View>
                    ) : (
                      <View style={[styles.liveBadge, { backgroundColor: '#374151' }]}>
                        <Icon name="pause" size={10} color="#9ca3af" />
                        <Text style={[styles.liveBadgeText, { color: '#9ca3af' }]}>Paused</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.whiteboardContent}>
                    <Text style={styles.diagramTitle}>Neural Network Architecture</Text>
                    <View style={styles.neuralNetwork}>
                      <View style={styles.nnLayer}>
                        {['I1', 'I2', 'I3', 'I4'].map((node) => (
                          <View key={node} style={[styles.nnNode, styles.nnNodeInput]}>
                            <Text style={styles.nnNodeText}>{node}</Text>
                          </View>
                        ))}
                        <Text style={styles.nnLayerLabel}>Input</Text>
                      </View>
                      <View style={styles.nnLayer}>
                        {['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map((node) => (
                          <View key={node} style={[styles.nnNode, styles.nnNodeHidden]}>
                            <Text style={styles.nnNodeText}>{node}</Text>
                          </View>
                        ))}
                        <Text style={styles.nnLayerLabel}>Hidden</Text>
                      </View>
                      <View style={styles.nnLayer}>
                        {['O1', 'O2', 'O3'].map((node) => (
                          <View key={node} style={[styles.nnNode, styles.nnNodeOutput]}>
                            <Text style={styles.nnNodeText}>{node}</Text>
                          </View>
                        ))}
                        <Text style={styles.nnLayerLabel}>Output</Text>
                      </View>
                    </View>
                    <View style={styles.keyConcepts}>
                      <Text style={styles.keyConceptsTitle}>Key Concepts:</Text>
                      <View style={styles.keyConceptsList}>
                        {keyConcepts.map((concept, i) => (
                          <View key={i} style={styles.keyConceptItem}>
                            <View style={[styles.keyConceptDot, { backgroundColor: i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : '#10b981' }]} />
                            <Text style={styles.keyConceptText}>{concept}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={[styles.subtitlesSection, { backgroundColor: 'rgba(0,0,0,0.25)', margin: 12, marginTop: 8 }]}>
                    <View style={styles.subtitlesHeader}>
                      <MaterialIcon name="subtitles" size={14} color="#9ca3af" />
                      <Text style={[styles.subtitlesTitle, { color: '#cbd5e1', fontSize: 12 }]}>Subtitles</Text>
                      <View style={[styles.languageBadge, { marginLeft: 'auto' }]}>
                        <Text style={styles.languageBadgeText}>EN</Text>
                      </View>
                    </View>
                    <Text style={[styles.subtitlesText, { color: '#e2e8f0', fontSize: 14 }]}>
                      {currentSubtitle}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Bottom bar / Mobile tab bar */}
          {isMobile ? (
            <View style={[styles.mobileTabBar, {
              backgroundColor: isDark ? '#0d0d1f' : '#1e293b',
              borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
            }]}>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => togglePanel('topics')}>
                <MaterialIcon name="book-open-variant" size={22} color={activePanel === 'topics' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activePanel === 'topics' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Topics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => togglePanel('notes')}>
                <Icon name={activePanel === 'notes' ? 'document-text' : 'document-text-outline'} size={22} color={activePanel === 'notes' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activePanel === 'notes' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Notes</Text>
              </TouchableOpacity>
              {/* Centre green quiz button */}
              <TouchableOpacity
                style={[styles.mobileTabCenter, { backgroundColor: '#10b981' }]}
                onPress={() => navigation.navigate('Quiz', { courseId, topicId, topics: course?.topics || [] })}
                accessibilityLabel="Take quiz"
              >
                <MaterialIcon name="help-circle" size={26} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={() => togglePanel('materials')}>
                <Icon name={activePanel === 'materials' ? 'folder-open' : 'folder-open-outline'} size={22} color={activePanel === 'materials' ? theme.colors.primary : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: activePanel === 'materials' ? theme.colors.primary : 'rgba(255,255,255,0.45)' }]}>Materials</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileTabItem} onPress={handleOpenAsk}>
                <Icon name={showQPanel ? 'hand-left' : 'hand-left-outline'} size={22} color={showQPanel ? '#f59e0b' : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.mobileTabLabel, { color: showQPanel ? '#f59e0b' : 'rgba(255,255,255,0.45)' }]}>Ask</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={[styles.pauseAskButton, { backgroundColor: '#10b981', flex: 1 }]}
                onPress={() => navigation.navigate('Quiz', { courseId, topicId, topics: course?.topics || [] })}
              >
                <MaterialIcon name="help-circle" size={20} color="#fff" />
                <Text style={styles.pauseAskText}>Take Quiz</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ConfirmDialog
        visible={showCompleteDialog}
        title="Complete Topic"
        message="Have you finished this topic?"
        confirmText="Complete"
        confirmVariant="primary"
        onConfirm={confirmCompleteTopic}
        onCancel={() => setShowCompleteDialog(false)}
      />

      {showQPanel && (
        <ManualQuestionPanel
          onAsk={handleAskQuestion}
          onDismiss={handleDismissAsk}
          loading={qLoading}
          history={qHistory}
          language={course?.language}
          studentName={user?.name || user?.fullName || user?.email?.split('@')[0]}
          windowHeight={windowHeight}
        />
      )}
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // ── Teams-style icon rail ──────────────────────────────────────────────────
  iconRail: {
    width: 78,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    gap: 4,
    borderRightWidth: 1,
  },
  railBtn: {
    width: 64,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  railLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Sliding panel ──────────────────────────────────────────────────────────
  slidePanel: {
    width: 290,
    flexShrink: 0,
    overflow: 'hidden',
    borderRightWidth: 1,
  },

  // ── Question overlay ───────────────────────────────────────────────────────
  // ── Chat panel ────────────────────────────────────────────────────────────
  chatPanelContainer: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  chatPanelAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  chatPanelSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  chatOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatPanelLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  chatLoadingText: {
    fontSize: 12,
  },
  chatPanelMessages: {
    padding: 12,
    paddingBottom: 8,
  },
  chatPanelMessagesEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  chatPanelEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  chatEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatEmptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  chatEmptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 190,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
    gap: 6,
  },
  chatBubbleUser: {
    justifyContent: 'flex-end',
  },
  chatBubbleAi: {
    justifyContent: 'flex-start',
  },
  chatAiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  chatBubble: {
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chatBubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  chatBubbleTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  typingDotsRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chatInputArea: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  chatInputBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },
  chatInput: {
    fontSize: 13,
    lineHeight: 19,
    maxHeight: 80,
    minHeight: 20,
  },
  chatSendBtn: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Topics Sidebar Content
  topicsSidebarContent: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    paddingTop: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sidebarHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sidebarSubtitle: {
    fontSize: 12,
  },
  closeSidebar: {
    marginLeft: 'auto',
    padding: 4,
  },
  sidebarProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sidebarProgressText: {
    fontSize: 12,
  },
  sidebarProgressPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  sidebarProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 16,
  },
  sidebarProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  topicsList: {
    flex: 1,
    minHeight: 0,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  topicItemCurrent: {
    borderLeftColor: '#4F46E5',
  },
  topicIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicStatusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicInfo: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  topicMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicDuration: {
    fontSize: 11,
  },
  topicStatus: {
    fontSize: 11,
    fontWeight: '500',
  },
  topicProgressBar: {
    height: 3,
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderRadius: 2,
    marginTop: 6,
  },
  topicProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Learning Area
  learningArea: {
    flex: 1,
    overflow: 'hidden',
    padding: 14,
    flexDirection: 'column',
  },
  learningScrollView: {
    flex: 1,
  },

  // Progress Section with Back Button
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
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
  progressLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 340,
    minWidth: 0,
    flexShrink: 1,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  progressBarContainer: {
    flex: 1,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillGreen: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Content Row
  contentRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },

  // Whiteboard
  whiteboardContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  whiteboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  whiteboardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whiteboardTitleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  whiteboardEdit: {
    padding: 4,
  },
  whiteboardContent: {
    padding: 20,
    minHeight: 280,
  },
  diagramTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Neural Network
  neuralNetwork: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  nnLayer: {
    alignItems: 'center',
    gap: 8,
  },
  nnNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nnNodeInput: {
    backgroundColor: '#3b82f6',
  },
  nnNodeHidden: {
    backgroundColor: '#a855f7',
  },
  nnNodeOutput: {
    backgroundColor: '#10b981',
  },
  nnNodeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  nnLayerLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 8,
  },

  // Key Concepts
  keyConcepts: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  keyConceptsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  keyConceptsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  keyConceptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyConceptDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  keyConceptText: {
    color: '#d1d5db',
    fontSize: 13,
  },

  // AI Tutor Status Bar
  aiStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  aiStatusAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiStatusName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  aiStatusSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#10b981',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1fae5',
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  soundWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  soundBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#10b981',
  },

  // Subtitles
  subtitlesSection: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  subtitlesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  subtitlesTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  languageBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  languageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  subtitlesText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Question Panel
  questionPanel: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    maxHeight: 300,
  },
  questionPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  questionPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  chatMessages: {
    maxHeight: 150,
    marginBottom: 12,
  },
  chatMessage: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  chatMessageUser: {
    backgroundColor: '#4F46E5',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatMessageAi: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  questionInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  questionInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
  pauseAskButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 25,
  },
  pauseAskText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomControls: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },

  // ── AI Mode ────────────────────────────────────────────────────────────────
  aiFlexArea: {
    flex: 1,
    flexDirection: 'column',
  },

  // ── Manual Mode ────────────────────────────────────────────────────────────
  manualFlexArea: {
    flex: 1,
    flexDirection: 'column',
  },
  manualContentArea: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  manualHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  manualOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  manualOpenBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  materialTabsBar: {
    maxHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  materialTabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  materialTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: 160,
  },
  materialTabText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  materialViewerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  iframeWrapper: {
    flex: 1,
  },
  embeddedLinkWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  openExternalText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewerEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  viewerEmptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
  },
  videoFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    padding: 40,
    minHeight: 260,
  },
  ytPlayButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFallbackTitle: {    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '80%',
  },
  videoFallbackSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    textAlign: 'center',
  },
  linkViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    padding: 40,
    minHeight: 260,
  },
  linkViewerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: '80%',
  },
  linkViewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  linkViewerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  materialImage: {
    flex: 1,
    width: '100%',
    minHeight: 200,
  },

  // Notes panel
  notesEditor: {
    flex: 1,
    margin: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  notesPanelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  notesSavedText: {
    flex: 1,
    minWidth: 70,
    fontSize: 11,
  },
  notesFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  notesFooterBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

// (chatStyles removed — chat is now an inline panel)
const chatStyles = StyleSheet.create({
  // Full-screen glassmorphic backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'web' ? 'rgba(10,10,30,0.4)' : 'rgba(0,0,0,0.55)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
    } : {}),
  },
  // Transparent centering wrapper — passes touches through to backdrop
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // The floating popup card
  popup: {
    width: 360,
    height: 520,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 40px rgba(0,0,0,0.28)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 20,
      },
    }),
  },
  // Drag handle section at top (user grabs this to move popup)
  dragHandle: {
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 1,
    cursor: 'grab',
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Loading state inside popup
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  // Message list
  messagesList: {
    padding: 12,
    paddingBottom: 4,
    flexGrow: 1,
  },
  // Empty state
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {    fontSize: 14,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 220,
  },
  // Message bubbles
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
    gap: 6,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  aiBubble: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubbleContent: {
    maxWidth: '82%',
    borderRadius: 14,
    padding: 10,
  },
  userText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 19,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Input bar at bottom
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 13,
    maxHeight: 80,
    lineHeight: 18,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});

export default LearningScreen;
