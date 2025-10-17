export default async function handler(request, response) {
  const { code } = request.query;

  const clientId = process.env.VITE_PUBLIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.VITE_GITHUB_CLIENT_SECRET;

  if (!code) {
    return response.status(400).json({ error: 'No code provided' });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return response.status(400).json({ error: tokenData.error_description });
    }
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    return response.status(200).json({ token: tokenData.access_token });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Authentication failed' });
  }
}
