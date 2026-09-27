import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { GatewayError, GatewayProvider, toGatewayModelId } from './gateway.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function mockFetch(status: number, payload: unknown): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
      status,
    });
  }) as typeof fetch;
  return calls;
}

const GENERATION = JSON.stringify({
  operations: [{ action: 'create', path: 'index.html', content: '<h1>Hi</h1>' }],
  dependencies: [],
  buildCommand: '',
});

test('short model names map to gateway ids', () => {
  assert.equal(toGatewayModelId('gemini-2.5-flash'), 'google/gemini-2.5-flash');
  assert.equal(toGatewayModelId('claude-sonnet-4-6'), 'anthropic/claude-sonnet-4.6');
  assert.equal(toGatewayModelId('gpt-5.5'), 'openai/gpt-5.5');
  assert.equal(toGatewayModelId('gpt-image-1'), 'openai/gpt-image-1');
});

test('ids that are already qualified pass through', () => {
  assert.equal(toGatewayModelId('google/gemini-2.5-pro'), 'google/gemini-2.5-pro');
});

test('generate sends the prompt to the gateway and parses the result', async () => {
  const calls = mockFetch(200, {
    choices: [{ message: { content: GENERATION } }],
    usage: { prompt_tokens: 120, completion_tokens: 45 },
  });

  const provider = new GatewayProvider('test-key', 'gemini-2.5-flash');
  const result = await provider.generate({
    prompt: 'A bakery site',
    framework: 'html',
    context: 'You build websites.',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://ai-gateway.vercel.sh/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-key');
  assert.equal(calls[0].body.model, 'google/gemini-2.5-flash');
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.deepEqual(calls[0].body.messages, [
    { role: 'system', content: 'You build websites.' },
    { role: 'user', content: 'A bakery site' },
  ]);

  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].path, 'index.html');
  assert.deepEqual(result.tokensUsed, { input: 120, output: 45 });
});

test('edit includes the current files in the request', async () => {
  const calls = mockFetch(200, { choices: [{ message: { content: GENERATION } }] });

  const provider = new GatewayProvider('test-key', 'claude-sonnet-4-6');
  await provider.edit({
    instruction: 'Make the heading bigger',
    files: { 'index.html': '<h1>Hi</h1>' },
  });

  const messages = calls[0].body.messages as Array<{ role: string; content: string }>;
  assert.equal(calls[0].body.model, 'anthropic/claude-sonnet-4.6');
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Make the heading bigger/);
  assert.match(messages[0].content, /--- index\.html ---/);
});

test('chat keeps the conversation order and only asks for JSON on request', async () => {
  const calls = mockFetch(200, { choices: [{ message: { content: 'Hello' } }] });

  const provider = new GatewayProvider('test-key', 'gpt-5.5');
  const result = await provider.chat('Be brief.', [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello' },
    { role: 'user', content: 'Build me a site' },
  ]);

  assert.equal(result.content, 'Hello');
  assert.equal(calls[0].body.response_format, undefined);
  assert.deepEqual(
    (calls[0].body.messages as Array<{ role: string }>).map((m) => m.role),
    ['system', 'user', 'assistant', 'user'],
  );
});

test('a gateway failure carries its status code', async () => {
  mockFetch(402, { error: { message: 'Insufficient credits' } });

  const provider = new GatewayProvider('test-key', 'gemini-2.5-flash');
  await assert.rejects(
    provider.chat('', [{ role: 'user', content: 'Hi' }]),
    (err: unknown) => {
      assert.ok(err instanceof GatewayError);
      assert.equal(err.status, 402);
      assert.match(err.message, /Insufficient credits/);
      return true;
    },
  );
});

test('an unparseable generation is reported as an error', async () => {
  mockFetch(200, { choices: [{ message: { content: 'not json at all' } }] });

  const provider = new GatewayProvider('test-key', 'gemini-2.5-flash');
  await assert.rejects(provider.generate({ prompt: 'x', framework: 'html' }));
});
