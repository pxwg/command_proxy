import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import your utils - you'll need to copy this or use direct GraphQL
async function addComment(discussionId: string, body: string, token: string) {
  // Implement your addComment logic here or import from shared utils
  const query = `
    mutation AddComment($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
        comment {
          id
          body
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { discussionId, body },
    }),
  });

  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies.github_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { discussionId, body } = req.body;

    if (!discussionId || !body) {
      return res.status(400).json({ 
        error: 'Discussion ID and body are required' 
      });
    }

    const newComment = await addComment(discussionId, body, token);

    return res.status(201).json(newComment);
  } catch (error) {
    console.error('Failed to post comment:', error);
    return res.status(500).json({ error: 'Failed to post comment' });
  }
}
