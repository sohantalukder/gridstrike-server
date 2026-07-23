const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function main() {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection: OK');
  } catch (error) {
    console.error('Database connection: FAILED');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
