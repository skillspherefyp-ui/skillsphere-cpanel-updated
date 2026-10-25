/**
 * Seed 500 test courses for pagination testing.
 *
 * Usage:
 *   cd backend
 *   node scripts/seed500Courses.js           -- create 500 courses
 *   node scripts/seed500Courses.js --clean   -- delete all seeded courses and exit
 *
 * Requirements:
 *   - At least one user with role 'instructor' or 'admin' must exist in the DB
 *   - At least one category must exist in the DB
 *   - Run `npm run seed` first if neither exists
 */

require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const Course = require('../models/Course');
const User = require('../models/User');
const Category = require('../models/Category');

const SEED_MARKER = '[SEED-TEST]';
const TOTAL = 500;

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const LANGUAGES = ['English', 'Urdu'];
const DURATIONS = ['2 hours', '4 hours', '6 hours', '8 hours', '10 hours', '12 hours', '16 hours', '20 hours'];
const CREATION_MODES = ['ai', 'manual'];

const TOPICS = [
  'JavaScript', 'Python', 'React', 'Node.js', 'Machine Learning', 'Data Science',
  'Web Development', 'Mobile Development', 'UI/UX Design', 'Cybersecurity',
  'Cloud Computing', 'DevOps', 'Database Design', 'TypeScript', 'Vue.js',
  'Angular', 'Django', 'Laravel', 'Docker', 'Kubernetes', 'GraphQL', 'REST APIs',
  'Blockchain', 'Flutter', 'Swift', 'Kotlin', 'C++', 'Java', 'PHP', 'Ruby on Rails',
  'TensorFlow', 'PyTorch', 'Computer Vision', 'NLP', 'Data Visualization',
  'Ethical Hacking', 'Linux Administration', 'AWS', 'Azure', 'Git & GitHub',
];

const ADJECTIVES = [
  'Complete', 'Advanced', 'Practical', 'Comprehensive', 'Modern', 'Professional',
  'Beginner-Friendly', 'Hands-On', 'Full-Stack', 'Zero to Hero', 'Masterclass',
  'Bootcamp', 'Essential', 'Deep Dive', 'Production-Ready',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCourse(index, userId, categoryId) {
  const topic = pick(TOPICS);
  const adj = pick(ADJECTIVES);
  const level = LEVELS[index % LEVELS.length];
  const lang = LANGUAGES[index % LANGUAGES.length];

  return {
    name: `${SEED_MARKER} ${adj} ${topic} Course #${index + 1}`,
    description: `This is a ${level.toLowerCase()} level ${lang} course on ${topic}. `
      + `It covers all essential concepts from fundamentals to advanced techniques. `
      + `Auto-generated for pagination testing. Index: ${index + 1}.`,
    level,
    language: lang,
    duration: pick(DURATIONS),
    status: index % 5 === 0 ? 'draft' : 'published', // ~80% published, ~20% draft
    categoryId,
    userId,
    creationMode: pick(CREATION_MODES),
    prerequisiteIds: [],
    lectureSettings: null,
  };
}

async function cleanSeedCourses() {
  const deleted = await Course.destroy({
    where: sequelize.literal(`name LIKE '%${SEED_MARKER}%'`),
  });
  console.log(`Deleted ${deleted} seeded test courses.`);
}

async function main() {
  const isClean = process.argv.includes('--clean');

  await testConnection();
  await sequelize.sync({ force: false });

  if (isClean) {
    await cleanSeedCourses();
    process.exit(0);
  }

  // Find a valid instructor/admin user to own the courses
  const owner = await User.findOne({
    where: { role: ['instructor', 'admin', 'superinstructor'] },
    order: [['createdAt', 'ASC']],
  });

  if (!owner) {
    console.error('No instructor or admin user found. Run `npm run seed` first to create one.');
    process.exit(1);
  }

  // Find a valid category
  const category = await Category.findOne({ order: [['id', 'ASC']] });

  if (!category) {
    console.error('No category found. Create at least one category from the admin panel first.');
    process.exit(1);
  }

  console.log(`Using owner: ${owner.name} (${owner.role}) [id=${owner.id}]`);
  console.log(`Using category: ${category.name} [id=${category.id}]`);

  // Check how many already exist
  const existing = await Course.count({
    where: sequelize.literal(`name LIKE '%${SEED_MARKER}%'`),
  });

  if (existing > 0) {
    console.log(`${existing} seeded courses already exist.`);
    console.log('Run with --clean first to remove them, then re-seed.');
    process.exit(0);
  }

  // Build all 500 records
  const records = Array.from({ length: TOTAL }, (_, i) =>
    buildCourse(i, owner.id, category.id)
  );

  console.log(`Creating ${TOTAL} test courses in batches...`);

  // Insert in batches of 50 to avoid overwhelming the DB
  const BATCH = 50;
  let created = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Course.bulkCreate(batch, { validate: false });
    created += batch.length;
    process.stdout.write(`\r  ${created}/${TOTAL} inserted...`);
  }

  console.log(`\nDone. ${created} courses created.`);

  // Quick summary
  const totalNow = await Course.count();
  const publishedNow = await Course.count({ where: { status: 'published' } });
  console.log(`\nDB totals: ${totalNow} courses total, ${publishedNow} published.`);
  console.log('\nTo clean up: node scripts/seed500Courses.js --clean');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
