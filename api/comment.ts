import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

async function githubApiRequest(query: string, variables: object, token: string) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json();
  if (data.errors) {
    console.error('GitHub API errors:', data.errors);
    throw new Error('GraphQL query failed.');
  }
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const token = req.cookies.github_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }

  try {
    switch (req.method) {
      case 'POST': {
        const { discussionId, body, replyToId } = req.body;
        if (!discussionId || !body) {
          return res.status(400).json({ error: 'Discussion ID and body are required.' });
        }
        const query = `
          mutation($discussionId: ID!, $body: String!, $replyToId: ID) {
            addDiscussionComment(input: {discussionId: $discussionId, body: $body, replyToId: $replyToId}) {
              comment { id, bodyHTML, createdAt, author { login, avatarUrl }, viewerCanUpdate, viewerCanDelete }
            }
          }`;
        const result = await githubApiRequest(query, { discussionId, body, replyToId }, token);
        return res.status(201).json(result.data.addDiscussionComment.comment);
      }

      case 'PATCH': {
        const { commentId, body } = req.body;
        if (!commentId || !body) {
          return res.status(400).json({ error: 'Comment ID and body are required.' });
        }
        const query = `
          mutation($commentId: ID!, $body: String!) {
            updateDiscussionComment(input: {commentId: $commentId, body: $body}) {
              comment { id, bodyHTML }
            }
          }`;
        const result = await githubApiRequest(query, { commentId, body }, token);
        return res.status(200).json(result.data.updateDiscussionComment.comment);
      }

      case 'DELETE': {
        const { commentId } = req.body;
        if (!commentId) {
          return res.status(400).json({ error: 'Comment ID is required.' });
        }
        const query = `
          mutation($commentId: ID!) {
            deleteDiscussionComment(input: {id: $commentId}) { clientMutationId }
          }`;
        await githubApiRequest(query, { commentId }, token);
        return res.status(204).end();
      }

      default:
        res.setHeader('Allow', ['POST', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('API Error:', (error as Error).message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
