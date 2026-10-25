const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Traditional auth routes
router.post('/login', authLimiter, authController.login);
router.post('/register', authLimiter, authController.register);
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/change-password', authenticateToken, authController.changePassword);

// OTP verification routes (for signup)
router.post('/send-otp', authLimiter, authController.sendOTP);
router.post('/verify-otp', authLimiter, authController.verifyOTP);
router.post('/resend-otp', authLimiter, authController.resendOTP);
router.post('/complete-registration', authLimiter, authController.completeRegistration);

// OTP login routes (for existing users)
router.post('/send-login-otp', authLimiter, authController.sendLoginOTP);
router.post('/login-with-otp', authLimiter, authController.loginWithOTP);

// Password reset routes
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/verify-signup-otp', authLimiter, authController.verifySignupOTP);

// Google OAuth route
router.post('/google-auth', authLimiter, authController.googleAuth);

// Privacy Policy routes (requires authentication)
router.post('/accept-privacy-policy', authenticateToken, authController.acceptPrivacyPolicy);
router.get('/privacy-policy-status', authenticateToken, authController.getPrivacyPolicyStatus);

module.exports = router;

