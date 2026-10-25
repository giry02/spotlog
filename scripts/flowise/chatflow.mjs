import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const FLOWISE_VERSION = '3.1.4';
export const FLOW_NAME = 'Moa local structured actions v1';
export const PLANNER_FLOW_NAME = 'Moa local RAG itinerary v1';

export function loopbackOrigin(value, name) {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) throw new Error(`${name} must be an HTTP 127.0.0.1 origin`);
  return url.origin;
}

// Preserve the 3.1.4 default protection ranges, permitting exactly 127.0.0.1
// for this deliberately local Ollama deployment. The remaining 127/8 is split
// into CIDRs so 127.0.0.2, 127.1.2.3, etc. are still denied.
export const LOCAL_HTTP_DENY_LIST = [
  '0.0.0.0', '10.0.0.0/8', '169.254.0.0/16', '169.254.169.253',
  '169.254.169.254', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4',
  '240.0.0.0/4', '255.255.255.255/32', '::', '::1', 'fc00::/7',
  'fd00:ec2::254', 'fe80::/10', 'ff00::/8',
  'localhost', 'ip6-localhost', 'metadata.google.internal',
  '127.0.0.0/32',
  ...Array.from({ length: 23 }, (_, index) => {
    const address = 2 ** (index + 1);
    return `127.${(address >>> 16) & 255}.${(address >>> 8) & 255}.${address & 255}/${31 - index}`;
  }),
].join(',');

const scalar = (label, name, type, optional = false) => ({ label, name, type, optional });
function node({ id, label, name, type, version, category, baseClasses, inputs, inputParams, inputAnchors = [], outputs = {} }, x, y) {
  const params = inputParams.map((parameter) => ({ ...parameter, id: `${id}-input-${parameter.name}-${parameter.type}` }));
  const anchors = inputAnchors.map((parameter) => ({ ...parameter, id: `${id}-input-${parameter.name}-${parameter.type}` }));
  const outputAnchors = outputs.output ? [{
    name: 'output', label: 'Output', type: 'options', default: 'llmChain',
    options: [
      { id: `${id}-output-llmChain-${baseClasses.join('|')}`, name: 'llmChain', label: 'LLM Chain', type: baseClasses.join(' | ') },
      { id: `${id}-output-outputPrediction-string|json`, name: 'outputPrediction', label: 'Output Prediction', type: 'string | json' },
    ],
  }] : [{ id: `${id}-output-${name}-${baseClasses.join('|')}`, name, label: type, type: baseClasses.join(' | ') }];
  return {
    id, type: 'customNode', position: { x, y }, positionAbsolute: { x, y }, width: 300,
    data: { id, label, version, name, type, category, baseClasses, inputParams: params, inputAnchors: anchors, inputs, outputAnchors, outputs, selected: false },
    selected: false, dragging: false,
  };
}

export function createChatflow({ ollamaBaseUrl = 'http://127.0.0.1:11434', model = 'qwen3:8b', systemPrompt } = {}) {
  const baseUrl = loopbackOrigin(ollamaBaseUrl, 'OLLAMA_BASE_URL');
  if (!/^[A-Za-z0-9_.:/-]{1,160}$/.test(model)) throw new Error('Invalid model name');
  const promptPath = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'docs/flowise-system-prompt.txt');
  const promptText = systemPrompt ?? readFileSync(promptPath, 'utf8');
  // Every brace in this system text is literal. Human input has one LangChain
  // variable and receives the entire server-owned JSON envelope unchanged.
  const escapedSystem = promptText.replaceAll('{', '{{').replaceAll('}', '}}');
  const modelNode = node({
    id: 'chatOllama_0', label: 'Ollama', name: 'chatOllama', type: 'ChatOllama', version: 5,
    category: 'Chat Models', baseClasses: ['ChatOllama', 'BaseChatModel', 'BaseLanguageModel', 'Runnable'],
    inputParams: [scalar('Base URL', 'baseUrl', 'string'), scalar('Model Name', 'modelName', 'string'), scalar('Temperature', 'temperature', 'number', true), scalar('Streaming', 'streaming', 'boolean', true), scalar('Think', 'think', 'boolean', true), scalar('JSON Mode', 'jsonMode', 'boolean', true), scalar('Context Window Size', 'numCtx', 'number', true), scalar('Repeat Penalty', 'repeatPenalty', 'number', true), scalar('Repeat Last N', 'repeatLastN', 'number', true), scalar('Keep Alive', 'keepAlive', 'string', true)],
    inputs: { baseUrl, modelName: model, temperature: '0', streaming: false, think: false, jsonMode: true, numCtx: '12288', repeatPenalty: '1.1', repeatLastN: '128', keepAlive: '10m' },
  }, 0, 0);
  const promptNode = node({
    id: 'chatPromptTemplate_0', label: 'Chat Prompt Template', name: 'chatPromptTemplate', type: 'ChatPromptTemplate', version: 2,
    category: 'Prompts', baseClasses: ['ChatPromptTemplate', 'BaseChatPromptTemplate', 'BasePromptTemplate'],
    inputParams: [scalar('System Message', 'systemMessagePrompt', 'string'), scalar('Human Message', 'humanMessagePrompt', 'string'), scalar('Format Prompt Values', 'promptValues', 'json', true)],
    inputs: { systemMessagePrompt: escapedSystem, humanMessagePrompt: '{input}', promptValues: '' },
  }, 0, 580);
  const chainNode = node({
    id: 'llmChain_0', label: 'LLM Chain', name: 'llmChain', type: 'LLMChain', version: 3,
    category: 'Chains', baseClasses: ['LLMChain', 'BaseChain', 'Runnable'],
    inputParams: [scalar('Chain Name', 'chainName', 'string', true)],
    inputAnchors: [scalar('Language Model', 'model', 'BaseLanguageModel'), scalar('Prompt', 'prompt', 'BasePromptTemplate')],
    inputs: { model: '{{chatOllama_0.data.instance}}', prompt: '{{chatPromptTemplate_0.data.instance}}', chainName: 'moaStructuredActions' },
    outputs: { output: 'llmChain' },
  }, 480, 280);
  const edges = [[modelNode, 'model', 'BaseLanguageModel'], [promptNode, 'prompt', 'BasePromptTemplate']].map(([source, input, inputType]) => ({
    id: `${source.id}-llmChain_0-${input}`, source: source.id,
    sourceHandle: source.data.outputAnchors[0].id,
    target: chainNode.id, targetHandle: `${chainNode.id}-input-${input}-${inputType}`,
    type: 'buttonedge', data: { label: '' },
  }));
  return { nodes: [modelNode, promptNode, chainNode], edges, viewport: { x: 0, y: 0, zoom: 0.7 } };
}

export function createItineraryChatflow(options = {}) {
  const promptPath = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'docs/flowise-itinerary-system-prompt.txt');
  const graph = createChatflow({ ...options, systemPrompt: options.systemPrompt ?? readFileSync(promptPath, 'utf8') });
  graph.nodes.find((item) => item.data.name === 'llmChain').data.inputs.chainName = 'moaRagItinerary';
  return graph;
}
