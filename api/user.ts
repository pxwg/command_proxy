import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';
import { serialize } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return; // CORS preflight request handled
  }

  if (req.method === 'DELETE') {
    const clearOptions = {
      httpOnly: true,
      secure: true,
      path: '/',
      maxAge: 0,
      expires: new Date(0), // 强制过期
      sameSite: 'none' as const,
    };

    res.setHeader('Set-Cookie', [
      serialize('github_token', '', clearOptions),
      serialize('github_oauth_state', '', clearOptions),
      serialize('redirect_after_login', '', clearOptions),
    ]);

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({ message: 'Logged out successfully' });
  }

  const token = req.cookies.github_token;

  if (!token) {
    // User is not logged in.
    return res.status(200).json({ isLoggedIn: false });
  }

  try {
    // User is logged in, fetch their basic info from GitHub.
    const query = `{ viewer { login, avatarUrl } }`;
    const apiResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!apiResponse.ok) {
      // Token might be expired or invalid. Clear the cookie.
      res.setHeader(
        'Set-Cookie',
        serialize('github_token', '', {
          httpOnly: true,
          secure: true,
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          sameSite: 'none',
        })
      );
      return res
        .status(401)
        .json({ isLoggedIn: false, error: 'Invalid token' });
    }

    const apiData = await apiResponse.json();
    const user = apiData.data?.viewer;

    if (!user) {
      // Unexpected response from GitHub.
      return res.status(200).json({ isLoggedIn: false });
    }

    res.setHeader(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Return logged-in status and user info.
    return res.status(200).json({
      isLoggedIn: true,
      user: {
        login: user.login,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Failed to fetch user status:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
