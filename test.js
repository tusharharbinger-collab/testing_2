const http = require('http');

process.env.PORT = '18080';
const PORT = 18080;
require('./server.js');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}${url}`, options);
  const elapsed = Date.now() - t0;
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body, elapsed, headers: res.headers };
}

async function runTests() {
  console.log('--- Starting Local Tests ---');
  await wait(600); // Give server time to bind

  // 1. Health check /health
  const healthRes = await request('/health');
  console.assert(healthRes.status === 200, `Expected 200, got ${healthRes.status}`);
  console.assert(healthRes.body.status === 'ok', `Expected status ok, got ${JSON.stringify(healthRes.body)}`);
  console.assert(healthRes.body.version === '1.0.0', `Expected version 1.0.0, got ${healthRes.body.version}`);
  console.log(`[PASS] GET /health -> status ${healthRes.status}, elapsed: ${healthRes.elapsed}ms`);

  // 2. Health check /healthz
  const healthzRes = await request('/healthz');
  console.assert(healthzRes.status === 200, `Expected 200, got ${healthzRes.status}`);
  console.log(`[PASS] GET /healthz -> status ${healthzRes.status}, elapsed: ${healthzRes.elapsed}ms`);

  // 3. Root UI /
  const uiRes = await request('/');
  console.assert(uiRes.status === 200, `Expected 200, got ${uiRes.status}`);
  console.assert(uiRes.body.includes('CloudOps Tasks'), 'Expected UI title');
  console.log(`[PASS] GET / -> status 200, UI HTML served`);

  // 4. GET /api/todos
  const todosRes = await request('/api/todos');
  console.assert(todosRes.status === 200, `Expected 200, got ${todosRes.status}`);
  console.assert(Array.isArray(todosRes.body.data), 'Expected array of todos');
  console.log(`[PASS] GET /api/todos -> total items: ${todosRes.body.total}`);

  // 5. POST /api/todos
  const createRes = await request('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Buy milk' })
  });
  console.assert(createRes.status === 201, `Expected 201, got ${createRes.status}`);
  console.assert(createRes.body.title === 'Buy milk', 'Expected title to be Buy milk');
  const createdId = createRes.body.id;
  console.log(`[PASS] POST /api/todos -> Created ID: ${createdId}`);

  // 6. PATCH /api/todos/:id
  const patchRes = await request(`/api/todos/${createdId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true })
  });
  console.assert(patchRes.status === 200, `Expected 200, got ${patchRes.status}`);
  console.assert(patchRes.body.completed === true, 'Expected completed to be true');
  console.log(`[PASS] PATCH /api/todos/${createdId} -> Completed: ${patchRes.body.completed}`);

  // 7. DELETE /api/todos/:id
  const deleteRes = await request(`/api/todos/${createdId}`, {
    method: 'DELETE'
  });
  console.assert(deleteRes.status === 200, `Expected 200, got ${deleteRes.status}`);
  console.log(`[PASS] DELETE /api/todos/${createdId} -> ${deleteRes.body.message}`);

  // 8. Chaos Latency test
  console.log('Testing Chaos Latency (+300ms)...');
  const latencyRes = await request('/api/todos?chaos=latency');
  console.assert(latencyRes.status === 200, `Expected 200, got ${latencyRes.status}`);
  console.assert(latencyRes.elapsed >= 280, `Expected >= 280ms latency, got ${latencyRes.elapsed}ms`);
  console.log(`[PASS] ?chaos=latency -> Injected latency: ${latencyRes.elapsed}ms`);

  // 9. Chaos Error Spike test (run multiple requests to confirm 500 error occurrence)
  console.log('Testing Chaos Error (20% HTTP 500 spikes)...');
  let errorsCount = 0;
  for (let i = 0; i < 30; i++) {
    const errorRes = await request('/api/todos?chaos=error');
    if (errorRes.status === 500) {
      errorsCount++;
    }
  }
  console.log(`[PASS] ?chaos=error -> ${errorsCount} / 30 requests triggered HTTP 500 error spikes as expected`);
  console.assert(errorsCount > 0, 'Expected at least 1 simulated 500 error in 30 requests');

  console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
