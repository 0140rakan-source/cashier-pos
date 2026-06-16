const { exec } = require('child_process');
const path = require('path');
const logger = require('./logger');
const prisma = require('./prisma'); // Prisma client singleton

async function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    logger.info(`Executing command: ${command} with options: ${JSON.stringify(options)}`);
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Command failed: ${command}`, { error: error.message, stderr });
        return reject(error);
      }
      logger.info(`Command stdout:\n${stdout}`);
      if (stderr) {
        logger.warn(`Command stderr:\n${stderr}`);
      }
      resolve();
    });
  });
}

async function setupDatabase() {
  const backendDir = path.resolve(__dirname, '../..'); // Assumes dbSetup.js is in src/utils
  const prismaDir = path.join(backendDir, 'prisma');
  const seedFilePath = path.join(prismaDir, 'seed.js');

  try {
    logger.info('Attempting to connect to the database...');
    // Prisma Client connection check - this assumes DATABASE_URL is set globally or in env
    await prisma.$executeRaw`SELECT 1;`;
    logger.info('Database connection successful.');

    // --- Prisma Migrate ---
    logger.info('Running Prisma migrations...');
    // Using --name for migration, --no-seed to separate migration from seeding
    await runCommand('npx prisma migrate dev --name ph1_initial_setup --no-seed', { cwd: backendDir });
    logger.info('Prisma migrations completed.');

    // --- Prisma Seed ---
    logger.info('Seeding database with initial data...');
    // Ensure to use the correct path for seed file relative to backendDir
    await runCommand(`node ${path.relative(backendDir, seedFilePath)}`, { cwd: backendDir });
    logger.info('Database seed completed.');

    logger.info('Database setup completed successfully.');
  } catch (error) {
    logger.error('Database setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { setupDatabase };
