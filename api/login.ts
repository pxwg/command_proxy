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

  const redirectUri = req.query.redirect 
    ? decodeURIComponent(req.query.redirect as string) 
    : '/';

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 60 * 10,
  };

  res.setHeader('Set-Cookie', [
    serialize('github_oauth_state', state, cookieOptions),
    serialize('redirect_after_login', redirectUri, cookieOptions)
  ]);

  const authorizationUrl = 
    `https://github.com/login/oauth/authorize?client_id=${clientId}` +
    `&scope=read:user,public_repo,read:discussion` +
    `&state=${state}`;

  res.redirect(302, authorizationUrl);
}
