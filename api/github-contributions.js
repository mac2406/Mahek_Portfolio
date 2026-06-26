// Vercel Serverless Function — /api/github-contributions
// Fetches the real contribution total (public + private) using GitHub's GraphQL API.
// The GITHUB_TOKEN is stored as a Vercel environment variable (never in code).

module.exports = async function handler(req, res) {
    // CORS headers so the browser can call this from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'GITHUB_TOKEN environment variable not set' });
    }

    // Rolling 12-month window (matches what GitHub shows on your profile)
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const query = `
        query {
            user(login: "mac2406") {
                contributionsCollection(
                    from: "${oneYearAgo.toISOString()}"
                    to: "${now.toISOString()}"
                ) {
                    contributionCalendar {
                        totalContributions
                    }
                }
            }
        }
    `;

    try {
        const ghRes = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'mahek-portfolio',
            },
            body: JSON.stringify({ query }),
        });

        const data = await ghRes.json();
        const total = data?.data?.user?.contributionsCollection
            ?.contributionCalendar?.totalContributions;

        if (typeof total !== 'number') {
            return res.status(500).json({ error: 'Unexpected response from GitHub', data });
        }

        // Cache for 1 hour — contribution counts don't change by the second
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.json({ total });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
