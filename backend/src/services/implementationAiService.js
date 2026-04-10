import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_ARGS_PREFIX = ['-u', '-X', 'utf8'];

function getPythonCmd() {
  return process.env.PYTHON_CMD || 'python';
}

function getPythonEnv(envOverrides = {}) {
  return {
    ...process.env,
    ...envOverrides,
    PYTHONUTF8: process.env.PYTHONUTF8 || '1',
    PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
  };
}

export function generateImplementationUi(payload, options = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', '..', 'orchestrator', 'generate_implementation_ui.py');
    const pythonCmd = getPythonCmd();
    const pythonProcess = spawn(pythonCmd, [...PYTHON_ARGS_PREFIX, scriptPath], {
      env: getPythonEnv(options.envOverrides || {}),
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.on('error', (err) => {
      reject(new Error(`Falha ao iniciar Python (${pythonCmd}): ${err.message}`));
    });

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[Implementation AI STDERR] ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderrData || `Processo AI finalizou com codigo ${code}`));
      }

      try {
        const parsed = JSON.parse(stdoutData);
        if (parsed.success) {
          resolve(parsed.data || {});
        } else {
          reject(new Error(parsed.error || 'Falha ao gerar UI por IA.'));
        }
      } catch (error) {
        reject(new Error(`Falha ao interpretar resposta da IA: ${error.message}`));
      }
    });

    pythonProcess.stdin.write(
      JSON.stringify({
        ...payload,
        bypassCache: Boolean(options.bypassCache),
      })
    );
    pythonProcess.stdin.end();
  });
}

export function invokeDebugAgent(payload, options = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', '..', 'orchestrator', 'run_single_agent.py');
    const pythonCmd = getPythonCmd();
    const pythonProcess = spawn(pythonCmd, [...PYTHON_ARGS_PREFIX, scriptPath], {
      env: getPythonEnv(options.envOverrides || {}),
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.on('error', (err) => {
      reject(new Error(`Falha ao iniciar Python (${pythonCmd}): ${err.message}`));
    });

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[DebugAgent STDERR] ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderrData || `DebugAgent finalizou com codigo ${code}`));
      }

      try {
        const parsed = JSON.parse(stdoutData);
        if (parsed.success) {
          resolve(parsed.data || {});
        } else {
          reject(new Error(parsed.error || 'Falha ao processar DebugAgent.'));
        }
      } catch (error) {
        reject(new Error(`Falha ao interpretar resposta do DebugAgent: ${error.message}`));
      }
    });

    const normalizedPayload = {
      ...payload,
      project_id: String(payload?.project_id || payload?.projectId || payload?.projectUuid || 'debug-project'),
      idea: payload?.idea || payload?.objective || 'Diagnostico de falha de validacao',
    };

    pythonProcess.stdin.write(
      JSON.stringify({
        agent: 'debug_agent',
        payload: normalizedPayload,
        runtime_mode: 'modern-single-agent',
      })
    );
    pythonProcess.stdin.end();
  });
}
