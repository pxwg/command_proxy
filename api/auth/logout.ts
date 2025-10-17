import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redirectTo = (req.query.redirect_to as string) || '/';
  
  // Clear cookie
  res.setHeader('Set-Cookie', 'github_token=; Path=/; HttpOnly; Secure; Max-Age=0; SameSite=Lax');
  
  return res.redirect(302, redirectTo);
}
