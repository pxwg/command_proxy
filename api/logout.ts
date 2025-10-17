import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Clear the cookie by setting its maxAge to 0.
  res.setHeader('Set-Cookie', serialize('github_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 0,
  }));

  // Respond with a success message.
  res.status(200).json({ message: 'Successfully logged out' });
}
