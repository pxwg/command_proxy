import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Clear all relevant cookies by setting their maxAge to 0.
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 0,
    sameSite: 'none' as const, // Use 'none' for consistency
  };

  res.setHeader('Set-Cookie', [
    serialize('github_token', '', cookieOptions),
    serialize('github_oauth_state', '', cookieOptions),
    serialize('redirect_after_login', '', cookieOptions)
  ]);
  // Respond with a success message.
  res.status(200).json({ message: 'Successfully logged out' });
}
