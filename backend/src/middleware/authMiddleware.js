import { getAuthUser, readRefreshTokenFromRequest } from '../services/authService.js';

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export async function attachAuthUser(req, _res, next) {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      req.authUser = null;
      return next();
    }

    const user = await getAuthUser(accessToken);
    req.authUser = user;
    req.authToken = accessToken;
    next();
  } catch (_error) {
    req.authUser = null;
    next();
  }
}

export async function requireAuth(req, res, next) {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ message: 'Autenticação obrigatória.' });
    }

    const user = await getAuthUser(accessToken);
    req.authUser = user;
    req.authToken = accessToken;
    next();
  } catch (error) {
    res.status(401).json({ message: error.message || 'Sessão inválida.' });
  }
}

export function clearRefreshCookie(res) {
  res.clearCookie('factory_refresh_token', {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
  });
}

export function getRefreshTokenFromReq(req) {
  return readRefreshTokenFromRequest(req);
}
