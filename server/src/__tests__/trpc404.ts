import assert from 'node:assert/strict';

process.env.CORS_ORIGINS = 'http://localhost';
process.env.PHILIA_DB_URL = ':memory:';

interface ErrorShape {
  message?: string;
  data?: {
    code?: string;
    httpStatus?: number;
    stack?: string;
  };
}

interface ErrorEnvelope {
  error?: ErrorShape & { json?: ErrorShape };
}

const [{ createApp }, { client }] = await Promise.all([import('../index'), import('../db')]);

try {
  const response = await createApp().request('http://test.local/trpc/__pd58_missing__');
  const raw = await response.text();
  const envelope = JSON.parse(raw) as ErrorEnvelope;
  const error = envelope.error?.json ?? envelope.error;

  console.log(JSON.stringify({ status: response.status, body: envelope }, null, 2));
  assert.equal(response.status, 404);
  assert.ok(error);
  assert.ok(error.message);
  assert.ok(error.data);
  assert.equal(error.data.code, 'NOT_FOUND');
  assert.equal(error.data.httpStatus, 404);
  assert.equal(Object.hasOwn(error.data, 'stack'), false);
  assert.doesNotMatch(raw, /"stack"\s*:|\/app\/server/);
  console.log(`✓ NODE_ENV=${process.env.NODE_ENV ?? 'unset'} 不存在 tRPC 路径：404，无 stack，保留 code + message + httpStatus`);
} finally {
  client.close();
}
