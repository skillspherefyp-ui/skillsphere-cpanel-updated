const { Feedback, Course, User } = require('../models');
const { Op } = require('sequelize');

exports.createFeedback = async (req, res) => {
  try {
    if (!['student', 'instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only students can submit feedback' });
    }

    const { courseName, feedback, rating, courseId } = req.body;

    if (!feedback || !rating) {
      return res.status(400).json({ error: 'Feedback and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify course exists if courseId provided
    if (courseId) {
      const course = await Course.findByPk(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
    }

    const feedbackRecord = await Feedback.create({
      courseName: courseName || '',
      studentName: req.user.name,
      userId: req.user.id,
      feedback,
      rating,
      courseId: courseId || null
    });

    res.status(201).json({ success: true, feedback: feedbackRecord });
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllFeedback = async (req, res) => {
  try {
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only instructors can view feedback' });
    }

    const feedbacks = await Feedback.findAll({
      include: [{ model: Course, as: 'course', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, feedbacks });
  } catch (error) {
    console.error('Get feedbacks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getFeedbackById = async (req, res) => {
  try {
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only instructors can view feedback' });
    }

    const { id } = req.params;

    const feedback = await Feedback.findByPk(id, {
      include: [{ model: Course, as: 'course' }]
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateFeedback = async (req, res) => {
  try {
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only instructors can update feedback' });
    }

    const { id } = req.params;
    const { courseName, feedback, rating } = req.body;

    const feedbackRecord = await Feedback.findByPk(id);

    if (!feedbackRecord) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    if (courseName) feedbackRecord.courseName = courseName;
    if (feedback) feedbackRecord.feedback = feedback;
    if (rating && rating >= 1 && rating <= 5) feedbackRecord.rating = rating;

    await feedbackRecord.save();

    res.json({ success: true, feedback: feedbackRecord });
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getFeedbackByCourse = async (req, res) => {
  try {
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only instructors can view feedback' });
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const courseWhere = {};
    if (search) courseWhere.name = { [Op.like]: `%${search}%` };
    // Non-admin instructors only see their own courses
    if (req.user.role === 'instructor') courseWhere.userId = req.user.id;

    // Get courses that have at least one feedback
    const { count, rows: courses } = await Course.findAndCountAll({
      where: courseWhere,
      include: [
        {
          model: Feedback,
          as: 'feedbacks',
          required: true,
          attributes: ['id', 'studentName', 'userId', 'rating', 'feedback', 'createdAt'],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const result = courses.map(c => {
      const fbs = c.feedbacks || [];
      const avgRating = fbs.length > 0
        ? (fbs.reduce((s, f) => s + f.rating, 0) / fbs.length).toFixed(1)
        : 0;
      return {
        id: c.id,
        name: c.name,
        thumbnailImage: c.thumbnailImage,
        status: c.status,
        feedbackCount: fbs.length,
        avgRating: parseFloat(avgRating),
        feedbacks: fbs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      };
    });

    res.json({ success: true, courses: result, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (error) {
    console.error('Get feedback by course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.checkMyFeedback = async (req, res) => {
  try {
    const { courseId } = req.params;
    const existing = await Feedback.findOne({
      where: { userId: req.user.id, courseId }
    });
    res.json({ submitted: !!existing });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only instructors can delete feedback' });
    }

    const { id } = req.params;

    const feedback = await Feedback.findByPk(id);

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await feedback.destroy();

    res.json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


