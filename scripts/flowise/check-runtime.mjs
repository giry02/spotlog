import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChatflow, LOCAL_HTTP_DENY_LIST } from './chatflow.mjs';

const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const runtime = resolve(process.env.MOA_FLOWISE_RUNTIME_DIR || resolve(project, '.sites-runtime/ai/flowise'));
const requireRuntime = createRequire(resolve(runtime, 'package.json'));
const components = resolve(runtime, 'node_modules/flowise-components/package.json');
const requireComponents = createRequire(components);
const { checkDenyList } = requireComponents('./dist/src/httpSecurity.js');
process.env.HTTP_SECURITY_CHECK = 'false';
process.env.HTTP_DENY_LIST = LOCAL_HTTP_DENY_LIST;
await checkDenyList('http://127.0.0.1:11434');
const blocked = [
  '0.0.0.0', '127.0.0.0', '127.0.0.2', '127.0.0.3', '127.0.0.255',
  '127.0.1.0', '127.1.2.3', '127.255.255.255', '10.1.2.3', '172.16.0.1',
  '192.168.1.1', '169.254.169.253', '169.254.169.254', '224.0.0.1',
  '255.255.255.255', '[::1]', '[::ffff:127.0.0.2]', '[fc00::1]',
  '[fd00:ec2::254]', '[fe80::1]', '[ff00::1]',
];
for (const host of blocked) await assert.rejects(checkDenyList(`http://${host}/`));
console.log(`Flowise HTTP checker passed: exactly 127.0.0.1 permitted, ${blocked.length} protected addresses denied.`);

const graph = createChatflow();
const { nodeClass: ChatPromptTemplate } = requireComponents('./dist/nodes/prompts/ChatPromptTemplate/ChatPromptTemplate.js');
const promptData = graph.nodes.find((item) => item.data.name === 'chatPromptTemplate').data;
const prompt = await new ChatPromptTemplate().init(promptData, '', {});
assert.deepEqual(prompt.inputVariables, ['input']);
const input = JSON.stringify({ userMessage: '제주 1박2일 일정', context: { state: { region: null } } });
const formatted = await prompt.formatMessages({ input });
assert.equal(formatted.at(-1).content, input);
assert.match(formatted[0].content, /"actions"/);
assert.doesNotMatch(formatted[0].content, /\{\{"message"/);
for (const [name, relative] of [
  ['chatOllama', './dist/nodes/chatmodels/ChatOllama/ChatOllama.js'],
  ['llmChain', './dist/nodes/chains/LLMChain/LLMChain.js'],
]) {
  const { nodeClass } = requireComponents(relative);
  assert.equal(new nodeClass().name, name);
}
console.log(JSON.stringify({ status: 'passed', flowise: requireRuntime('flowise/package.json').version, nativePromptVariables: prompt.inputVariables, blockedAddressCases: blocked.length, permittedLocalOllama: true, nativeNodeModulesLoaded: ['chatOllama', 'chatPromptTemplate', 'llmChain'] }, null, 2));
