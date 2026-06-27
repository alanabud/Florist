/**
 * Runs the cross-company Firestore rules suite under the emulator and filters
 * the emulator's expected verbose noise so the output stays readable.
 *
 * The Firestore emulator logs every DENIED operation as a Java WARNING with a
 * full stack trace — during this suite that is *expected* (each one is an
 * assertFails: a cross-company / spoof / role-escalation write the rules
 * correctly reject), plus a teardown "Connection reset". None of it indicates a
 * failure. We drop those lines but keep the suite's own ✅/❌ output and, crucially,
 * propagate the child's exit code so verify:prod still fails on a real failure.
 */
import { spawn } from 'node:child_process';

const NOISE = [
  /^\w{3} \d{1,2}, \d{4} .*(AM|PM)/,            // java.util.logging timestamp lines
  /^(INFO|WARNING|SEVERE):/,                     // java log levels
  /^\s+at /,                                     // stack frames
  /^(com\.google|io\.grpc|io\.netty|io\.gapi|java\.)/,
  /evaluation error|Operation failed|Connection reset|DatastoreException|exceptionCaught|WrappedStreamObserver/,
  /@firebase\/firestore:|GrpcConnection RPC|PERMISSION_DENIED/,  // client SDK deny echoes
  /Started WebSocket server|API endpoint:|FIRESTORE_EMULATOR_HOST|DATASTORE_EMULATOR_HOST|Datastore Mode|Dev App Server|Detected (non-)?HTTP|If you are using a library|If you are running a Firestore|file an? .*github/i,
];
const isNoise = (line) => line.length > 0 && NOISE.some((re) => re.test(line));

function pipeFiltered(stream) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!isNoise(line)) process.stdout.write(line + '\n');
    }
  });
  stream.on('end', () => {
    if (buf && !isNoise(buf)) process.stdout.write(buf + '\n');
  });
}

const child = spawn(
  'firebase emulators:exec --only firestore "node test-cross-company-rules.mjs"',
  { shell: true }
);
pipeFiltered(child.stdout);
pipeFiltered(child.stderr);
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => { console.error('[run-xcompany-rules] failed to start:', err.message); process.exit(1); });
