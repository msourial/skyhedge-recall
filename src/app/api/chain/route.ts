import { NextResponse } from 'next/server';
import snapshot from '../../../../data/snapshot.json';
import { captureChain } from '../../../lib/tatum';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(process.env.TATUM_API_KEY ? await captureChain() : snapshot.chain); }
