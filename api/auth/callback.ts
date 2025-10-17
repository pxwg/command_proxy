import type { VercelRequest, VercelResponse } from '@vercel/node';

const clientId = process.env.PUBLIC_GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.query.code?.toString();
  const state = req.query.state?.toString();
  const error = req.query.error?.toString();
  
  const redirectTo = state ? decodeURIComponent(state) : '/';
  
  console.log('[/api/auth/callback] Received state:', state);
  console.log('[/api/auth/callback] Decoded redirectTo:', redirectTo);

  if (error) {
    console.warn(`[/api/auth/callback] GitHub returned an auth error: ${error}`);
    return res.redirect(302, `${redirectTo}?error=access_denied`);
  }
  
  if (!code) {
    console.error("[/api/auth/callback] CRITICAL: 'code' parameter was missing!");
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('GitHub token exchange error:', tokenData);
      return res.redirect(302, `${redirectTo}?error=${tokenData.error_description || 'login_failed'}`);
    }

    // Set cookie via Set-Cookie header
    res.setHeader('Set-Cookie', `github_token=${tokenData.access_token}; Path=/; HttpOnly; Secure; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`);
    
    return res.redirect(302, redirectTo);
  } catch (err) {
    console.error('Callback error:', err);
    return res.status(500).json({ error: "Authentication failed" });
  }
}
