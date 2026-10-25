const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    // Ensure permissions object exists for instructor users
    if (user.role === 'instructor' && !user.permissions) {
      user.permissions = {
        canManageAllCourses: true,
        canManageCategories: true,
        canManageStudents: true,
        canManageCertificates: true,
        canViewFeedback: true
      };
    }

    req.user = user.toJSON();
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireInstructor = (req, res, next) => {
  if (!['instructor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Instructor access required' });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
};

// Permission checking middleware
const checkPermission = (permissionKey) => {
  return (req, res, next) => {
    // Admin always has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has permissions object
    const permissions = req.user.permissions || {};

    // Check if the specific permission is granted
    if (permissions[permissionKey] === true) {
      return next();
    }

    return res.status(403).json({
      error: 'You do not have permission to perform this action',
      requiredPermission: permissionKey
    });
  };
};

// Specific permission checkers
const canManageAllCourses = checkPermission('canManageAllCourses');
const canManageCategories = checkPermission('canManageCategories');
const canManageStudents = checkPermission('canManageStudents');
const canManageCertificates = checkPermission('canManageCertificates');
const canViewFeedback = checkPermission('canViewFeedback');

// Like authenticateToken but doesn't reject — attaches req.user if token is valid, otherwise continues
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch {
    // Ignore auth errors — treat as unauthenticated
  }
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireInstructor,
  requireStudent,
  checkPermission,
  canManageAllCourses,
  canManageCategories,
  canManageStudents,
  canManageCertificates,
  canViewFeedback
};


