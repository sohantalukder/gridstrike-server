const fs = require('node:fs');
const path = ' .env ';
require('dotenv').config({ path: '.env' });

const required = [
  'NODE_ENV',
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_JWKS_URL',
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
];

let hasIssue = false;

console.log('Environment audit:');
for (const key of required) {
  const value = process.env[key];
  if (!value) {
    console.log(`- ${key}: MISSING`);
    hasIssue = true;
    continue;
  }

  if (['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_JWKS_URL'].includes(key)) {
    try {
      new URL(value);
      console.log(`- ${key}: OK (${key.endsWith('URL') ? 'url' : 'db-url'})`);
    } catch (err) {
      console.log(`- ${key}: INVALID URL`);
      hasIssue = true;
    }
    continue;
  }

  if (['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].includes(key)) {
    if (value.includes('replace-with') || value.includes('changeme')) {
      console.log(`- ${key}: placeholder or weak value`);
      hasIssue = true;
    } else {
      console.log(`- ${key}: set`);
    }
    continue;
  }

  if (key === 'REDIS_PASSWORD') {
    console.log(`- ${key}: ${value ? 'set' : 'empty'}`);
    continue;
  }

  if (key === 'PORT' || key === 'REDIS_PORT') {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      console.log(`- ${key}: INVALID (${value})`);
      hasIssue = true;
    } else {
      console.log(`- ${key}: ${n}`);
    }
    continue;
  }

  console.log(`- ${key}: set`);
}

const directUrl = process.env.DIRECT_URL;
const databaseUrl = process.env.DATABASE_URL;
if (directUrl && databaseUrl) {
  try {
    const d1 = new URL(directUrl);
    const d2 = new URL(databaseUrl);
    const sameHost = d1.hostname === d2.hostname;
    console.log(`- URL relationship: same host -> ${sameHost ? 'yes' : 'no'}`);
    if (d1.port === d2.port) {
      console.log(`- URL relationship: ports match -> yes (${d1.port})`);
    } else {
      console.log(`- URL relationship: ports differ -> direct=${d1.port}, db=${d2.port}`);
    }
  } catch (_) {
    // already reported above
  }
}

if (hasIssue) {
  console.log('\nResult: ISSUES FOUND');
  process.exitCode = 1;
} else {
  console.log('\nResult: OK');
}
