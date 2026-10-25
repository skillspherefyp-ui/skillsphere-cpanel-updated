const express = require('express');
const path = require('path');
const helmet = require('helmet');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { sequelize, testConnection } = require('./config/database');
require('./models');
const { User, Notification } = require('./models');
const { sendAdminWelcomeEmail } = require('./services/emailService');
const syncCourseColumns = require('./scripts/syncCourseColumns');
const syncAITutorColumns = require('./scripts/syncAITutorColumns');

const authRoutes = require('./routes/authRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const courseRoutes = require('./routes/courseRoutes');
const topicRoutes = require('./routes/topicRoutes');
const materialRoutes = require('./routes/materialRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const quizRoutes = require('./routes/quizRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const certificateTemplateRoutes = require('./routes/certificateTemplateRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiChatRoutes = require('./routes/aiChatRoutes');
const aiTutorRoutes = require('./routes/aiTutorRoutes');
const lectureChatRoutes = require('./routes/lectureChatRoutes');
const streakRoutes = require('./routes/streakRoutes');
const todoRoutes = require('./routes/todoRoutes');
const discussionRoutes = require('./routes/discussionRoutes');
const contactRoutes = require('./routes/contactRoutes');
const blogRoutes = require('./routes/blogRoutes');
const bulkEmailRoutes = require('./routes/bulkEmailRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const aiClassroomRoutes = require('./routes/aiClassroomRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { initScheduledReminders } = require('./controllers/todoController');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (cPanel/Nginx)
const PORT = process.env.PORT || 5000;

function normalizeOrigin(origin) {
  return `${origin || ''}`
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\/$/, '');
}

function parseAllowedOrigins(value) {
  return `${value || ''}`
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

function buildAllowedOrigins() {
  return Array.from(new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:19006',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:19006',
    'http://10.0.2.2:3000',
    'http://10.0.2.2:3001',
    'http://10.0.2.2:19006',
    normalizeOrigin(process.env.FRONTEND_URL),
    ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  ].filter(Boolean)));
}

function isPrivateNetworkOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin);
}

const allowedOrigins = buildAllowedOrigins();
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

async function initAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Admin';

    if (!adminEmail || !adminPassword) {
      console.log('ADMIN_EMAIL or ADMIN_PASSWORD not set in .env - skipping admin creation');
      return;
    }

    const existingAdmin = await User.findOne({ where: { role: 'admin' } });

    if (!existingAdmin) {
      const admin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        authProvider: 'local'
      });
      console.log('Admin created successfully');
      console.log(`Email: ${adminEmail}`);

      try {
        await sendAdminWelcomeEmail(adminEmail, adminName, adminPassword);
        console.log('Welcome email sent to Admin');
        await Notification.create({
          userId: admin.id,
          title: 'Admin Account Created',
          message: 'Your SkillSphere Admin account is ready. Check your email for login credentials.',
          type: 'info',
        });
      } catch (emailError) {
        console.log('Could not send welcome email:', emailError.message);
      }
    } else {
      console.log('Admin already exists');
    }
  } catch (error) {
    console.error('Error creating Admin:', error.message);
  }
}

app.use(helmet());

app.use((req, res, next) => {
  const requestOrigin = normalizeOrigin(req.headers.origin);

  res.header('Vary', 'Origin');

  if (!requestOrigin) {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(corsOptions.optionsSuccessStatus);
    }
    return next();
  }

  if (
    !allowedOrigins.includes(requestOrigin) &&
    !isPrivateNetworkOrigin(requestOrigin)
  ) {
    console.log('CORS blocked origin:', requestOrigin);

    if (req.method === 'OPTIONS') {
      return res.status(403).json({ error: 'Not allowed by CORS' });
    }

    return res.status(403).json({ error: 'Not allowed by CORS' });
  }

  res.header('Access-Control-Allow-Origin', requestOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));

  if (req.method === 'OPTIONS') {
    return res.sendStatus(corsOptions.optionsSuccessStatus);
  }

  return next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.replace(/\/$/, '')
    : null;
  if (!frontendUrl) {
    return res.json({ status: 'OK', message: 'SkillSphere API — set FRONTEND_URL in .env to enable redirect' });
  }
  res.redirect(frontendUrl);
});

app.use('/api/auth', authRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/certificate-templates', certificateTemplateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/ai-tutor', aiTutorRoutes);
app.use('/api/lecture-chat', lectureChatRoutes);
app.use('/api/streak', streakRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/bulk-email', bulkEmailRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ai-classroom', aiClassroomRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await testConnection();
    await syncCourseColumns();
    const aiTutorSchemaSummary = await syncAITutorColumns();
    console.log('AI Tutor schema compatibility sync completed:', JSON.stringify(aiTutorSchemaSummary));
    // Capture ALTER TABLE queries during sync to report schema changes
    const schemaChanges = [];
    await sequelize.sync({
      alter: { drop: false },
      logging: (sql) => {
        if (/ALTER TABLE/i.test(sql)) {
          const match = sql.match(/ALTER TABLE `(\w+)`/i);
          const table = match ? match[1] : 'unknown';
          if (!schemaChanges.includes(table)) schemaChanges.push(table);
        }
      },
    });

    // Fix materials.extractedText charset to support non-Latin text (Urdu, Arabic, etc.)
    try {
      await sequelize.query(
        'ALTER TABLE materials MODIFY COLUMN extractedText LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
      );
      console.log('✅ materials.extractedText charset ensured (utf8mb4)');
    } catch (e) {
      // Ignore if already correct or table doesn't exist yet
    }

    // Fix topics.title charset to support Urdu/Arabic topic titles
    try {
      await sequelize.query(
        'ALTER TABLE topics MODIFY COLUMN title VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
      );
      console.log('✅ topics.title charset ensured (utf8mb4)');
    } catch (e) {
      // Ignore if already correct or table doesn't exist yet
    }


    // Admin account check
    const adminEmail = process.env.ADMIN_EMAIL;
    const existingAdmin = adminEmail
      ? await User.findOne({ where: { role: 'admin' } })
      : null;
    const adminStatus = !adminEmail
      ? '⚠️  ADMIN_EMAIL not set — skipping admin check'
      : existingAdmin
        ? `✅ Admin account exists (${existingAdmin.email})`
        : '🆕 No admin found — creating now...';

    await initAdmin();
    await initScheduledReminders();

    app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  🚀 SkillSphere Server Started');
      console.log(`  📡 http://localhost:${PORT}/api`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  ${adminStatus}`);
      console.log('  ─────────────────────────────────────');
      if (schemaChanges.length === 0) {
        console.log('  📋 Schema: No changes');
      } else {
        console.log(`  📋 Schema changes applied to:`);
        schemaChanges.forEach(t => console.log(`     • ${t}`));
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
