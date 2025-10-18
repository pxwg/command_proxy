import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize, CookieSerializeOptions } from 'cookie';

const ALLOWED_REDIRECT_HOSTS = [
  'localhost',
  'command-proxy.vercel.app',
  'homeward-sky.top',
  'pxwg.github.io'
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { code, state } = req.query;
  const savedState = req.cookies.github_oauth_state;

  if (!state || state !== savedState) {
    return res.status(403).json({ error: "Invalid state. CSRF attack detected?" });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('GitHub OAuth credentials are not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description });
    }

    const { access_token } = tokenData;

    // Define cookie options with SameSite and Secure attributes for production
    const cookieOptions: CookieSerializeOptions = {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'none',
    };

    if (process.env.NODE_ENV !== 'development') {
        cookieOptions.sameSite = 'none';
    }

    res.setHeader('Set-Cookie', serialize('github_token', access_token, cookieOptions));
    
    let redirectUrl = req.cookies.redirect_after_login || '/';
    try {
      const url = new URL(redirectUrl);
      if (!ALLOWED_REDIRECT_HOSTS.includes(url.hostname)) {
        redirectUrl = '/';
      }
    } catch {
      if (!redirectUrl.startsWith('/')) {
        redirectUrl = '/';
      }
    }

    res.redirect(302, redirectUrl);

  } catch (error) {
    console.error('Callback handler failed:', error);
    res.status(500).json({ error: 'Failed to authenticate with GitHub.' });
  }
}
