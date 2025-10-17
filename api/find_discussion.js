export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return response.status(200).end();
  }
  response.setHeader('Access-Control-Allow-Origin', '*');
  
  const { owner, repo, title } = request.query;
  const token = request.headers.authorization?.split(' ')[1];

  if (!token) {
    return response.status(401).json({ error: 'No token provided' });
  }

  if (!owner || !repo || !title) {
    return response.status(400).json({ error: 'Missing owner, repo, or title parameter' });
  }

  try {
    const searchQuery = `repo:${owner}/${repo} in:title "${title}"`;

    const graphqlQuery = {
      query: `
        query($searchQuery: String!) {
          search(query: $searchQuery, type: DISCUSSION, first: 1) {
            nodes {
              ... on Discussion {
                number
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
      variables: {
        searchQuery,
      },
    };

    const apiResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(graphqlQuery),
    });

    const apiData = await apiResponse.json();

    if (apiData.errors) {
      console.error(apiData.errors);
      return response.status(500).json({ error: 'Failed to fetch discussion' });
    }

    if (apiData.data.search.nodes.length === 0) {
      return response.status(404).json({ error: 'Discussion not found' });
    }

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    return response.status(200).json(apiData.data.search.nodes[0]);

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Failed to find discussion' });
  }
}
