import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Executa o pipeline completo de geração de projetos (funcionalidade antiga).
 */
export function orchestrateProject(projectId, idea) {
  return new Promise((resolve, reject) => {
    const orchestratorPath = path.join(__dirname, '..', '..', '..', 'orchestrator', 'factory.py');
    const pythonProcess = spawn('python', [orchestratorPath, projectId, idea]);

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
export function runSingleAgent(agent, payload) {
  return new Promise((resolve, reject) => {
    const agentRunnerPath = path.join(__dirname, '..', '..', '..', 'orchestrator', 'run_single_agent.py');
    const pythonProcess = spawn('python', [agentRunnerPath]);

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
        return reject(new Error(`Erro ao executar agente ${agent}: ${stderrData}`));
      }
      try {
        const result = JSON.parse(stdoutData);
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(`Erro no script do agente ${agent}: ${result.error}`));
        }
      } catch (e) {
        reject(new Error(`Falha ao analisar JSON do agente ${agent}: ${e.message}. Output: ${stdoutData}`));
      }
    });

    // Envia o payload para o script Python via stdin
    pythonProcess.stdin.write(JSON.stringify({ agent, payload }));
    pythonProcess.stdin.end();
  });
}