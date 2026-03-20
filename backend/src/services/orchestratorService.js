import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_ARGS_PREFIX = ['-u', '-X', 'utf8'];
const DEFAULT_AGENT_TIMEOUT_MS = 10 * 60 * 1000;

function getPythonCmd() {
  // IMPORTANTE (ESM): dotenv.config() roda após imports; ler process.env aqui garante pegar o .env já carregado.
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

function getAgentTimeoutMs() {
  const rawValue = process.env.AGENT_RUN_TIMEOUT_MS;
  const parsedValue = Number(rawValue);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return DEFAULT_AGENT_TIMEOUT_MS;
}

/**
 * Executa o pipeline completo de geração de projetos (funcionalidade antiga).
 */
export function orchestrateProject(projectId, idea) {
  return new Promise((resolve, reject) => {
    const orchestratorPath = path.join(__dirname, '..', '..', '..', 'orchestrator', 'factory.py');
    const pythonCmd = getPythonCmd();
    const pythonProcess = spawn(pythonCmd, [...PYTHON_ARGS_PREFIX, orchestratorPath, projectId, idea], {
      env: getPythonEnv(),
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[Python STDERR] ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Erro ao executar orchestrator: ${stderrData}`));
      }
      try {
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (e) {
        reject(new Error(`Falha ao analisar JSON do orchestrator: ${e.message}. Output: ${stdoutData}`));
      }
    });
  });
}

/**
 * Executa um único agente de IA.
 */
export function runSingleAgent(agent, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const agentRunnerPath = path.join(__dirname, '..', '..', '..', 'orchestrator', 'run_single_agent.py');
    const pythonCmd = getPythonCmd();
    const timeoutMs = getAgentTimeoutMs();
    const pythonProcess = spawn(pythonCmd, [...PYTHON_ARGS_PREFIX, agentRunnerPath], {
      env: getPythonEnv(options.envOverrides || {}),
    });

    let stdoutData = '';
    let stderrData = '';
    let timeoutHandle = null;
    let timeoutError = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    pythonProcess.on('error', (err) => {
      // Quando o executável não existe ou não pode ser iniciado (ENOENT, EACCES, etc.)
      settle(reject, new Error(`Falha ao iniciar Python (${pythonCmd}): ${err.message}`));
    });

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[Python STDERR] ${data}`);
    });

    timeoutHandle = setTimeout(() => {
      timeoutError = new Error(
        `Tempo limite excedido ao executar o agente ${agent} (${Math.round(timeoutMs / 1000)}s).`
      );
      console.error(`[Agent Timeout] ${timeoutError.message}`);
      pythonProcess.kill();

      setTimeout(() => {
        if (!settled) {
          pythonProcess.kill('SIGKILL');
        }
      }, 5000).unref?.();
    }, timeoutMs);

    pythonProcess.on('close', (code, signal) => {
      if (timeoutError) {
        return settle(reject, timeoutError);
      }

      if (code !== 0) {
        // Muitas vezes o script Python escreve o erro em JSON no stdout
        // ({"success": false, "error": "mensagem"}) e sai com código 1.
        // Tentamos extrair essa mensagem para deixar o erro mais claro.
        let detailedError = stderrData;
        try {
          if (stdoutData) {
            const parsed = JSON.parse(stdoutData);
            if (parsed && parsed.error) {
              detailedError = parsed.error;
            }
          }
        } catch {
          // Se não for JSON válido, ignoramos e ficamos com stderrData
        }
        if (!detailedError) {
          detailedError = `Processo Python finalizou com code=${code ?? 'null'} signal=${signal ?? 'null'} (sem saída em stdout/stderr)`;
        }
        return settle(reject, new Error(`Erro ao executar agente ${agent}: ${detailedError}`));
      }
      try {
        const result = JSON.parse(stdoutData);
        if (result.success) {
          settle(resolve, result.data);
        } else {
          settle(reject, new Error(`Erro no script do agente ${agent}: ${result.error}`));
        }
      } catch (e) {
        settle(reject, new Error(`Falha ao analisar JSON do agente ${agent}: ${e.message}. Output: ${stdoutData}`));
      }
    });

    // Envia o payload para o script Python via stdin
    pythonProcess.stdin.write(JSON.stringify({ agent, payload }));
    pythonProcess.stdin.end();
  });
}
