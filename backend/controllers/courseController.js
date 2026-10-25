const { Course, Category, Topic, Material, Enrollment, Quiz, Progress } = require('../models');
const { Op } = require('sequelize');
const { extractTextFromPdf } = require('../utils/pdfExtractor');

// Trigger background PDF text extraction for an array of newly created Material instances
// Retries up to 3 times so transient Cloudinary/network errors don't leave extractedText null
async function extractWithRetry(m, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const text = await extractTextFromPdf(m.uri);
      if (text) {
        await m.update({ extractedText: text });
        return;
      }
    } catch (err) {
      if (attempt === retries) {
        console.error(`PDF extraction failed for material ${m.id} after ${retries} attempts:`, err.message);
      } else {
        // Brief back-off before next retry
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
  }
}

function triggerPdfExtraction(createdMaterials) {
  for (const m of createdMaterials) {
    if (m.type === 'pdf' && m.uri) {
      extractWithRetry(m);
    }
  }
}

function ensureCourseAuthoringAccess(user, course = null) {
  const isAdmin = user.role === 'admin';
  const isInstructor = user.role === 'instructor';
  const canManageAll = user.permissions?.canManageAllCourses === true;
  const isOwner = course ? course.userId === user.id : false;

  if (!isAdmin && !isInstructor) {
    return 'Only instructors can manage courses';
  }

  if (course && !isAdmin && !isOwner && !canManageAll) {
    return 'You do not have permission to manage this course';
  }

  return null;
}

// Get top N published courses by enrollment count (public)
exports.getTopCourses = async (req, res) => {
  try {
    const { User } = require('../models');
    const limit = parseInt(req.query.limit) || 3;

    const courses = await Course.findAll({
      where: { status: 'published' },
      include: [
        { model: Category, as: 'category' },
        { model: User, as: 'user', attributes: ['id', 'name'] }
      ]
    });

    // Count enrollments per course, then sort and slice
    const coursesWithCount = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.count({ where: { courseId: course.id } });
        const data = course.toJSON();
        data.enrollmentCount = enrollmentCount;
        return data;
      })
    );

    const top = coursesWithCount
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, limit);

    res.json({ success: true, courses: top });
  } catch (error) {
    console.error('Get top courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { name, description, level, language, categoryId, duration, materials, thumbnailImage, creationMode, prerequisiteIds, lectureSettings } = req.body;

    const accessError = ensureCourseAuthoringAccess(req.user);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    console.log('📝 Creating course...');
    console.log('🖼️  Received thumbnailImage:', thumbnailImage);

    if (!name || !description || !level || !language || !categoryId || !duration) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Verify category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const courseToCreate = {
      name,
      description,
      level,
      language,
      categoryId,
      duration,
      status: 'draft',
      userId: req.user.id,
      thumbnailImage: thumbnailImage || null,
      creationMode: creationMode || 'ai',
      prerequisiteIds: Array.isArray(prerequisiteIds) ? prerequisiteIds : [],
      lectureSettings: lectureSettings && typeof lectureSettings === 'object' ? lectureSettings : null,
    };

    console.log('💾 Creating course in database with:', courseToCreate);

    const course = await Course.create(courseToCreate);

    // Add materials if provided
    if (materials && Array.isArray(materials) && materials.length > 0) {
      const courseMaterials = materials.map(material => ({
        ...material,
        courseId: course.id
      }));
      const createdMaterials = await Material.bulkCreate(courseMaterials, { returning: true });
      triggerPdfExtraction(createdMaterials);
    }

    const createdCourse = await Course.findByPk(course.id, {
      include: [
        { model: Category, as: 'category' },
        { model: Material, as: 'materials' }
      ]
    });

    console.log('✅ Course created successfully with ID:', course.id);
    console.log('🖼️  Saved thumbnailImage:', createdCourse.thumbnailImage);

    res.status(201).json({ success: true, course: createdCourse });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const { User } = require('../models');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();
    const category = req.query.category?.trim();
    const level = req.query.level?.trim();
    const sort = req.query.sort || 'newest';

    const instructorId = req.query.instructorId?.trim();

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (level && level !== 'All') where.level = level;
    if (req.query.status) where.status = req.query.status;

    // Server-side enforcement: if an authenticated non-admin provides instructorId,
    // ignore it and force filter to their own courses to prevent seeing others' courses.
    if (instructorId) {
      const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);
      where.userId = isAdmin ? instructorId : (req.user ? req.user.id : instructorId);
    }

    const categoryWhere = category && category !== 'All' ? { name: category } : undefined;

    const orderMap = {
      newest: [['createdAt', 'DESC']],
      oldest: [['createdAt', 'ASC']],
      'name-asc': [['name', 'ASC']],
      'name-desc': [['name', 'DESC']],
    };
    const order = orderMap[sort] || [['createdAt', 'DESC']];

    const { count, rows: courses } = await Course.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', ...(categoryWhere ? { where: categoryWhere } : {}) },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role']
        },
        {
          model: Topic,
          as: 'topics',
          include: [
            { model: Material, as: 'materials' },
            { model: Quiz, as: 'quizzes' }
          ],
          separate: true,
          order: [['order', 'ASC']]
        },
        { model: Material, as: 'materials' }
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    // Sort by popularity after fetch (enrollment count requires separate query)
    const coursesWithEnrollment = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.count({ where: { courseId: course.id } });
        const courseData = course.toJSON();
        courseData.enrollmentCount = enrollmentCount;
        return courseData;
      })
    );

    if (sort === 'popular') {
      coursesWithEnrollment.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    }

    // If the caller is authenticated, overlay per-student topic completion AND
    // lock/unlock status so one student's progress never bleeds into another's.
    if (req.user) {
      const userProgressRecords = await Progress.findAll({
        where: { userId: req.user.id },
        attributes: ['topicId', 'completed'],
      });
      const progressMap = {};
      userProgressRecords.forEach(p => { progressMap[p.topicId] = p.completed; });

      coursesWithEnrollment.forEach(course => {
        const topics = course.topics || [];
        // Topics are already sorted order ASC by the query
        topics.forEach((topic, index) => {
          topic.completed = progressMap[topic.id] === true;
          // First topic is always unlocked; each subsequent topic unlocks only
          // when the student has completed the one before it.
          if (index === 0) {
            topic.status = 'unlocked';
          } else {
            topic.status = progressMap[topics[index - 1].id] === true ? 'unlocked' : 'locked';
          }
        });
      });
    }

    res.json({
      success: true,
      courses: coursesWithEnrollment,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const { User } = require('../models');
    const { id } = req.params;

    const course = await Course.findByPk(id, {
      include: [
        { model: Category, as: 'category' },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role']
        },
        {
          model: Topic,
          as: 'topics',
          include: [
            { model: Material, as: 'materials' },
            { model: Quiz, as: 'quizzes' }
          ],
          separate: true,
          order: [['order', 'ASC']]
        },
        { model: Material, as: 'materials' }
      ]
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get enrollment count for this course
    const enrollmentCount = await Enrollment.count({
      where: { courseId: course.id }
    });

    const courseData = course.toJSON();
    courseData.enrollmentCount = enrollmentCount;

    res.json({ success: true, course: courseData });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, level, language, categoryId, duration, status, thumbnailImage, creationMode, prerequisiteIds, lectureSettings } = req.body;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const accessError = ensureCourseAuthoringAccess(req.user, course);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      course.categoryId = categoryId;
    }

    if (name) course.name = name;
    if (description) course.description = description;
    if (level) course.level = level;
    if (language) course.language = language;
    if (duration) course.duration = duration;
    if (status) course.status = status;
    if (thumbnailImage !== undefined) course.thumbnailImage = thumbnailImage;
    if (creationMode) course.creationMode = creationMode;
    if (prerequisiteIds !== undefined) course.prerequisiteIds = Array.isArray(prerequisiteIds) ? prerequisiteIds : [];
    if (lectureSettings !== undefined) course.lectureSettings = (lectureSettings && typeof lectureSettings === 'object') ? lectureSettings : null;

    await course.save();

    // Replace course-level materials if provided in request
    const { materials: incomingMaterials } = req.body;
    if (incomingMaterials !== undefined && Array.isArray(incomingMaterials)) {
      // Remove existing course-level materials (topicId is null)
      await Material.destroy({ where: { courseId: id, topicId: null } });
      if (incomingMaterials.length > 0) {
        const courseMaterials = incomingMaterials.map(material => ({
          ...material,
          courseId: id,
          topicId: null,
        }));
        const createdMaterials = await Material.bulkCreate(courseMaterials, { returning: true });
        triggerPdfExtraction(createdMaterials);
      }
    }

    const { User } = require('../models');
    const updatedCourse = await Course.findByPk(id, {
      include: [
        { model: Category, as: 'category' },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role']
        },
        {
          model: Topic,
          as: 'topics',
          include: [
            { model: Material, as: 'materials' },
            { model: Quiz, as: 'quizzes' }
          ],
          separate: true,
          order: [['order', 'ASC']]
        },
        { model: Material, as: 'materials' }
      ]
    });

    res.json({ success: true, course: updatedCourse });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const accessError = ensureCourseAuthoringAccess(req.user, course);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    // Preserve issued certificates — null out courseId so they survive course deletion
    try {
      const { Certificate } = require('../models');
      await Certificate.update(
        { courseId: null },
        { where: { courseId: id } }
      );
    } catch (certErr) {
      // Column may still be NOT NULL (migration not yet run) — proceed with deletion anyway
      console.warn('Could not preserve certificates before course deletion:', certErr.message);
    }

    // Manually delete related records first
    // Delete materials associated with topics of this course
    const topics = await Topic.findAll({ where: { courseId: id } });
    for (const topic of topics) {
      await Material.destroy({ where: { topicId: topic.id } });
    }

    // Delete materials directly associated with this course
    await Material.destroy({ where: { courseId: id } });

    // Delete all topics of this course
    await Topic.destroy({ where: { courseId: id } });

    // Delete course itself
    await course.destroy();

    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.setPrerequisites = async (req, res) => {
  try {
    const { id } = req.params;
    const { prerequisiteIds } = req.body;
    const course = await Course.findByPk(id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const accessError = ensureCourseAuthoringAccess(req.user, course);
    if (accessError) return res.status(403).json({ error: accessError });
    course.prerequisiteIds = Array.isArray(prerequisiteIds) ? prerequisiteIds : [];
    await course.save();
    res.json({ success: true, course });
  } catch (error) {
    console.error('Set prerequisites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getPublicStats = async (req, res) => {
  try {
    const { User } = require('../models');
    const { Op } = require('sequelize');

    const [totalStudents, totalCourses, totalInstructors, totalEnrollments, completedEnrollments] = await Promise.all([
      User.count({ where: { role: 'student', isActive: true } }),
      Course.count({ where: { status: 'published' } }),
      User.count({ where: { role: { [Op.in]: ['instructor', 'expert'] }, isActive: true } }),
      Enrollment.count(),
      Enrollment.count({ where: { status: 'completed' } }),
    ]);

    const completionRate = totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0;

    res.json({
      success: true,
      stats: { totalStudents, totalCourses, totalInstructors, completionRate },
    });
  } catch (error) {
    console.error('Get public stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.publishCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const accessError = ensureCourseAuthoringAccess(req.user, course);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    course.status = 'published';
    await course.save();

    res.json({ success: true, message: 'Course published successfully', course });
  } catch (error) {
    console.error('Publish course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

