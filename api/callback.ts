import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize, type CookieSerializeOptions } from 'cookie';
import { handleCors } from './utils/cors';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

const ALLOWED_REDIRECT_HOSTS = [
  'localhost',
  '127.0.0.1',
  'pxwg-dogggie.github.io',
  'command-proxy.vercel.app',
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (handleCors(req, res)) {
    return;
  }

  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error_description);
      return res.status(400).json({ error: tokenData.error_description || 'OAuth failed' });
    }

    const { access_token } = tokenData;

    if (!access_token) {
      return res.status(400).json({ error: 'No access token received' });
    }

    const cookieOptions: CookieSerializeOptions = {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'none',
      secure: true,
    };

    res.setHeader('Set-Cookie', serialize('github_token', access_token, cookieOptions));
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    let redirectUrl = req.cookies.redirect_after_login || '/';
    console.log('Raw redirect_after_login cookie:', req.cookies.redirect_after_login);
    try {
      const url = new URL(redirectUrl);
      console.log('Parsed redirect URL:', url.href, 'Hostname:', url.hostname);
      if (!ALLOWED_REDIRECT_HOSTS.includes(url.hostname)) {
        console.log('Redirect hostname not allowed:', url.hostname);
        redirectUrl = '/';
      }
    } catch (e) {
      console.log('Error parsing redirect URL:', redirectUrl, e);
      if (!redirectUrl.startsWith('/')) {
        redirectUrl = '/';
      }
    }

    return res.redirect(302, redirectUrl);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
