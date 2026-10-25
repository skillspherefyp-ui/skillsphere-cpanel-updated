import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  useWindowDimensions, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { aiTutorAPI } from '../../services/apiClient';
import { slugify } from '../../utils/urlHelpers';
import MainLayout from '../../components/ui/MainLayout';
import { getSidebarItems } from '../../utils/sidebarItems';

const ORANGE = '#FF8C42';

const GenerationLogsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId, courseTitle: paramTitle, topicId, topicTitle: paramTopicTitle, customPrompt, fromOutline } = route.params;
  const isSingleTopic = !!topicId && !fromOutline;
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { courses, fetchCourses } = useData();
  const { width } = useWindowDimensions();

  const isAdmin = user?.role === 'admin';
  const course = courses.find(c => c.id === courseId);
  const courseTitle = paramTitle || course?.name || 'Course';
  const singleTopicTitle = paramTopicTitle || 'Topic';
  const topics = course?.topics || [];

  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('starting');
  const [reportItems, setReportItems] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [summary, setSummary] = useState(null);

  const scrollRef = useRef(null);
  const isMounted = useRef(true);
  const logCounter = useRef(0);
  const hasStarted = useRef(false);

  const sidebarItems = getSidebarItems(user?.role);

  const handleNavigate = (navRoute) => {
    if (isAdmin) {
      if (navRoute === 'ManageInstructors') navigation.navigate('ManageUsers', { userType: 'instructor' });
      else if (navRoute === 'Categories') navigation.navigate('CategoryManagement');
      else navigation.navigate(navRoute);
    } else {
      navigation.navigate(navRoute);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const addLog = useCallback((message, type) => {
    const logType = type || 'info';
    const now = new Date();
    const time =
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');
    logCounter.current += 1;
    const id = logCounter.current;
    setLogs(prev => prev.concat([{ id, time, message, type: logType }]));
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    runGeneration();
  }, []);

  async function runGeneration() {
    if (fromOutline) {
      await runOutlineTopicsGeneration();
    } else if (isSingleTopic) {
      await runSingleTopicGeneration();
    } else {
      await runCourseGeneration();
    }
  }

  async function runOutlineTopicsGeneration() {
    addLog('Reading course outline PDF...', 'info');
    setStatus('running');
    try {
      addLog('Sending outline to AI for topic extraction...', 'info');
      const response = await aiTutorAPI.createTopicsFromOutline(courseId);
      if (!isMounted.current) return;

      if (!response.success) {
        throw new Error(response.error || 'Failed to create topics from outline');
      }

      const createdTopics = response.topics || [];
      addLog('AI extracted ' + createdTopics.length + ' topics from outline.', 'success');

      createdTopics.forEach((topic, i) => {
        addLog('[' + (i + 1) + '] ' + topic.title + ' \u2713', 'success');
      });

      await fetchCourses();
      if (!isMounted.current) return;
      addLog('Course data refreshed.', 'info');

      const items = createdTopics.map(t => ({
        topicId: t.id,
        topicTitle: t.title,
        displayStatus: 'ready',
        displayMessage: 'Topic created from course outline.',
      }));

      addLog('All ' + createdTopics.length + ' topics created successfully!', 'success');
      setReportItems(items);
      setSummary({ ready: createdTopics.length, fallback: 0, failed: 0, total: createdTopics.length });
      setStatus('completed');
      setShowReportModal(true);
    } catch (err) {
      if (!isMounted.current) return;
      const msg = (err && err.message) ? err.message : 'Unknown error occurred';
      addLog('Error: ' + msg, 'error');
      setReportItems([{ topicId: 'error', topicTitle: courseTitle, displayStatus: 'failed', displayMessage: msg }]);
      setSummary({ ready: 0, fallback: 0, failed: 1, total: 0 });
      setStatus('failed');
      setShowReportModal(true);
    }
  }

  async function runSingleTopicGeneration() {
    addLog('Starting AI lecture generation for topic "' + singleTopicTitle + '"...', 'info');
    if (customPrompt) {
      const preview = customPrompt.length > 100 ? customPrompt.slice(0, 100) + '…' : customPrompt;
      addLog('Custom prompt applied: "' + preview + '"', 'success');
    }

    try {
      const response = await aiTutorAPI.generateTopicPackage(topicId, customPrompt ? { customPrompt } : {});
      if (!isMounted.current) return;

      if (!response.success) {
        throw new Error(response.error || 'Failed to start AI generation');
      }

      if (response.alreadyRunning) {
        addLog('Generation already running for this topic — tracking progress...', 'warning');
      } else {
        addLog('Generation job submitted successfully.', 'success');
      }

      addLog('"' + singleTopicTitle + '": generating lecture...', 'info');
      setStatus('running');

      let statusResponse = null;
      let prevStatus = null;

      for (let attempt = 0; attempt < 48; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!isMounted.current) return;

        statusResponse = await aiTutorAPI.getTopicGenerationStatus(topicId);
        if (!isMounted.current) return;

        if (statusResponse.status !== prevStatus) {
          prevStatus = statusResponse.status;
          if (statusResponse.status === 'processing') {
            addLog('"' + singleTopicTitle + '": processing...', 'info');
          } else if (statusResponse.status === 'ready') {
            const isFallback = statusResponse.generationModel === 'fallback-template';
            if (isFallback) {
              addLog('"' + singleTopicTitle + '": fallback template stored.', 'warning');
            } else {
              addLog('"' + singleTopicTitle + '": ready \u2713', 'success');
            }
          } else if (statusResponse.status === 'failed') {
            addLog('"' + singleTopicTitle + '": failed \u2014 ' + (statusResponse.errorMessage || 'unknown error'), 'error');
          }
        }

        if (!statusResponse.isRunning && (statusResponse.status === 'ready' || statusResponse.status === 'failed')) break;
      }

      if (!isMounted.current) return;

      await fetchCourses();
      if (!isMounted.current) return;
      addLog('Course data refreshed.', 'info');

      if (!statusResponse) throw new Error('Could not retrieve generation status. Please refresh.');

      const finalStatus = statusResponse.status;
      const isFallback = statusResponse.generationModel === 'fallback-template';
      const displayStatus = finalStatus === 'ready' ? (isFallback ? 'fallback used' : 'ready') : finalStatus;
      const displayMessage = statusResponse.errorMessage
        || (finalStatus === 'ready'
          ? isFallback ? 'Fallback lecture package stored successfully.' : 'Lecture package generated successfully.'
          : 'Generation failed for this topic.');

      const items = [{
        topicId,
        topicTitle: singleTopicTitle,
        displayStatus,
        displayMessage,
        generationModel: statusResponse.generationModel
      }];

      const failed = finalStatus === 'failed' ? 1 : 0;
      const fallback = (finalStatus === 'ready' && isFallback) ? 1 : 0;
      const ready = finalStatus === 'ready' ? 1 : 0;

      if (failed > 0) {
        addLog('Finished: generation failed.', 'error');
      } else if (fallback > 0) {
        addLog('Finished: fallback template used.', 'warning');
      } else {
        addLog('"' + singleTopicTitle + '" generated successfully!', 'success');
      }

      setReportItems(items);
      setSummary({ ready, fallback, failed, total: 1 });
      setStatus('completed');
      setShowReportModal(true);

    } catch (err) {
      if (!isMounted.current) return;
      const msg = (err && err.message) ? err.message : 'Unknown error occurred';
      addLog('Error: ' + msg, 'error');
      setReportItems([{ topicId, topicTitle: singleTopicTitle, displayStatus: 'failed', displayMessage: msg }]);
      setSummary({ ready: 0, fallback: 0, failed: 1, total: 1 });
      setStatus('failed');
      setShowReportModal(true);
    }
  }

  async function runCourseGeneration() {
    addLog('Starting AI lecture generation for "' + courseTitle + '"...', 'info');

    try {
      const response = await aiTutorAPI.generateCoursePackage(courseId);
      if (!isMounted.current) return;

      if (!response.success) {
        throw new Error(response.error || 'Failed to start AI generation');
      }

      if (response.alreadyRunning) {
        addLog('Generation already running — tracking progress...', 'warning');
      } else {
        addLog('Generation job submitted successfully.', 'success');
      }

      setStatus('running');

      let statusResponse = null;
      const prevStatuses = {};

      for (let attempt = 0; attempt < 48; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!isMounted.current) return;

        statusResponse = await aiTutorAPI.getGenerationStatus(courseId);
        if (!isMounted.current) return;

        const topicList = (statusResponse && statusResponse.topics) ? statusResponse.topics : [];
        for (let i = 0; i < topicList.length; i++) {
          const t = topicList[i];
          const prev = prevStatuses[t.topicId];
          if (prev !== t.status) {
            prevStatuses[t.topicId] = t.status;
            if (t.status === 'processing') {
              addLog('"' + t.topicTitle + '": generating lecture...', 'info');
            } else if (t.status === 'ready') {
              const isFallback = t.generationModel === 'fallback-template';
              if (isFallback) {
                addLog('"' + t.topicTitle + '": fallback template (' + (t.estimatedDuration || '?') + ' min)', 'warning');
              } else {
                addLog('"' + t.topicTitle + '": ready \u2713 (' + (t.estimatedDuration || '?') + ' min)', 'success');
              }
            } else if (t.status === 'failed') {
              addLog('"' + t.topicTitle + '": failed \u2014 ' + (t.errorMessage || 'unknown error'), 'error');
            }
          }
        }

        const sd = (statusResponse && statusResponse.summary) ? statusResponse.summary : {};
        addLog('Progress: ' + (sd.ready || 0) + ' / ' + topicList.length + ' ready', 'info');

        if (statusResponse && statusResponse.isCompleted && !statusResponse.isRunning) break;
      }

      if (!isMounted.current) return;

      await fetchCourses();
      if (!isMounted.current) return;
      addLog('Course data refreshed.', 'info');

      if (!statusResponse) throw new Error('Could not retrieve generation status. Please refresh.');

      const topicResults = statusResponse.topics || [];
      const items = topicResults.map(function(item) {
        const displayStatus = item.status === 'ready'
          ? (item.generationModel === 'fallback-template' ? 'fallback used' : 'ready')
          : item.status;
        const displayMessage = item.errorMessage
          || (item.status === 'ready'
            ? item.generationModel === 'fallback-template'
              ? 'Fallback lecture package stored successfully.'
              : 'Lecture package generated successfully.'
            : item.status === 'processing'
              ? 'Generation is still running for this topic.'
              : item.status === 'pending'
                ? 'This topic has not started generation yet.'
                : 'Generation failed for this topic.');
        return Object.assign({}, item, { displayStatus, displayMessage });
      });

      const failedCount = topicResults.filter(function(t) { return t.status === 'failed'; }).length;
      const fallbackCount = topicResults.filter(function(t) {
        return t.status === 'ready' && t.generationModel === 'fallback-template';
      }).length;
      const readyFinal = (statusResponse.summary && statusResponse.summary.ready) ? statusResponse.summary.ready : 0;

      if (failedCount > 0) {
        addLog('Finished: ' + readyFinal + ' ready, ' + fallbackCount + ' fallback, ' + failedCount + ' failed.', 'error');
      } else if (fallbackCount > 0) {
        addLog('Finished: ' + readyFinal + ' ready (' + fallbackCount + ' used fallback templates).', 'warning');
      } else {
        addLog('All ' + readyFinal + ' topics generated successfully!', 'success');
      }

      setReportItems(items);
      setSummary({ ready: readyFinal, fallback: fallbackCount, failed: failedCount, total: topicResults.length });
      setStatus('completed');
      setShowReportModal(true);

    } catch (err) {
      if (!isMounted.current) return;
      const msg = (err && err.message) ? err.message : 'Unknown error occurred';
      addLog('Error: ' + msg, 'error');
      setReportItems([{ topicId: 'error', topicTitle: courseTitle, displayStatus: 'failed', displayMessage: msg }]);
      setSummary({ ready: 0, fallback: 0, failed: 1, total: topics.length });
      setStatus('failed');
      setShowReportModal(true);
    }
  }

  function handleDone() {
    setShowReportModal(false);
    if (fromOutline) {
      navigation.navigate('AddTopics', { courseId, creationMode: 'ai' });
    } else {
      navigation.navigate('CourseDetail', { courseId, courseName: slugify(course?.name) });
    }
  }

  function getLogColor(type) {
    if (type === 'success') return '#10B981';
    if (type === 'error') return '#EF4444';
    if (type === 'warning') return '#F59E0B';
    return isDark ? '#64748B' : '#475569';
  }

  function getLogIcon(type) {
    if (type === 'success') return 'checkmark-circle-outline';
    if (type === 'error') return 'close-circle-outline';
    if (type === 'warning') return 'warning-outline';
    return 'arrow-forward-outline';
  }

  function getStatusMeta(displayStatus) {
    if (displayStatus === 'ready') return { icon: 'checkmark-circle', color: '#10B981' };
    if (displayStatus === 'fallback used') return { icon: 'alert-circle', color: '#F59E0B' };
    if (displayStatus === 'failed') return { icon: 'close-circle', color: '#EF4444' };
    if (displayStatus === 'processing') return { icon: 'time', color: '#3B82F6' };
    if (displayStatus === 'pending') return { icon: 'hourglass', color: '#6B7280' };
    return { icon: 'help-circle', color: '#6B7280' };
  }

  const isRunning = status === 'starting' || status === 'running';

  // Color scheme: black terminal in dark, white in light
  const pageBg = isDark ? theme.colors.background : theme.colors.background;
  const terminalBg = isDark ? '#000000' : '#FFFFFF';
  const terminalBarBg = isDark ? '#0d0d0d' : '#F1F5F9';
  const terminalBorder = isDark ? '#1e1e1e' : '#E2E8F0';
  const timeColor = isDark ? '#475569' : '#94A3B8';
  const defaultLogColor = isDark ? '#94A3B8' : '#475569';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const modalBg = isDark ? '#1a1a2e' : '#FFFFFF';
  const modalBorder = isDark ? '#2a2a3e' : '#E2E8F0';

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
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Banner */}
        <View style={{
          backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
          borderColor: 'rgba(99,102,241,0.18)',
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
          <View style={{ backgroundColor: '#6366F120', borderRadius: 12, padding: 12 }}>
            {isRunning
              ? <ActivityIndicator size="small" color="#6366F1" />
              : <Icon name={status === 'completed' ? 'checkmark-circle' : 'close-circle'} size={22} color={status === 'completed' ? '#10B981' : '#EF4444'} />
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
              {fromOutline ? 'AI Topic Creation' : isSingleTopic ? 'AI Topic Generation' : 'AI Lecture Generation'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
              {isSingleTopic ? singleTopicTitle : courseTitle}
            </Text>
          </View>
          <View style={[
            styles.statusPill,
            { backgroundColor: isRunning ? '#1E3A5F' : status === 'completed' ? '#064E3B' : '#450A0A' }
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isRunning ? '#60A5FA' : status === 'completed' ? '#10B981' : '#EF4444' }
            ]} />
            <Text style={[
              styles.statusPillText,
              { color: isRunning ? '#93C5FD' : status === 'completed' ? '#34D399' : '#F87171' }
            ]}>
              {isRunning ? 'Running' : status === 'completed' ? 'Complete' : 'Failed'}
            </Text>
          </View>
        </View>

        {/* Custom Prompt Strip */}
        {isSingleTopic && !!customPrompt && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            backgroundColor: isDark ? 'rgba(255,140,66,0.08)' : 'rgba(255,140,66,0.07)',
            borderColor: 'rgba(255,140,66,0.3)',
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
          }}>
            <Icon name="create-outline" size={15} color="#FF8C42" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FF8C42', fontSize: 11, fontWeight: '700', marginBottom: 3, letterSpacing: 0.3 }}>
                CUSTOM PROMPT SUBMITTED
              </Text>
              <Text style={{ color: isDark ? '#FBD5B5' : '#92400E', fontSize: 12, lineHeight: 17 }} numberOfLines={3}>
                {customPrompt}
              </Text>
            </View>
          </View>
        )}

        {/* Terminal */}
        <View style={[styles.terminal, { backgroundColor: terminalBg, borderColor: terminalBorder }]}>
          <View style={[styles.terminalBar, { backgroundColor: terminalBarBg, borderBottomColor: terminalBorder }]}>
            <View style={styles.terminalDots}>
              <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            </View>
            <Text style={[styles.terminalLabel, { color: textSecondary }]}>generation.log</Text>
            <Text style={[styles.terminalCount, { color: textSecondary }]}>{logs.length} entries</Text>
          </View>
          <ScrollView
            ref={scrollRef}
            style={styles.logScroll}
            contentContainerStyle={styles.logContent}
            onContentSizeChange={() => scrollRef.current && scrollRef.current.scrollToEnd({ animated: true })}
          >
            {logs.map(function(log) {
              const color = log.type === 'info' ? defaultLogColor : getLogColor(log.type);
              return (
                <View key={String(log.id)} style={styles.logRow}>
                  <Text style={[styles.logTime, { color: timeColor }]}>{log.time}</Text>
                  <Icon name={getLogIcon(log.type)} size={13} color={color} />
                  <Text style={[styles.logText, { color }]}>{log.message}</Text>
                </View>
              );
            })}
            {isRunning && (
              <View style={styles.logRow}>
                <Text style={[styles.logTime, { color: timeColor }]}> </Text>
                <Text style={[styles.logText, { color: textSecondary }]}>|</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={function() {}}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: modalBg, borderColor: modalBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Icon
                name={
                  status === 'failed' || (summary && summary.failed > 0)
                    ? 'close-circle'
                    : (summary && summary.fallback > 0) ? 'alert-circle' : 'checkmark-circle'
                }
                size={26}
                color={
                  status === 'failed' || (summary && summary.failed > 0)
                    ? '#EF4444'
                    : (summary && summary.fallback > 0) ? '#F59E0B' : '#10B981'
                }
              />
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Generation Report</Text>
            </View>

            {summary && (
              <View style={[styles.summaryRow, { borderColor: modalBorder }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryCount, { color: '#10B981' }]}>{summary.ready}</Text>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>Ready</Text>
                </View>
                {summary.fallback > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryCount, { color: '#F59E0B' }]}>{summary.fallback}</Text>
                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>Fallback</Text>
                  </View>
                )}
                {summary.failed > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryCount, { color: '#EF4444' }]}>{summary.failed}</Text>
                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>Failed</Text>
                  </View>
                )}
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryCount, { color: textSecondary }]}>{summary.total}</Text>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>Total</Text>
                </View>
              </View>
            )}

            <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportScrollContent}>
              {reportItems.map(function(item, i) {
                const meta = getStatusMeta(item.displayStatus);
                return (
                  <View key={item.topicId || String(i)} style={[styles.reportRow, { borderColor: modalBorder }]}>
                    <Icon name={meta.icon} size={16} color={meta.color} />
                    <View style={styles.reportRowContent}>
                      <Text style={[styles.reportRowTitle, { color: textPrimary }]} numberOfLines={1}>
                        {item.topicTitle}
                      </Text>
                      <Text style={[styles.reportRowMsg, { color: textSecondary }]} numberOfLines={2}>
                        {item.displayMessage}
                      </Text>
                    </View>
                    <View style={[styles.reportBadge, { backgroundColor: meta.color + '22' }]}>
                      <Text style={[styles.reportBadgeText, { color: meta.color }]}>{item.displayStatus}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.okButton} onPress={handleDone} activeOpacity={0.85}>
              <Icon name="arrow-forward-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.okButtonText}>{fromOutline ? 'OK — View Topics' : 'OK — Go to Course'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  terminal: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 420,
  },
  terminalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  terminalDots: {
    flexDirection: 'row',
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  terminalLabel: {
    fontSize: 12,
    flex: 1,
  },
  terminalCount: {
    fontSize: 11,
  },
  logScroll: {
    minHeight: 360,
    maxHeight: 520,
  },
  logContent: {
    padding: 16,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  logTime: {
    fontSize: 11,
    minWidth: 60,
    marginTop: 1,
    marginRight: 8,
  },
  logText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryCount: {    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  reportScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  reportScrollContent: {
    paddingBottom: 4,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  reportRowContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  reportRowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportRowMsg: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  reportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reportBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  okButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  okButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default GenerationLogsScreen;
