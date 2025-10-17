import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

interface Author {
  login: string;
  avatarUrl: string;
}

interface CommentNode {
  author: Author;
  bodyHTML: string;
  createdAt: string;
}

interface Discussion {
  id: string; 
  number: number;
  url: string;
  title: string;
  bodyHTML: string;
  comments: {
    nodes: CommentNode[];
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const { owner, repo, title } = req.query;

  if (!owner || !repo || !title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Missing required parameters: owner, repo, title' });
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
                number
                url
                title
                bodyHTML
                comments(first: 100) {
                  nodes {
                    author {
                      login
                      avatarUrl
                    }
                    bodyHTML
                    createdAt
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
        console.error(`GitHub API failed with status ${apiResponse.status}:`, errorBody);
        return res.status(apiResponse.status).json({ error: 'Failed to fetch discussion from GitHub.' });
    }

    const apiData = await apiResponse.json();

    if (apiData.errors) {
      console.error('GitHub API returned errors:', apiData.errors);
      return res.status(500).json({ error: 'Failed to process discussion data.' });
    }

    const discussions = apiData.data?.search?.nodes;

    if (!discussions || discussions.length === 0) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    const discussion: Discussion = discussions[0];

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    return res.status(200).json(discussion);

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
