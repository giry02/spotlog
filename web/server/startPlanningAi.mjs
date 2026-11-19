import { createServer } from 'node:http';
import { createPlanningAiHandler } from './planningAiGateway.mjs';
import { loadPublicPlanningCatalog } from './publicPlanningCatalog.mjs';

const port = Number(process.env.SPOTLOG_PLANNING_AI_PORT || 8788);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SPOTLOG_PLANNING_AI_PORT must be a valid TCP port.');
const catalogPath = process.env.SPOTLOG_PLANNING_AI_CATALOG;
if (!catalogPath) throw new Error('Set SPOTLOG_PLANNING_AI_CATALOG to the exported public catalog JSON file.');

const catalog = await loadPublicPlanningCatalog(catalogPath);
const handle = createPlanningAiHandler({
  catalog,
  modelUrl: process.env.SPOTLOG_PLANNING_AI_MODEL_URL || 'http://127.0.0.1:11435/v1/chat/completions',
  model: process.env.SPOTLOG_PLANNING_AI_MODEL || 'spotlog-local',
  apiKey: process.env.SPOTLOG_PLANNING_AI_MODEL_KEY,
  allowedOrigin: process.env.SPOTLOG_PLANNING_AI_ORIGIN || 'http://127.0.0.1:5212',
  enableLocalChatSummary: process.env.SPOTLOG_LOCAL_CHAT_AI === '1',
});

const server = createServer({ headersTimeout: 10_000, requestTimeout: 10_000 }, async (request, response) => {
  try {
    if (await handle(request, response)) return;
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end();
  } catch {
    if (!response.headersSent) response.writeHead(500, { 'Cache-Control': 'no-store' });
    response.end();
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Spotlog planning API listening on http://127.0.0.1:${port}/api/planning-ai (${catalog.length} public places)`);
});
