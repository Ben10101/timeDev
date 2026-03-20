import {
  getRefreshCookieName,
  getRefreshCookieOptions,
  getAuthUser,
  loginUser,
  logoutUser,
  readRefreshTokenFromRequest,
  refreshAccessToken,
  registerUserWithWorkspace,
} from '../services/authService.js';

export async function registerController(req, res, next) {
  try {
    const result = await registerUserWithWorkspace(req.body || {});
    res.cookie(getRefreshCookieName(), result.refreshToken, getRefreshCookieOptions());
    res.status(201).json({
      accessToken: result.accessToken,
      ...result.authContext,
    });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req, res, next) {
  try {
    const result = await loginUser(req.body || {});
    res.cookie(getRefreshCookieName(), result.refreshToken, getRefreshCookieOptions());
    res.status(200).json({
      accessToken: result.accessToken,
      ...result.authContext,
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshController(req, res, next) {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    const result = await refreshAccessToken(refreshToken);
    res.cookie(getRefreshCookieName(), result.refreshToken, getRefreshCookieOptions());
    res.status(200).json({
      accessToken: result.accessToken,
      ...result.authContext,
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(req, res, next) {
  try {
    await logoutUser(req.authUser?.uuid);
    res.clearCookie(getRefreshCookieName(), {
      ...getRefreshCookieOptions(),
      maxAge: undefined,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function meController(req, res, next) {
  try {
    const user = await getAuthUser(req.authToken);
    res.status(200).json(user.authContext);
  } catch (error) {
    next(error);
  }
}

