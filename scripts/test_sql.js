const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testSql() {
  console.log('Testing SQL on:', url);
  try {
    const res = await fetch(`${url}/pg`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'SELECT 1;' })
    });
    console.log('PG endpoint status:', res.status);
    console.log('PG response:', await res.text());
  } catch (e) {
    console.log('PG error:', e.message);
  }
}

testSql();
