import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { createApp } from '../server';

let handlerCached: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!handlerCached) {
    const app = await createApp();
    handlerCached = serverless(app);
  }
  return handlerCached;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fn = await getHandler();
  return fn(req, res);
}