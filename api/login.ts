import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Generate a random state for CSRF protection.
  const state = Math.random().toString(36).substring(7);
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    console.error('GITHUB_CLIENT_ID is not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  
  // Store the state in a cookie to verify it later in the callback.
  res.setHeader('Set-Cookie', serialize('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  }));

  // Get the redirect path from query or default to homepage.
  const redirectUri = req.query.redirect ? decodeURIComponent(req.query.redirect as string) : '/';
  res.setHeader('Set-Cookie', serialize('redirect_after_login', redirectUri, {
      path: '/',
      maxAge: 60 * 10, // 10 minutes
  }));

  // Redirect user to GitHub's authorization page.
  const authorizationUrl = 
    `https://github.com/login/oauth/authorize?client_id=${clientId}` +
    `&scope=read:user,public_repo,read:discussion` +
    `&state=${state}`;

  res.redirect(302, authorizationUrl);
}
