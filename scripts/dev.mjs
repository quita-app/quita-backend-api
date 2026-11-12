// Starts the database and the API together.
// Maven/Spring output is hidden: you see a Quita-styled loading screen, then the URLs.
// Errors are never hidden: every error line shows up raw, in red, as soon as it is logged.
//
// Usage: node scripts/dev.mjs [profile] [--no-db] [--port=8080] [--url=http://host:port]
// Env:   SPRING_PROFILE, API_PORT, API_URL, HEALTH_PATH, DB_COMMAND (MAVEN_ARGS is read by Maven itself)
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const READY_TIMEOUT_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;
const LOG_LINES_KEPT = 40;
const TAIL_LINES_SHOWN = 30;
const ERROR_FLUSH_MS = 150; // groups a burst of error lines (a stack trace) into one block

// Quita palette (design/DESIGN.md): sky is the signature, mint celebrates, the rest is neutral.
const SKY = '#8DB0F7';
const MINT = '#91E6BE';
const MUTED = '#9AA8BD';
const TEXT = '#EEF3FA';
const ERROR = '#EB827B';

// ── options: argument first, then env var, then default; nothing assumes the local profile ──
const args = process.argv.slice(2);
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const profile = args.find((arg) => !arg.startsWith('--')) ?? process.env.SPRING_PROFILE ?? 'local';
const skipDb = args.includes('--no-db');
const port = flag('port') ?? process.env.API_PORT; // unset: the port from the profile's config
const apiUrl = flag('url') ?? process.env.API_URL ?? `http://localhost:${port ?? 8080}`;
const healthUrl = `${apiUrl}${process.env.HEALTH_PATH ?? '/actuator/health'}`;
const dbCommand = (process.env.DB_COMMAND ?? 'docker compose up -d --wait').split(' ');

const root = fileURLToPath(new URL('..', import.meta.url));
const mvnw = process.platform === 'win32' ? 'mvnw.cmd' : join(root, 'mvnw');
const mvnArgs = [
  'spring-boot:run',
  `-Dspring-boot.run.profiles=${profile}`,
  ...(port ? [`-Dspring-boot.run.arguments=--server.port=${port}`] : []),
];

// ── terminal helpers (same as quita-backoffice-web/scripts/dev.mjs) ─────────
const out = process.stdout;
const fancy = out.isTTY && !process.env.NO_COLOR;

const paint = (hex, text, { bold = false, underline = false } = {}) => {
  if (!fancy) return text;
  const n = parseInt(hex.slice(1), 16);
  const style = `${bold ? '1;' : ''}${underline ? '4;' : ''}`;
  return `\x1b[${style}38;2;${n >> 16};${(n >> 8) & 255};${n & 255}m${text}\x1b[0m`;
};

// The Quita symbol (design/brand/simbolo): a "q" whose stem ends in a check.
// Drawn from the same geometry as the SVG (viewBox 4.5 1.5 94 94, stroke 13), then turned into
// half-block characters: two pixel rows per text row, so pixels stay square.
const SYMBOL_PIXELS = 28;
const STROKE_RADIUS = 6.5;

const distanceToSegment = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
};

const symbolPixel = (col, row) => {
  const x = 4.5 + ((col + 0.5) * 94) / SYMBOL_PIXELS;
  const y = 1.5 + ((row + 0.5) * 94) / SYMBOL_PIXELS;
  const bowl = Math.abs(Math.hypot(x - 42, y - 42) - 24) <= STROKE_RADIUS;
  const stem = distanceToSegment(x, y, 66, 42, 66, 75) <= STROKE_RADIUS;
  const check = distanceToSegment(x, y, 66, 75, 85, 57) <= STROKE_RADIUS;
  if (bowl || stem) return SKY;
  return check ? MINT : null; // the check is the mint accent
};

const rgbCode = (hex, background = false) => {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[${background ? 48 : 38};2;${n >> 16};${(n >> 8) & 255};${n & 255}m`;
};

const symbolCell = (top, bottom) => {
  if (!top && !bottom) return ' ';
  if (top === bottom) return `${rgbCode(top)}█\x1b[0m`;
  if (!bottom) return `${rgbCode(top)}▀\x1b[0m`;
  if (!top) return `${rgbCode(bottom)}▄\x1b[0m`;
  return `${rgbCode(top)}${rgbCode(bottom, true)}▀\x1b[0m`;
};

const SYMBOL = [];
if (fancy) {
  for (let row = 0; row < SYMBOL_PIXELS; row += 2) {
    let line = '';
    for (let col = 0; col < SYMBOL_PIXELS; col++) {
      line += symbolCell(symbolPixel(col, row), symbolPixel(col, row + 1));
    }
    if (line.trim()) SYMBOL.push(`  ${line}`); // the symbol does not fill the whole viewBox
  }
  SYMBOL.push('');
}

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const header = (suffix = '') => `  ${paint(SKY, 'quita', { bold: true })} ${paint(MUTED, `api${suffix}`)}`;
const rule = `  ${paint(MUTED, '─'.repeat(40))}`;

let drawn = 0;
const draw = (lines) => {
  if (!fancy) return;
  if (drawn) out.write(`\x1b[${drawn}A`);
  for (const line of lines) out.write(`\x1b[2K${line}\n`);
  drawn = lines.length;
};
const clearDrawn = () => {
  if (fancy && drawn) out.write(`\x1b[${drawn}A\x1b[0J`);
  drawn = 0;
};
const showCursor = (visible) => fancy && out.write(visible ? '\x1b[?25h' : '\x1b[?25l');

// ── errors: shown raw, never translated ─────────────────────────────────────
// A line that looks like an error opens a block; the block keeps every following line
// (stack trace, Spring's Description/Action) until a normal Spring or Maven log line.
// case-insensitive on purpose: a false alarm is better than a hidden error
const ERROR_LINE = /\b(error|fatal|failed|failure)\b|exception|caused by/i;
// Spring's own line: proves the API answering the health check is the one this script started
const STARTED_LINE = /\bStarted \S+ in [\d.]+ seconds\b/;
let started = false;
const NORMAL_LINE = /^(\d{4}-\d{2}-\d{2}T\S+\s+(TRACE|DEBUG|INFO|WARN)\b|\[(INFO|WARNING)\])/;
let inErrorBlock = false;
const isErrorLine = (line) => {
  if (ERROR_LINE.test(line)) inErrorBlock = true;
  else if (NORMAL_LINE.test(line)) inErrorBlock = false;
  return inErrorBlock;
};

let pendingErrors = [];
let flushTimer;

const flushErrors = () => {
  clearTimeout(flushTimer);
  if (!pendingErrors.length) return;
  clearDrawn(); // the loading screen is redrawn below the block on the next frame
  const bar = paint(ERROR, '│', { bold: true });
  console.log(`\n  ${paint(ERROR, '✗ erro', { bold: true })}`);
  for (const line of pendingErrors) console.log(`  ${bar} ${paint(ERROR, line)}`);
  console.log();
  pendingErrors = [];
};
const reportError = (line) => {
  pendingErrors.push(line);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushErrors, ERROR_FLUSH_MS);
};

const logTail = [];
const onLogLine = (line) => {
  if (line.trim()) logTail.push(line);
  logTail.splice(0, Math.max(0, logTail.length - LOG_LINES_KEPT));
  if (STARTED_LINE.test(line)) started = true;
  if (isErrorLine(line)) reportError(line);
};

// ── processes (hidden) ──────────────────────────────────────────────────────
const children = [];

const start = (command, commandArgs, onLine) => {
  // a .cmd needs cmd.exe; calling it directly keeps shell: false, so no DEP0190 warning
  const [file, fileArgs] = command.endsWith('.cmd')
    ? ['cmd.exe', ['/d', '/c', command, ...commandArgs]]
    : [command, commandArgs];
  const child = spawn(file, fileArgs, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  createInterface({ input: child.stdout }).on('line', onLine);
  createInterface({ input: child.stderr }).on('line', onLine);
  child.on('error', (error) => reportError(`${command}: ${error.message}`));
  children.push(child);
  return child;
};

// resolves with the exit code once the process ended and its output was read
const closed = (child) => new Promise((resolve) => child.on('close', (code) => resolve(code ?? 1)));

const stopAll = () => {
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    // on Windows kill() does not reach the JVM that Maven forked: end the whole tree
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill();
    }
  }
};

let finished = false;
let stopping = false;
let spinnerTimer;

const fail = (message, tail = []) => {
  if (finished) return;
  finished = true;
  clearInterval(spinnerTimer);
  reportError(message);
  flushErrors();
  showCursor(true);
  if (tail.length) {
    console.log(paint(MUTED, `  Últimas ${tail.length} linhas do log:\n`));
    for (const line of tail) console.log(line);
    console.log();
  }
  stopAll();
  setTimeout(() => process.exit(1), 300);
};

process.on('SIGINT', () => {
  stopping = true;
  showCursor(true);
  stopAll();
  process.exit(0);
});

// ── loading screen ──────────────────────────────────────────────────────────
const STEPS = [
  { name: 'Banco', hint: 'subindo o PostgreSQL', state: 'run' },
  { name: 'API', hint: `subindo o Spring (perfil ${profile})`, state: 'wait' },
];
const WIDTH = Math.max(...STEPS.map((step) => step.name.length), 'Health'.length);

const setStep = (index, state) => {
  STEPS[index].state = state;
  if (!fancy && state !== 'run') console.log(`  ${STEPS[index].name}: ${state === 'skip' ? 'pulado' : 'pronto'}`);
};

const stepLine = (step, frame) => {
  const name = paint(TEXT, step.name.padEnd(WIDTH));
  if (step.state === 'done') return `  ${paint(MINT, '✓')} ${name}  ${paint(MUTED, 'pronto')}`;
  if (step.state === 'skip') return `  ${paint(MUTED, '–')} ${name}  ${paint(MUTED, 'pulado (--no-db)')}`;
  if (step.state === 'wait') return `  ${paint(MUTED, '·')} ${name}  ${paint(MUTED, 'aguardando')}`;
  return `  ${paint(SKY, frame)} ${name}  ${paint(MUTED, step.hint)}`;
};

// returns the health body, or null while the API does not answer
const health = async () => {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
    return await response.json();
  } catch {
    return null;
  }
};

const printReady = (startedAt, body) => {
  clearInterval(spinnerTimer);
  flushErrors();
  clearDrawn();
  showCursor(true);

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const link = (url, strong = false) => paint(SKY, url, { bold: strong, underline: true });

  console.log(`\n${SYMBOL.join('\n')}${SYMBOL.length ? '\n' : ''}${header(`  ·  pronto em ${seconds}s`)}\n${rule}\n`);
  console.log(`  ${paint(MINT, '➜', { bold: true })} ${paint(TEXT, 'API'.padEnd(WIDTH), { bold: true })}  ${link(apiUrl, true)}  ${paint(MUTED, `perfil ${profile}`)}`);
  console.log(`    ${paint(TEXT, 'Health'.padEnd(WIDTH))}  ${link(healthUrl)}`);
  const db = body.components?.db?.status ?? 'sem componente db';
  const dbStatus = db === 'UP' ? paint(MINT, '● UP') : paint(ERROR, `○ ${db}`);
  console.log(`    ${paint(TEXT, 'Banco'.padEnd(WIDTH))}  ${dbStatus}  ${paint(MUTED, skipDb ? '(--no-db: não subido por este script)' : dbCommand.join(' '))}`);
  console.log(`\n  ${paint(MUTED, 'Ctrl+C para parar tudo. Erros da API aparecem aqui embaixo.')}\n`);
};

// ── run ─────────────────────────────────────────────────────────────────────
const main = async () => {
  const startedAt = Date.now();
  showCursor(false);
  console.log();
  if (fancy) {
    spinnerTimer = setInterval(() => {
      const frame = SPINNER[Math.floor(Date.now() / 80) % SPINNER.length];
      draw([...SYMBOL, header(), rule, ...STEPS.map((step) => stepLine(step, frame)), '']);
    }, 80);
  } else {
    console.log(`quita api: subindo (perfil ${profile}), aguarde...`);
  }

  if (skipDb) {
    setStep(0, 'skip');
  } else {
    const dbOutput = [];
    const code = await closed(start(dbCommand[0], dbCommand.slice(1), (line) => dbOutput.push(line)));
    if (code !== 0) {
      dbOutput.forEach(reportError);
      return fail(`${dbCommand.join(' ')} encerrou com código ${code}.`);
    }
    setStep(0, 'done');
  }

  setStep(1, 'run');
  const api = start(mvnw, mvnArgs, onLogLine);
  let ready = false;
  closed(api).then((code) => {
    if (stopping || finished) return;
    if (code !== 0 || !ready) {
      // the tail always goes along: an error the patterns missed still shows up
      fail(`${mvnw} ${mvnArgs.join(' ')} encerrou com código ${code}.`, logTail.slice(-TAIL_LINES_SHOWN));
    } else {
      console.log(paint(MUTED, '  A API encerrou.'));
      process.exit(0);
    }
  });

  while (!finished) {
    const body = started ? await health() : null;
    if (body?.status === 'UP') {
      ready = true;
      setStep(1, 'done');
      return printReady(startedAt, body);
    }
    if (Date.now() - startedAt > READY_TIMEOUT_MS) {
      return fail(`Passou de 3 min sem ficar pronto (${healthUrl}).`, logTail.slice(-TAIL_LINES_SHOWN));
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

await main();
