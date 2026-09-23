"""Local launcher regression checks; no Docker, npm install or public tunnel."""
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest


ROOT = Path(__file__).resolve().parent.parent


class RuntimeScriptsTest(unittest.TestCase):
    def setUp(self):
        # Keep fixtures available for inspection; do not permanently delete user files.
        self.fixture = Path(tempfile.mkdtemp(prefix='cms-runtime-test-'))
        self.env = dict(os.environ, PATH=f'{self.fixture}:{os.environ["PATH"]}')
        self.env['TEST_LISTENER_DIR'] = str(ROOT / 'CMS')
        self.stub('cloudflared', '#!/bin/bash\nprintf "CLOUDFLARED:%s\\n" "$*"\n')
        self.stub('lsof', '''#!/bin/bash
case "$*" in
  *-d\ cwd*) printf 'p1234\\nn%s\\n' "$TEST_LISTENER_DIR" ;;
  *) [ "${TEST_NO_LISTENER:-0}" = 1 ] && exit 1; echo 1234 ;;
esac
''')

    def stub(self, name, source):
        path = self.fixture / name
        path.write_text(source)
        path.chmod(0o700)

    def run_script(self, name, *args):
        return subprocess.run(
            ['bash', str(ROOT / 'scripts' / name), *args],
            env=self.env, cwd=self.fixture, text=True, capture_output=True, timeout=10,
        )

    def test_tunnel_port_validation(self):
        for port in ['', '0', '-1', '65536', '8081/path', '999999999999']:
            with self.subTest(port=port):
                result = self.run_script('tunnel.sh', port, 'CMS')
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertNotIn('CLOUDFLARED:', result.stdout)

    def test_tunnel_requires_listener(self):
        self.env['TEST_NO_LISTENER'] = '1'
        result = self.run_script('tunnel.sh', '8081', 'CMS')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('CLOUDFLARED:', result.stdout)

    def test_cms_tunnel_rejects_other_checkout(self):
        self.env['TEST_LISTENER_DIR'] = str(self.fixture / 'other-cms')
        result = self.run_script('tunnel.sh', '8081', 'CMS')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('CLOUDFLARED:', result.stdout)

    def test_cms_tunnel_uses_requested_port(self):
        result = self.run_script('tunnel.sh', '8082', 'CMS')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('CLOUDFLARED:tunnel --url http://localhost:8082', result.stdout)

    def test_dev_rejects_unknown_service_before_starting_anything(self):
        result = self.run_script('dev.sh', 'be', 'invalid')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Khong ro dich vu', result.stderr)

    def test_dev_uses_cms_and_stops_only_its_children(self):
        started = self.fixture / 'started'
        stopped = self.fixture / 'stopped'
        self.env.update(TEST_STARTED=str(started), TEST_STOPPED=str(stopped))
        self.stub('npm', '''#!/bin/bash
trap 'echo stopped > "$TEST_STOPPED"; exit 0' TERM
printf '%s\\n%s\\n' "$PWD" "$*" > "$TEST_STARTED"
while :; do sleep 0.1; done
''')
        unrelated = subprocess.Popen(['sleep', '20'])
        proc = subprocess.Popen(
            ['bash', str(ROOT / 'scripts/dev.sh'), 'cms'],
            cwd=self.fixture, env=self.env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True,
        )
        try:
            deadline = time.monotonic() + 5
            while not started.exists() and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue(started.exists())
            self.assertEqual(started.read_text().splitlines(), [str(ROOT / 'CMS'), 'run dev'])
            proc.send_signal(signal.SIGTERM)
            output, _ = proc.communicate(timeout=5)
            self.assertEqual(proc.returncode, 143, output)
            self.assertTrue(stopped.exists(), output)
            self.assertIsNone(unrelated.poll())
        finally:
            if proc.poll() is None:
                proc.terminate()
                proc.communicate(timeout=5)
            unrelated.terminate()
            unrelated.wait(timeout=5)

    def test_make_passes_port_and_canonical_source(self):
        result = subprocess.run(
            ['make', '-n', 'cms', 'dev', 'dev-all', 'tunnel-cms', 'CMS_PORT=8082'],
            cwd=ROOT, text=True, capture_output=True, timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f'cd "{ROOT}/CMS" && npm run dev', result.stdout)
        self.assertIn('"8082" "CMS"', result.stdout)
        self.assertNotIn('CMS-old', result.stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
