import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Proxy the request to the Python FastAPI microservice running locally or on Render
    // Defaulting to port 8000 where FastAPI usually runs
    const baseUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
    const pythonApiUrl = `${baseUrl}/api/auction/decide`;
    
    const response = await fetch(pythonApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`ML Engine responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Auction AI Proxy Error:", error);
    return NextResponse.json({ 
      error: 'Failed to communicate with ML Engine',
      details: error.message 
    }, { status: 500 });
  }
}
