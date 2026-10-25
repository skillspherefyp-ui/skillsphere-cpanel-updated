const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const courseRecommendationController = require('../controllers/courseRecommendationController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Read operations - publicly accessible (no authentication required)
// optionalAuth attaches req.user when a valid JWT is present so per-student
// topic progress can be overlaid without blocking unauthenticated requests.
router.get('/', optionalAuth, courseController.getAllCourses);
router.get('/top', courseController.getTopCourses);   // must be before /:id
router.get('/stats', courseController.getPublicStats); // must be before /:id
router.get('/recommendations', authenticateToken, courseRecommendationController.getRecommendations); // must be before /:id
router.get('/:id', courseController.getCourseById);

// Write operations - require authentication
router.post('/', authenticateToken, courseController.createCourse);
router.put('/:id', authenticateToken, courseController.updateCourse);
router.delete('/:id', authenticateToken, courseController.deleteCourse);
router.patch('/:id/publish', authenticateToken, courseController.publishCourse);
router.patch('/:id/prerequisites', authenticateToken, courseController.setPrerequisites);

module.exports = router;



