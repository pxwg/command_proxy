import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const state = Math.random().toString(36).substring(7);
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    console.error('GITHUB_CLIENT_ID is not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Dynamically determine the host and protocol to build the redirect URI
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const callbackUrl = `${protocol}://${host}/api/callback`;

  const redirectAfterLogin = req.query.redirect 
    ? decodeURIComponent(req.query.redirect as string) 
    : '/';

  const cookieOptions = {
    httpOnly: true,
    secure: true, // Always secure since we use HTTPS locally now
    path: '/',
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax' as const, // State cookies can be Lax
  };

  res.setHeader('Set-Cookie', [
    serialize('github_oauth_state', state, cookieOptions),
    serialize('redirect_after_login', redirectAfterLogin, cookieOptions)
  ]);

  const authorizationUrl = 
    `https://github.com/login/oauth/authorize?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=read:user,public_repo,read:discussion` +
    `&state=${state}`;

  res.redirect(302, authorizationUrl);
}
