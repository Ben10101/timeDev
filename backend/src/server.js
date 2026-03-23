import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './lib/prisma.js';
import projectRoutes from './routes/projectRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import implementationRoutes from './routes/implementationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import observabilityRoutes from './routes/observabilityRoutes.js';
import alignmentRoutes from './routes/alignmentRoutes.js';
import { recoverStaleAgentRuns } from './services/agentRunRecoveryService.js';
import { attachAuthUser } from './middleware/authMiddleware.js';
import { apiAuditLogger } from './middleware/auditMiddleware.js';
import { apiRateLimiter, applySecurityHeaders, attachRequestContext } from './middleware/securityMiddleware.js';


BigInt.prototype.toJSON = function () {
  return this.toString();
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true });

const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL || '';
let recoveryIntervalHandle = null;

function getSafeDatabaseLabel() {
  if (!DATABASE_URL) return 'DATABASE_URL ausente';

  try {
    const parsed = new URL(DATABASE_URL);
    return `${parsed.protocol.replace(':', '')}://${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return 'DATABASE_URL presente (nao foi possivel parsear)';
  }
}

function buildAllowedOrigins() {
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const configured = [process.env.FRONTEND_ORIGIN, process.env.VITE_FRONTEND_URL]
    .filter(Boolean)
    .map((value) => value.trim());

  return [...new Set([...defaults, ...configured])];
}

const allowedOrigins = buildAllowedOrigins();
const isProduction = process.env.NODE_ENV === 'production';

app.use(applySecurityHeaders);
app.use(attachRequestContext);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !isProduction || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origem nao autorizada: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/api', attachAuthUser, apiRateLimiter, apiAuditLogger);

app.use('/', observabilityRoutes);
app.use('/api', observabilityRoutes);
app.use('/api', authRoutes);
app.use('/api', alignmentRoutes);
app.use('/api', projectRoutes);
app.use('/api', agentRoutes);
app.use('/api', dataRoutes);
app.use('/api', implementationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || (err.message?.includes('nao encontrado') ? 404 : 500);

  res.status(statusCode).json({ message: err.message || 'Erro interno do servidor' });
});

async function startServer() {
  console.log(`Database target: ${getSafeDatabaseLabel()}`);

  try {
    await prisma.$connect();
    console.log('Prisma conectado com sucesso');
    const timeoutMs = Number(process.env.AGENT_RUN_TIMEOUT_MS || 10 * 60 * 1000);
    const recoveryWindowSeconds = Math.max(120, Math.round(timeoutMs / 1000) + 30);
    const recoveryResult = await recoverStaleAgentRuns({
      maxAgeSeconds: recoveryWindowSeconds,
    });

    if (recoveryResult.recoveredCount > 0) {
      console.log(`Recuperadas ${recoveryResult.recoveredCount} execucoes presas na inicializacao`);
    }

    recoveryIntervalHandle = setInterval(async () => {
      try {
        const result = await recoverStaleAgentRuns({
          maxAgeSeconds: recoveryWindowSeconds,
          reason: 'Execucao marcada como falha por watchdog de recuperacao do backend.',
        });
        if (result.recoveredCount > 0) {
          console.log(`Watchdog recuperou ${result.recoveredCount} execucoes presas`);
        }
      } catch (error) {
        console.error(`Falha no watchdog de recuperacao de agent runs: ${error.message}`);
      }
    }, 60 * 1000);
  } catch (error) {
    console.error(`Falha ao conectar no banco: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
    console.log(`API disponivel em http://localhost:${PORT}/api`);
  });
}

startServer();

process.on('SIGINT', async () => {
  if (recoveryIntervalHandle) clearInterval(recoveryIntervalHandle);
  await prisma.$disconnect().catch(() => null);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (recoveryIntervalHandle) clearInterval(recoveryIntervalHandle);
  await prisma.$disconnect().catch(() => null);
  process.exit(0);
});

export default app;
