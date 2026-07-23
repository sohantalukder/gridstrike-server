const net = require('node:net');
const { execFileSync } = require('node:child_process');
require('dotenv').config();

const TARGETS = [
  { name: 'DATABASE_URL', value: process.env.DATABASE_URL },
  { name: 'DIRECT_URL', value: process.env.DIRECT_URL },
];

function parseUrl(label, value) {
  if (!value) {
    return { label, value, error: 'missing', host: '', port: '' };
  }

  try {
    const parsed = new URL(value);
    return {
      label,
      value,
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'postgresql:' ? '5432' : ''),
      database: parsed.pathname?.replace(/^\//, '') || '<unknown>',
    };
  } catch (error) {
    return {
      label,
      value,
      error: `invalid-url: ${error.message}`,
      host: '',
      port: '',
    };
  }
}

function checkTcp({ label, host, port }) {
  if (!host || !port) {
    return Promise.resolve({ label, status: 'SKIP', reason: 'invalid host/port' });
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeoutMs = 5000;
    let settled = false;

    const done = (status, reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ label, host, port, status, reason });
    };

    const timer = setTimeout(() => {
      done('UNREACHABLE', `tcp timeout ${timeoutMs}ms`);
    }, timeoutMs);

    socket.once('connect', () => done('REACHABLE', 'tcp connect ok'));
    socket.once('error', (error) => done('UNREACHABLE', `tcp error: ${error.code || error.message}`));
    socket.connect(Number(port), host);
  });
}

function checkPrisma(label, value) {
  if (!value) {
    return Promise.resolve({ label, status: 'SKIP', reason: 'missing url' });
  }

  try {
    const output = execFileSync(
      'npx',
      ['prisma', 'db', 'execute', '--url', value, '--stdin'],
      {
        input: 'SELECT 1',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    return Promise.resolve({
      label,
      status: 'OK',
      reason: output ? output.toString().trim() || 'query ok' : 'query ok',
    });
  } catch (error) {
    const message = (error.stderr ? String(error.stderr) : String(error.message || error)).split('\n')[0] || 'unknown error';
    return Promise.resolve({
      label,
      status: 'FAILED',
      reason: message,
    });
  }
}

async function main() {
  const targets = TARGETS.map((target) => parseUrl(target.name, target.value));
  const tcpResults = await Promise.all(targets.map((target) => checkTcp(target)));

  for (const result of tcpResults) {
    const target = targets.find((item) => item.label === result.label);
    if (!target) continue;

    console.log('\n====');
    console.log(`${target.label}`);

    if (target.error) {
      console.log(`  URL: ${target.value || '<missing>'}`);
      console.log(`  Status: INVALID (${target.error})`);
      continue;
    }

    console.log(`  Host: ${target.host}`);
    console.log(`  Port: ${target.port}`);
    console.log(`  Database: ${target.database}`);
    console.log(`  TCP: ${result.status} (${result.reason})`);

    const dbResult = await checkPrisma(target.label, target.value);
    console.log(`  Prisma: ${dbResult.status} (${dbResult.reason})`);
  }

  const dbChecks = targets.map((target) => {
    if (target.error) return Promise.resolve(false);
    return checkPrisma(target.label, target.value).then((result) => result.status === 'OK');
  });
  const atLeastOneDbOk = (await Promise.all(dbChecks)).some(Boolean);

  const anyTcpReachable = tcpResults.some((r) => r.status === 'REACHABLE');
  const anyDbOk = atLeastOneDbOk;

  console.log('\nSummary:');
  console.log(`- TCP reachable: ${anyTcpReachable ? 'YES' : 'NO'}`);
  console.log(`- Prisma query success: ${anyDbOk ? 'YES' : 'NO'}`);
  console.log('Hint: if Prisma says FAILED but TCP is REACHABLE, check credentials, db name, or SSL settings.');

  if (!anyTcpReachable || !anyDbOk) {
    process.exitCode = 1;
  }
}

main();
