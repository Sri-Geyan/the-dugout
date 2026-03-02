import { NextRequest, NextResponse } from 'next/server';

/**
 * Player Image Proxy API
 * Fetches player headshot images from Wikipedia/Wikimedia Commons
 * 
 * Usage: GET /api/player-image?name=Virat+Kohli&size=200
 * Returns: Redirects to the image URL or returns a fallback
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const size = searchParams.get('size') || '200';

    if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    try {
        // Try Wikipedia API for player image
        const wikiTitle = name.replace(/\s+/g, '_');
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;

        const res = await fetch(wikiUrl, {
            headers: { 'User-Agent': 'TheDugoutApp/1.0' },
            next: { revalidate: 86400 }, // Cache for 24 hours
        });

        if (res.ok) {
            const data = await res.json();
            // Wikipedia REST API returns thumbnail in the response
            if (data.thumbnail?.source) {
                // Modify the thumbnail URL to get desired size
                const imgUrl = data.thumbnail.source.replace(/\/\d+px-/, `/${size}px-`);
                return NextResponse.redirect(imgUrl);
            }
        }

        // If Wikipedia doesn't have it, try with "(cricketer)" suffix
        const cricketWikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle + '_(cricketer)')}`;
        const cricketRes = await fetch(cricketWikiUrl, {
            headers: { 'User-Agent': 'TheDugoutApp/1.0' },
            next: { revalidate: 86400 },
        });

        if (cricketRes.ok) {
            const cricketData = await cricketRes.json();
            if (cricketData.thumbnail?.source) {
                const imgUrl = cricketData.thumbnail.source.replace(/\/\d+px-/, `/${size}px-`);
                return NextResponse.redirect(imgUrl);
            }
        }

        // No image found — return 404
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    } catch (error) {
        console.error('Player image fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
    }
}
