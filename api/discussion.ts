import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

async function findDiscussion(owner: string, repo: string, title: string, token: string | undefined) {
  const query = `
    query($owner: String!, $repo: String!, $title: String!) {
      repository(owner: $owner, name: $repo) {
        discussion(title: $title) {
          id
          url
          comments(first: 100) {
            nodes {
              id
              author {
                login
                avatarUrl
              }
              bodyHTML
              createdAt
              # CRITICAL FIX: Add viewer permission fields
              viewerCanUpdate
              viewerCanDelete
            }
          }
        }
      }
    }
  `;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: { owner, repo, title } }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch discussion from GitHub.');
  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { owner, repo, title } = req.query;
  if (!owner || !repo || !title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Owner, repo, and title are required.' });
  }

  // The token is optional here to allow anonymous users to view comments
  const token = req.cookies.github_token;

  try {
    const discussionData = await findDiscussion(owner as string, repo as string, title, token);
    const discussion = discussionData.data?.repository?.discussion;

    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    return res.status(200).json(discussion);
  } catch (error) {
    console.error('Failed to fetch discussion:', error);
    return res.status(500).json({ error: 'Failed to fetch discussion.' });
  }
}
