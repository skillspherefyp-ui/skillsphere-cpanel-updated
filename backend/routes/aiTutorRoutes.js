const express = require('express');
const router = express.Router();
const aiTutorController = require('../controllers/aiTutorController');
const { authenticateToken } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

router.use(authenticateToken);

// DB-only routes — no AI calls, no rate limit
router.put('/topics/:topicId/outline', aiTutorController.upsertOutline);
router.get('/topics/:topicId/generate-status', aiTutorController.getTopicGenerationStatus);
router.get('/courses/:courseId/generate-status', aiTutorController.getGenerationStatus);
router.get('/courses/:courseId/lectures', aiTutorController.listLectures);
router.get('/topics/:topicId/package', aiTutorController.getLecturePackage);
router.post('/topics/:topicId/start', aiTutorController.startSession);
router.get('/sessions/:sessionId', aiTutorController.getSessionState);
router.post('/sessions/:sessionId/next', aiTutorController.getNextChunk);
router.post('/sessions/:sessionId/restart', aiTutorController.restartSession);
router.post('/sessions/:sessionId/pause', aiTutorController.pauseSession);
router.post('/sessions/:sessionId/resume', aiTutorController.resumeSession);
router.get('/lectures/:lectureId/flashcards', aiTutorController.getFlashcards);
router.get('/lectures/:lectureId/quiz', aiTutorController.getQuiz);
router.post('/lectures/:lectureId/quiz/submit', aiTutorController.submitQuiz);
router.get('/smoke-test', aiTutorController.smokeTest);
router.get('/memory/:courseId', aiTutorController.getStudentMemory);
router.delete('/memory/:courseId', aiTutorController.deleteStudentMemory);
router.get('/topics/:topicId/adaptive', aiTutorController.getAdaptivePlan);
router.patch('/adaptive/:planId/complete', aiTutorController.completeAdaptivePlan);

// AI-call routes — rate limited
router.post('/topics/:topicId/generate', aiLimiter, aiTutorController.generateTopicPackage);
router.post('/courses/:courseId/generate', aiLimiter, aiTutorController.generateCoursePackage);
router.post('/courses/:courseId/create-topics-from-outline', aiLimiter, aiTutorController.createTopicsFromOutline);
router.post('/sessions/:sessionId/questions', aiLimiter, aiTutorController.submitQuestion);
router.post('/audio/transcribe', aiLimiter, aiTutorController.audioUploadMiddleware, aiTutorController.transcribeAudio);
router.post('/audio/speak', aiLimiter, aiTutorController.speakText);
router.post('/checkpoint/evaluate', aiLimiter, aiTutorController.evaluateCheckpoint);
router.post('/topics/:topicId/guided-steps', aiLimiter, aiTutorController.retriggerGuidedSteps);
router.post('/topics/:topicId/adaptive', aiLimiter, aiTutorController.generateAdaptivePlan);

module.exports = router;
