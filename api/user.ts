import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

import { serialize } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return; // CORS preflight request handled
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
          sameSite: 'none', // Use 'none' for consistency
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
