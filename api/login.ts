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

  // Determine the callback URL
  const callbackUrl = (req.query.callback_url as string) || 
    process.env.DEFAULT_CALLBACK_URL || 
    'https://command-proxy.vercel.app/api/callback';

  console.log('Using callback URL:', callbackUrl);

  const redirectAfterLogin = req.query.redirect 
    ? decodeURIComponent(req.query.redirect as string) 
    : '/';

  const cookieOptions = {
    httpOnly: true,
    secure: true, // Always secure since we use HTTPS locally now
    path: '/',
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'none' as const,
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
