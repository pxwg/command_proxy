import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './utils/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.cookies.github_token || process.env.GITHUB_TOKEN;
  if (!token) {
    return res
      .status(500)
      .json({ error: 'Server configuration error: GitHub token missing.' });
  }

  const owner = Array.isArray(req.query.owner)
    ? req.query.owner[0]
    : req.query.owner;
  const repo = Array.isArray(req.query.repo)
    ? req.query.repo[0]
    : req.query.repo;
  const title = Array.isArray(req.query.title)
    ? req.query.title[0]
    : req.query.title;

  if (!owner || !repo || !title) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  try {
    const searchQuery = `repo:${owner}/${repo} in:title "${title}"`;
    // This powerful query fetches comments and their direct replies.
    const graphqlQuery = {
      query: `
        query($searchQuery: String!) {
          search(query: $searchQuery, type: DISCUSSION, first: 1) {
            edges {
              node {
                ... on Discussion {
                  id
                  url
                  comments(first: 100) {
                    nodes {
                      id
                      bodyHTML
                      createdAt
                      author { login, avatarUrl }
                      viewerCanUpdate
                      viewerCanDelete
                      replyTo { id }
                      replies(first: 100) {
                        nodes {
                          id
                          bodyHTML
                          createdAt
                          author { login, avatarUrl }
                          viewerCanUpdate
                          viewerCanDelete
                          replyTo { id }
                        }
                      }
                    }
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
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!apiResponse.ok) {
      console.error(`GitHub API failed:`, await apiResponse.text());
      return res
        .status(apiResponse.status)
        .json({ error: 'Failed to fetch from GitHub.' });
    }

    const apiData = await apiResponse.json();
    if (apiData.errors) {
      console.error('GitHub API errors:', apiData.errors);
      return res
        .status(500)
        .json({ error: 'Failed to process discussion data.' });
    }

    const discussionNode = apiData.data?.search?.edges?.[0]?.node;
    if (!discussionNode) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    // Flatten the nested structure from GitHub into a single flat array,
    // which is the format your existing frontend code expects.
    const flatComments: any[] = [];
    discussionNode.comments.nodes.forEach((comment: any) => {
      // Add the top-level comment
      const parentComment = { ...comment };
      delete parentComment.replies; // Remove the nested replies object
      flatComments.push(parentComment);

      // Add all its replies to the same flat list
      if (comment.replies && comment.replies.nodes) {
        comment.replies.nodes.forEach((reply: any) => {
          flatComments.push(reply);
        });
      }
    });

    const finalDiscussion = {
      id: discussionNode.id,
      url: discussionNode.url,
      comments: {
        // Provide the flattened array to the frontend.
        nodes: flatComments,
      },
    };

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(finalDiscussion);
  } catch (error) {
    console.error('Unexpected error:', error);
    return res
      .status(500)
      .json({ error: 'An internal server error occurred.' });
  }
}
