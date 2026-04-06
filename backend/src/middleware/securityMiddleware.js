const buckets = new Map();

function getClientKey(req) {
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

export function getRateLimitConfig(sensitive = false) {
  return {
    windowMs: sensitive ? 60_000 : 15_000,
    limit: sensitive ? Number(process.env.RATE_LIMIT_SENSITIVE || 30) : Number(process.env.RATE_LIMIT_DEFAULT || 120),
  };
}

export function attachRequestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

export function apiRateLimiter(req, res, next) {
  const now = Date.now();
  const key = `${getClientKey(req)}:${matchesSensitiveRoute(req) ? 'sensitive' : 'default'}`;
  const rateConfig = getRateLimitConfig(matchesSensitiveRoute(req));
  const { windowMs, limit } = rateConfig;

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(limit - 1));
    return next();
  }

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      message: 'Limite de requisicoes atingido. Tente novamente em instantes.',
      retryAfterSeconds: retryAfter,
    });
  }

  bucket.count += 1;
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  next();
}
