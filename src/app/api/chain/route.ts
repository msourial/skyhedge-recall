import { NextResponse } from 'next/server';
import snapshot from '../../../../data/snapshot.json';
import { captureChain } from '../../../lib/tatum';
export const dynamic = 'force-dynamic';
/** Serve captured or live read-only GraphQL chain evidence; rainfall uses mm and probabilities use 0..1. */
export async function GET() {
  return NextResponse.json(process.env.TATUM_API_KEY ? await captureChain() : snapshot.chain);
}
