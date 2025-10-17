import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const githubToken = req.cookies.github_token;

  if (!githubToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const owner = req.query.owner?.toString();
  const repo = req.query.repo?.toString();
  const title = req.query.title?.toString();

  if (!owner || !repo || !title) {
    return res.status(400).json({ 
      error: 'Missing required parameters: owner, repo, title' 
    });
  }

  try {
    const apiUrl = `https://command-proxy.vercel.app/api/find_discussion?owner=${owner}&repo=${repo}&title=${encodeURIComponent(title)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`
      }
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch discussion data' });
  }
}
