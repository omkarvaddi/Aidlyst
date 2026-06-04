import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';

const url = process.env.FRIDAY_UI_URL || 'http://localhost:8787/';
const browser = process.env.FRIDAY_BROWSER || 'msedge';
const mode = process.env.FRIDAY_FULLSCREEN_MODE || 'kiosk';

function launchBrowser() {
  const args = mode === 'app'
    ? [`--app=${url}`, '--start-maximized', '--new-window']
    : ['--kiosk', url, '--edge-kiosk-type=fullscreen', '--no-first-run'];
  spawn(browser, args, { detached: true, stdio: 'ignore' }).unref();
}

function startNpm(script) {
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(cmd, ['run', script], { cwd: path.resolve('.'), stdio: 'inherit', shell: false });
}

console.log('Starting Friday local server and UI...');
startNpm('server');
startNpm('client');
setTimeout(() => {
  console.log(`Launching Friday in ${mode} mode at ${url}`);
  launchBrowser();
}, 2400);
