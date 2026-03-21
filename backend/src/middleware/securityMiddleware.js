const buckets = new Map();

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function matchesSensitiveRoute(req) {
  return (
    req.path.startsWith('/auth/login') ||
    req.path.startsWith('/auth/register') ||
    req.path.startsWith('/auth/refresh') ||
    req.path.includes('/generate-backlog') ||
    req.path.includes('/generate-architecture') ||
    req.path.includes('/requirements/run') ||
    req.path.includes('/qa/run') ||
    req.path.includes('/implementation/run')
  );
}

export function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

export function apiRateLimiter(req, res, next) {
  const now = Date.now();
  const key = `${getClientKey(req)}:${matchesSensitiveRoute(req) ? 'sensitive' : 'default'}`;
  const windowMs = matchesSensitiveRoute(req) ? 60_000 : 15_000;
  const limit = matchesSensitiveRoute(req) ? Number(process.env.RATE_LIMIT_SENSITIVE || 30) : Number(process.env.RATE_LIMIT_DEFAULT || 120);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      message: 'Limite de requisicoes atingido. Tente novamente em instantes.',
      retryAfterSeconds: retryAfter,
    });
  }

  bucket.count += 1;
  next();
}
