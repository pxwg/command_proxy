import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

const ALLOWED_REDIRECT_HOSTS = [
  'localhost:4321',
   // process.env.DOMAIN || 'example.com',
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
      console.error('Error fetching access token:', tokenData);
      return res.status(400).json({ error: tokenData.error_description });
    }

    const { access_token } = tokenData;

    res.setHeader('Set-Cookie', serialize('github_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    }));
    
    // --- START OF CHANGE ---
    // Validate and redirect to the full URL.
    let redirectUrl = req.cookies.redirect_after_login || '/';
    try {
      const url = new URL(redirectUrl);
      // Security check: only redirect to allowed hosts.
      if (!ALLOWED_REDIRECT_HOSTS.includes(url.hostname)) {
        console.warn(`Redirect blocked to untrusted host: ${url.hostname}`);
        redirectUrl = '/'; // Fallback to a safe default
      }
    } catch (error) {
        // If it's not a full URL (e.g., just '/'), treat it as safe.
        if (!redirectUrl.startsWith('/')) {
            redirectUrl = '/';
        }
    }
    // --- END OF CHANGE ---

    res.redirect(302, redirectUrl);

  } catch (error) {
    console.error('Callback handler failed:', error);
    res.status(500).json({ error: 'Failed to authenticate with GitHub.' });
  }
}
