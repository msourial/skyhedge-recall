import { NextRequest, NextResponse } from 'next/server';
import snapshot from '../../../../data/snapshot.json';
export function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city') ?? 'nyc';
  const entry = snapshot.cities.find(c => c.city.id === city);
  return entry ? NextResponse.json({ generatedAt: snapshot.generatedAt, ...entry }) : NextResponse.json({ error: 'City not available' }, { status: 404 });
}
