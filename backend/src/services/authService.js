import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { bootstrapWorkspaceAndUser } from './projectDataService.js';
import { hashPassword, hashToken, signJwt, verifyJwt, verifyPassword } from '../utils/crypto.js';
import { parseCookies } from '../utils/cookies.js';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const REFRESH_COOKIE_NAME = 'factory_refresh_token';

function createAuthError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getAccessSecret() {
  const secret = process.env.AUTH_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return 'dev-auth-secret-change-me';
  }
  return secret;
}

function buildAccessTokenPayload(user) {
  return {
    sub: user.uuid,
    email: user.email,
    role: user.role,
    type: 'access',
  };
}

function buildRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProduction ? 'strict' : 'lax',
    secure: isProduction,
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
}

async function getDefaultWorkspaceForUser(userId) {
  const ownedWorkspace = await prisma.workspace.findFirst({
    where: { ownerUserId: userId },
    select: { uuid: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (ownedWorkspace) return ownedWorkspace;

  const membership = await prisma.projectMember.findFirst({
    where: { userId },
    include: {
      project: {
        include: {
          workspace: {
            select: { uuid: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return membership?.project?.workspace || null;
}

async function buildAuthResponse(userRecord) {
  const workspace = await getDefaultWorkspaceForUser(userRecord.id);
  return {
    user: {
      uuid: userRecord.uuid,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      status: userRecord.status,
    },
    workspace,
  };
}

async function persistRefreshToken(userId, refreshToken) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      lastLoginAt: new Date(),
    },
  });
}

function createAccessToken(user) {
  return signJwt(buildAccessTokenPayload(user), getAccessSecret(), ACCESS_TOKEN_TTL_SECONDS);
}

function createRefreshToken() {
  return `${randomUUID()}.${randomUUID()}`;
}

export async function registerUserWithWorkspace({ name, email, password, workspaceName }) {
  if (!name?.trim() || !email?.trim() || !password?.trim() || !workspaceName?.trim()) {
    throw createAuthError('name, email, password e workspaceName sao obrigatorios.', 400);
  }

  if (password.length < 8) {
    throw createAuthError('A senha precisa ter pelo menos 8 caracteres.', 400);
  }

  const passwordHash = await hashPassword(password);
  const { user } = await bootstrapWorkspaceAndUser({
    userName: name,
    email,
    workspaceName,
    passwordHash,
    failIfUserExists: true,
  });

  const refreshToken = createRefreshToken();
  await persistRefreshToken(user.id, refreshToken);

  return {
    accessToken: createAccessToken(user),
    refreshToken,
    authContext: await buildAuthResponse(user),
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    throw createAuthError('Credenciais invalidas.', 401);
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    throw createAuthError('Credenciais invalidas.', 401);
  }

  if (user.status !== 'active') {
    throw createAuthError('Usuario inativo.', 403);
  }

  const refreshToken = createRefreshToken();
  await persistRefreshToken(user.id, refreshToken);

  return {
    accessToken: createAccessToken(user),
    refreshToken,
    authContext: await buildAuthResponse(user),
  };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw createAuthError('Refresh token ausente.', 401);
  }

  const user = await prisma.user.findFirst({
    where: {
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw createAuthError('Sessao invalida.', 401);
  }

  const nextRefreshToken = createRefreshToken();
  await persistRefreshToken(user.id, nextRefreshToken);

  return {
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshToken,
    authContext: await buildAuthResponse(user),
  };
}

export async function logoutUser(userUuid) {
  if (!userUuid) return;
  await prisma.user.updateMany({
    where: { uuid: userUuid },
    data: {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
  });
}

export async function getAuthUser(accessToken) {
  const payload = verifyJwt(accessToken, getAccessSecret());
  if (payload.type !== 'access') {
    throw createAuthError('Tipo de token invalido.', 401);
  }

  const user = await prisma.user.findUnique({
    where: { uuid: payload.sub },
  });

  if (!user || user.status !== 'active') {
    throw createAuthError('Usuario invalido.', 401);
  }

  return {
    ...user,
    authContext: await buildAuthResponse(user),
  };
}

export function readRefreshTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[REFRESH_COOKIE_NAME] || null;
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE_NAME;
}

export function getRefreshCookieOptions() {
  return buildRefreshCookieOptions();
}
