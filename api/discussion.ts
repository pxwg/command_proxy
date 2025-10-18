import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userToken = req.cookies.github_token;
  const appToken = process.env.GITHUB_TOKEN;
  const token = userToken || appToken;

  if (!token) {
    console.error('GitHub token is not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const { owner, repo, title } = req.query;
  if (!owner || !repo || !title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const searchQuery = `repo:${owner}/${repo} in:title "${title}"`;
    const graphqlQuery = {
      query: `
        query($searchQuery: String!) {
          search(query: $searchQuery, type: DISCUSSION, first: 1) {
            nodes {
              ... on Discussion {
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
                    viewerCanUpdate
                    viewerCanDelete
                  }
                }
              }
            }
          }
        }
      `,
      variables: { searchQuery },
    };

    const apiResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(`GitHub API failed:`, errorBody);
      return res.status(apiResponse.status).json({ error: 'Failed to fetch from GitHub.' });
    }

    const apiData = await apiResponse.json();
    if (apiData.errors) {
      console.error('GitHub API errors:', apiData.errors);
      return res.status(500).json({ error: 'Failed to process discussion data.' });
    }

    const discussion = apiData.data?.search?.nodes?.[0];
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(discussion);

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
