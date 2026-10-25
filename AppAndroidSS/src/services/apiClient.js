import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_PORT = '5000';

const getWebFallbackHost = () => {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return `http://localhost:${DEFAULT_PORT}`;
  }

  const { protocol, hostname } = window.location;
  const normalizedProtocol = protocol === 'https:' ? 'https:' : 'http:';
  // In production (non-localhost), use Apache reverse proxy — no port needed
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${normalizedProtocol}//${hostname}`;
  }
  return `${normalizedProtocol}//${hostname}:${DEFAULT_PORT}`;
};

const getHost = () => {
  if (Platform.OS === 'web' && process.env.REACT_APP_API_URL) {
    console.log('Using production API:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }

  if (Platform.OS === 'android') return 'https://skillsphere.com.pk';
  if (Platform.OS === 'web') {
    const fallbackHost = getWebFallbackHost();
    console.log('No REACT_APP_API_URL found, using browser host fallback:', fallbackHost);
    return fallbackHost;
  }
  return `http://localhost:${DEFAULT_PORT}`;
};

export const API_BASE = `${getHost()}/api`;
export const HEALTH_URL = `${getHost()}/health`;

const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('@skillsphere:token');
  } catch {
    return null;
  }
};

// AuthContext registers its logout function here so the API client can
// trigger an automatic logout whenever the server returns 401 (expired token).
let _unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  _unauthorizedHandler = fn;
}

const handleResponse = async (response) => {
  // Expired or invalid token — clear session and redirect to login
  if (response.status === 401) {
    if (_unauthorizedHandler) _unauthorizedHandler();
    throw new Error('Session expired. Please log in again.');
  }
  try {
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || 'Request failed');
      if (data.blocked) err.blocked = true;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.message) throw err;
    throw new Error('Failed to parse server response');
  }
};

export async function get(path, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers
  });
  return handleResponse(res);
}

export async function post(path, data, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.message === 'Network request failed') {
      throw new Error('Cannot connect to server. Make sure the backend is running.');
    }
    throw err;
  }
}

export async function put(path, data, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function del(path, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers
  });
  return handleResponse(res);
}

export async function patch(path, data, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function health() {
  try {
    const res = await fetch(HEALTH_URL);
    return res.json();
  } catch (error) {
    return { status: 'ERROR', message: error.message };
  }
}

export async function uploadFile(formData, authenticated = true) {
  const headers = {};

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/upload/file`, {
    method: 'POST',
    headers,
    body: formData
  });
  return handleResponse(res);
}

export async function uploadMultipart(path, formData, authenticated = true) {
  const headers = {};

  if (authenticated) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData
  });
  return handleResponse(res);
}

export const authAPI = {
  login: (email, password) => post('/auth/login', { email, password }, false),
  register: (data) => post('/auth/register', data, false),
  getProfile: () => get('/auth/profile'),
  updateProfile: (data) => put('/auth/profile', data),
  changePassword: (data) => put('/auth/change-password', data),
  sendOTP: (email, name) => post('/auth/send-otp', { email, name }, false),
  verifyOTP: (email, otp) => post('/auth/verify-otp', { email, otp }, false),
  resendOTP: (email) => post('/auth/resend-otp', { email }, false),
  completeRegistration: (data) => post('/auth/complete-registration', data, false),
  sendLoginOTP: (email) => post('/auth/send-login-otp', { email }, false),
  loginWithOTP: (email, otp) => post('/auth/login-with-otp', { email, otp }, false),
  forgotPassword: (email) => post('/auth/forgot-password', { email }, false),
  resetPassword: (email, otp, newPassword) => post('/auth/reset-password', { email, otp, newPassword }, false),
  verifySignupOTP: (email, otp) => post('/auth/verify-signup-otp', { email, otp }, false),
  googleAuth: (idToken) => post('/auth/google-auth', { idToken }, false),
  acceptPrivacyPolicy: () => post('/auth/accept-privacy-policy', {}),
  getPrivacyPolicyStatus: () => get('/auth/privacy-policy-status'),
};

export const contactAPI = {
  send: (data) => post('/contact', data, false),
};

export const instructorAPI = {
  getAll: () => get('/instructors'),
  getById: (id) => get(`/instructors/${id}`),
  create: (data) => post('/instructors', data),
  update: (id, data) => put(`/instructors/${id}`, data),
  toggleStatus: (id) => patch(`/instructors/${id}/toggle-status`, {}),
  updatePermissions: (id, permissions) => post(`/instructors/${id}/permissions`, { permissions }),
  delete: (id) => del(`/instructors/${id}`),
};

export const userAPI = {
  getAll: () => get('/users'),
  getStudents: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.search) qs.set('search', params.search);
    const query = qs.toString();
    return get(`/users/students${query ? `?${query}` : ''}`);
  },
  getExperts: () => get('/users/experts'),
  getById: (id) => get(`/users/${id}`),
  update: (id, data) => put(`/users/${id}`, data),
  toggleStatus: (id) => patch(`/users/${id}/toggle-status`, {}),
  delete: (id) => del(`/users/${id}`),
  getStats: (id) => get(id ? `/users/stats/${id}` : '/users/stats'),
  bulkAction: (action, userIds) => post('/users/bulk-action', { action, userIds }),
  exportStudentsCSV: async () => {
    const token = await AsyncStorage.getItem('@skillsphere:token');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/users/export/csv`, { method: 'GET', headers });
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },
};

export const categoryAPI = {
  getAll: () => get('/categories', false),
  getTop: (limit = 5) => get(`/categories/top?limit=${limit}`, false),
  getById: (id) => get(`/categories/${id}`, false),
  create: (data) => post('/categories', data),
  update: (id, data) => put(`/categories/${id}`, data),
  delete: (id) => del(`/categories/${id}`),
};

export const courseAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.search) qs.set('search', params.search);
    if (params.category) qs.set('category', params.category);
    if (params.level) qs.set('level', params.level);
    if (params.sort) qs.set('sort', params.sort);
    if (params.instructorId) qs.set('instructorId', params.instructorId);
    if (params.status) qs.set('status', params.status);
    const query = qs.toString();
    return get(`/courses${query ? `?${query}` : ''}`);
  },
  getTopCourses: (limit = 3) => get(`/courses/top?limit=${limit}`, false),
  getPublicStats: () => get('/courses/stats', false),
  getById: (id) => get(`/courses/${id}`, false),
  create: (data) => post('/courses', data),
  update: (id, data) => put(`/courses/${id}`, data),
  delete: (id) => del(`/courses/${id}`),
  publish: (id) => patch(`/courses/${id}/publish`, {}),
  setPrerequisites: (id, prerequisiteIds) => patch(`/courses/${id}/prerequisites`, { prerequisiteIds }),
  getRecommendations: () => get('/courses/recommendations'),
};

export const topicAPI = {
  getAll: () => get('/topics'),
  getById: (id) => get(`/topics/${id}`),
  create: (data) => post('/topics', data),
  update: (id, data) => put(`/topics/${id}`, data),
  delete: (id) => del(`/topics/${id}`),
};

export const materialAPI = {
  getAll: () => get('/materials'),
  getById: (id) => get(`/materials/${id}`),
  create: (data) => post('/materials', data),
  update: (id, data) => put(`/materials/${id}`, data),
  delete: (id) => del(`/materials/${id}`),
};

export const enrollmentAPI = {
  enroll: (courseId) => post('/enrollments', { courseId }),
  getMyEnrollments: () => get('/enrollments/my'),
  getAllEnrollments: () => get('/enrollments/all'),
  updateProgress: (courseId, progress) => put('/enrollments/progress', { courseId, progress }),
  checkEnrollment: (courseId) => get(`/enrollments/check/${courseId}`),
  unenroll: (courseId) => del(`/enrollments/${courseId}`),
};

export const quizAPI = {
  getAll: (params) => get(`/quizzes${params ? `?${new URLSearchParams(params)}` : ''}`),
  getById: (id) => get(`/quizzes/${id}`),
  getByTopic: (topicId) => get(`/quizzes/topic/${topicId}`),
  create: (data) => post('/quizzes', data),
  update: (id, data) => put(`/quizzes/${id}`, data),
  delete: (id) => del(`/quizzes/${id}`),
  submit: (data) => post('/quizzes/submit', data),
  getMyResults: () => get('/quizzes/results/my'),
  addQuestion: (data) => post('/quizzes/questions', data),
  updateQuestion: (id, data) => put(`/quizzes/questions/${id}`, data),
  deleteQuestion: (id) => del(`/quizzes/questions/${id}`),
};

export const certificateAPI = {
  generate: (data) => post('/certificates', data),
  getMyCertificates: () => get('/certificates/my'),
  getAllCertificates: () => get('/certificates/all'),
  getById: (id) => get(`/certificates/${id}`),
  verify: (certificateId) => get(`/certificates/verify/${certificateId}`),
  delete: (id) => del(`/certificates/${id}`),
};

export const paymentAPI = {
  createOrder: (data) => post('/payments/create-order', data),
  verifyPayment: (data) => post('/payments/verify', data),
};

export const certificateTemplateAPI = {
  getAll: () => get('/certificate-templates'),
  getActive: () => get('/certificate-templates/active'),
  getActivePerCourse: () => get('/certificate-templates/active-per-course'),
  getById: (id) => get(`/certificate-templates/${id}`),
  getForCourse: (courseId) => get(`/certificate-templates/for-course/${courseId}`),
  create: (data) => post('/certificate-templates', data),
  update: (id, data) => put(`/certificate-templates/${id}`, data),
  activate: (id) => put(`/certificate-templates/${id}/activate`, {}),
  activateForCourses: (id, courseIds) => put(`/certificate-templates/${id}/activate-for-courses`, { courseIds }),
  delete: (id) => del(`/certificate-templates/${id}`),
  getStats: () => get('/certificate-templates/stats'),
  getPreview: async (id) => {
    const token = await AsyncStorage.getItem('@skillsphere:token');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = `${API_BASE}/certificate-templates/preview${id ? `/${id}` : ''}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to load preview' }));
      throw new Error(error.error || 'Failed to load preview');
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  // Instructor signature — one per instructor, applies to all their templates
  getMySignature: () => get('/certificate-templates/my-signature'),
  saveMySignature: (signatureData) => post('/certificate-templates/my-signature', { signatureData }),
  clearMySignature: () => del('/certificate-templates/my-signature'),
  getSignatureImage: (id, courseId) => get(`/certificate-templates/${id}/signature-image${courseId ? `?courseId=${courseId}` : ''}`),
};

export const notificationAPI = {
  getMyNotifications: (unreadOnly, page = 1, limit = 50) => {
    const qs = new URLSearchParams();
    if (unreadOnly) qs.set('unreadOnly', 'true');
    qs.set('page', page);
    qs.set('limit', limit);
    return get(`/notifications/my?${qs.toString()}`);
  },
  markAsRead: (id) => put(`/notifications/read/${id}`, {}),
  markAllAsRead: () => put('/notifications/read-all', {}),
  delete: (id) => del(`/notifications/${id}`),
  clearAll: () => del('/notifications/clear/all'),
  deleteMultiple: (ids) => post('/notifications/bulk-delete', { ids }),
};

export const discussionAPI = {
  getPosts: () => get('/discussions/posts'),
  createPost: (data) => post('/discussions/posts', data),
  updatePost: (id, data) => put(`/discussions/posts/${id}`, data),
  deletePost: (id) => del(`/discussions/posts/${id}`),
  pinPost: (id) => patch(`/discussions/posts/${id}/pin`, {}),
};

export const progressAPI = {
  updateTopicProgress: (data) => post('/progress/topic', data),
  getCourseProgress: (courseId) => get(`/progress/course/${courseId}`),
  getMyProgress: () => get('/progress/my'),
  getLearningStats: () => get('/progress/stats'),
  resetCourseProgress: (courseId) => del(`/progress/reset/${courseId}`),
};

export const todoAPI = {
  getMyTodos: () => get('/todos/my'),
  create: (data) => post('/todos', data),
  toggle: (id) => patch(`/todos/${id}/toggle`, {}),
  delete: (id) => del(`/todos/${id}`),
};

export const streakAPI = {
  recordActivity: () => post('/streak/activity', {}),
  getStreak: () => get('/streak'),
};

export const feedbackAPI = {
  getAll: () => get('/feedback'),
  getById: (id) => get(`/feedback/${id}`),
  create: (data) => post('/feedback', data),
  update: (id, data) => put(`/feedback/${id}`, data),
  delete: (id) => del(`/feedback/${id}`),
  checkMyCourse: (courseId) => get(`/feedback/check/${courseId}`),
  getByCourse: (params = {}) => {
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return get(`/feedback/by-course${qs ? '?' + qs : ''}`);
  },
};

export const blogAPI = {
  getPosts: () => get('/blog', false),
  getPost: (id) => get(`/blog/${id}`, false),
  subscribe: (email) => post('/blog/subscribe', { email }, false),
  getAllAdmin: () => get('/blog/admin/all'),
  getPostAdmin: (id) => get(`/blog/admin/${id}`),
  create: (data) => post('/blog', data),
  update: (id, data) => put(`/blog/${id}`, data),
  togglePublish: (id) => patch(`/blog/${id}/publish`, {}),
  delete: (id) => del(`/blog/${id}`),
};

export const uploadAPI = {
  uploadFile: (formData) => uploadFile(formData),
};

export const bulkEmailAPI = {
  getRecipients: () => get('/bulk-email/recipients'),
  send: (data) => post('/bulk-email/send', data),
};

export const newsletterAPI = {
  getSubscribers: () => get('/newsletter/subscribers'),
  subscribe:   (userId) => post(`/newsletter/subscribe/${userId}`),
  unsubscribe: (userId) => del(`/newsletter/unsubscribe/${userId}`),
};

export const lectureChatAPI = {
  getHistory: (courseId, topicId) => get(`/lecture-chat/${courseId}/${topicId}`),
  sendMessage: (courseId, topicId, content) => post(`/lecture-chat/${courseId}/${topicId}/messages`, { content }),
  clearHistory: (courseId, topicId) => del(`/lecture-chat/${courseId}/${topicId}`),
};

export const aiChatAPI = {
  createSession: (data) => post('/ai-chat/sessions', data || {}),
  getSessions: () => get('/ai-chat/sessions'),
  getSession: (id) => get(`/ai-chat/sessions/${id}`),
  updateSession: (id, data) => put(`/ai-chat/sessions/${id}`, data),
  deleteSession: (id) => del(`/ai-chat/sessions/${id}`),
  sendMessage: (sessionId, content) => post(`/ai-chat/sessions/${sessionId}/messages`, { content }),
};

export const aiTutorAPI = {
  updateOutline: (topicId, outlineText) => put(`/ai-tutor/topics/${topicId}/outline`, { outlineText }),
  generateTopicPackage: (topicId, data) => post(`/ai-tutor/topics/${topicId}/generate`, data || {}),
  createTopicsFromOutline: (courseId) => post(`/ai-tutor/courses/${courseId}/create-topics-from-outline`, {}),
  getTopicGenerationStatus: (topicId) => get(`/ai-tutor/topics/${topicId}/generate-status`),
  generateCoursePackage: (courseId) => post(`/ai-tutor/courses/${courseId}/generate`, {}),
  getGenerationStatus: (courseId) => get(`/ai-tutor/courses/${courseId}/generate-status`),
  listLectures: (courseId, params) => get(`/ai-tutor/courses/${courseId}/lectures${params ? `?${new URLSearchParams(params)}` : ''}`),
  getLecturePackage: (topicId) => get(`/ai-tutor/topics/${topicId}/package`),
  startSession: (topicId, data) => post(`/ai-tutor/topics/${topicId}/start`, data || {}),
  getSessionState: (sessionId) => get(`/ai-tutor/sessions/${sessionId}`),
  getNextChunk: (sessionId) => post(`/ai-tutor/sessions/${sessionId}/next`, {}),
  restartSession: (sessionId) => post(`/ai-tutor/sessions/${sessionId}/restart`, {}),
  pauseSession: (sessionId) => post(`/ai-tutor/sessions/${sessionId}/pause`, {}),
  resumeSession: (sessionId) => post(`/ai-tutor/sessions/${sessionId}/resume`, {}),
  askQuestion: (sessionId, question) => post(`/ai-tutor/sessions/${sessionId}/questions`, { question }),
  getFlashcards: (lectureId) => get(`/ai-tutor/lectures/${lectureId}/flashcards`),
  getQuiz: (lectureId) => get(`/ai-tutor/lectures/${lectureId}/quiz`),
  submitQuiz: (lectureId, answers) => post(`/ai-tutor/lectures/${lectureId}/quiz/submit`, { answers }),
  transcribeAudio: (formData) => uploadMultipart('/ai-tutor/audio/transcribe', formData),
  speakText: (data) => post('/ai-tutor/audio/speak', data),
  smokeTest: () => get('/ai-tutor/smoke-test'),
  retriggerGuidedSteps: (topicId) => post(`/ai-tutor/topics/${topicId}/guided-steps`, {}),
  // Phase 3: Memory
  getStudentMemory: (courseId, topicId) => get(`/ai-tutor/memory/${courseId}${topicId ? `?topicId=${topicId}` : ''}`),
  clearStudentMemory: (courseId) => del(`/ai-tutor/memory/${courseId}`),
  // Phase 4: Adaptive plans
  generateAdaptivePlan: (topicId, data) => post(`/ai-tutor/topics/${topicId}/adaptive`, data),
  getAdaptivePlan: (topicId) => get(`/ai-tutor/topics/${topicId}/adaptive`),
  completeAdaptivePlan: (planId) => patch(`/ai-tutor/adaptive/${planId}/complete`, {}),
  evaluateCheckpoint: (data) => post('/ai-tutor/checkpoint/evaluate', data),
};

export const memoryAPI = {
  getMemory: (courseId, topicId) => aiTutorAPI.getStudentMemory(courseId, topicId),
  clearMemory: (courseId) => aiTutorAPI.clearStudentMemory(courseId),
};

export const analyticsAPI = {
  getOverview: () => get('/analytics/overview'),
  getEngagement: (courseId) => get(`/analytics/courses/${courseId}/engagement`),
  getConfusion: (courseId) => get(`/analytics/courses/${courseId}/confusion`),
  getStudents: (courseId) => get(`/analytics/courses/${courseId}/students`),
  getTimeline: (courseId) => get(`/analytics/courses/${courseId}/timeline`),
};

export default {
  API_BASE,
  HEALTH_URL,
  get,
  post,
  put,
  del,
  patch,
  health,
  authAPI,
  instructorAPI,
  userAPI,
  categoryAPI,
  courseAPI,
  topicAPI,
  materialAPI,
  enrollmentAPI,
  quizAPI,
  certificateAPI,
  certificateTemplateAPI,
  notificationAPI,
  progressAPI,
  feedbackAPI,
  uploadAPI,
  aiChatAPI,
  aiTutorAPI,
  lectureChatAPI,
  streakAPI,
  todoAPI,
  discussionAPI,
  bulkEmailAPI,
  newsletterAPI,
  memoryAPI,
  analyticsAPI,
};
