import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

async function addComment(discussionId: string, body: string, token: string) {
  const query = `
    mutation AddComment($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
        comment {
          id
          bodyHTML
          createdAt
          author {
            login
            avatarUrl
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { discussionId, body } }),
  });
  
  if (!response.ok) throw new Error('Failed to post comment to GitHub.');
  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies.github_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }

  try {
    const { discussionId, body } = req.body;
    if (!discussionId || !body) {
      return res.status(400).json({ error: 'Discussion ID and comment body are required.' });
    }

    const newCommentData = await addComment(discussionId, body, token);
    if (newCommentData.errors) {
      console.error('GitHub API errors:', newCommentData.errors);
      return res.status(500).json({ error: 'Failed to post comment due to API error.' });
    }

    return res.status(201).json(newCommentData.data.addDiscussionComment.comment);
  } catch (error) {
    console.error('Failed to post comment:', error);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
}
