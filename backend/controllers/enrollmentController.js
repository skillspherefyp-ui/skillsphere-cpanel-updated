const { Enrollment, Course, User, Category, Topic, Progress } = require('../models');
const { sendEnrollmentEmail } = require('../services/emailService');

// Get all enrollments for the authenticated student
exports.getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Course,
          as: 'course',
          include: [
            { model: Category, as: 'category' },
            { model: Topic, as: 'topics', separate: true, order: [['order', 'ASC']] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Overlay per-student topic completion so global topic.completed doesn't
    // bleed across students.
    const userProgressRecords = await Progress.findAll({
      where: { userId: req.user.id },
      attributes: ['topicId', 'completed'],
    });
    const progressMap = {};
    userProgressRecords.forEach(p => { progressMap[p.topicId] = p.completed; });

    const enrollmentsWithProgress = enrollments.map(enrollment => {
      const data = enrollment.toJSON();
      if (data.course?.topics) {
        // Topics are already sorted order ASC by the query
        data.course.topics = data.course.topics.map((topic, index, arr) => ({
          ...topic,
          completed: progressMap[topic.id] === true,
          // First topic always unlocked; each next topic unlocks when the
          // student has a completed Progress record for the one before it.
          status: index === 0
            ? 'unlocked'
            : (progressMap[arr[index - 1].id] === true ? 'unlocked' : 'locked'),
        }));
      }
      return data;
    });

    res.json({ success: true, enrollments: enrollmentsWithProgress });
  } catch (error) {
    console.error('Get my enrollments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Enroll in a course
exports.enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // Check if course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if already enrolled
    const existing = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Check prerequisites
    if (course.prerequisiteIds && course.prerequisiteIds.length > 0) {
      const completedEnrollments = await Enrollment.findAll({
        where: { userId: req.user.id, courseId: course.prerequisiteIds, progressPercentage: 100 }
      });
      const completedIds = completedEnrollments.map(e => e.courseId);
      const missing = course.prerequisiteIds.filter(pid => !completedIds.includes(pid));
      if (missing.length > 0) {
        const prereqCourses = await Course.findAll({ where: { id: missing }, attributes: ['id', 'name'] });
        return res.status(400).json({ error: 'Prerequisites not completed', prerequisites: prereqCourses });
      }
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      userId: req.user.id,
      courseId,
      status: 'enrolled'
    });

    // Send enrollment confirmation email (fire-and-forget)
    sendEnrollmentEmail(req.user.email, req.user.name, course).catch(err =>
      console.error('Enrollment email failed:', err.message)
    );

    res.status(201).json({ success: true, enrollment });
  } catch (error) {
    console.error('Enroll in course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unenroll from a course
exports.unenrollFromCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Delete related progress records
    await Progress.destroy({
      where: {
        userId: req.user.id,
        courseId
      }
    });

    await enrollment.destroy();

    res.json({ success: true, message: 'Unenrolled successfully' });
  } catch (error) {
    console.error('Unenroll from course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if enrolled in a course
exports.checkEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId
      }
    });

    res.json({
      success: true,
      enrolled: !!enrollment,
      enrollment: enrollment || null
    });
  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateEnrollmentProgress = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    const enrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Compute progress server-side — ignore any client-supplied progress value
    const totalTopics = await Topic.count({ where: { courseId } });
    const completedTopics = await Progress.count({
      where: { userId: req.user.id, courseId, completed: true }
    });
    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    enrollment.progressPercentage = progress;
    enrollment.status = progress >= 100
      ? 'completed'
      : progress > 0
        ? 'in-progress'
        : 'enrolled';
    enrollment.completedAt = progress >= 100 ? new Date() : null;
    await enrollment.save();

    res.json({ success: true, enrollment });
  } catch (error) {
    console.error('Update enrollment progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = exports;
