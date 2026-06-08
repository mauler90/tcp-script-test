const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {}

  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token mancante' }) };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorizzato' }) };
  }
  const userId = user.id;

  try {
    // PAIRS
    if (path === '/pairs') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('pairs').select('*').eq('user_id', userId);
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
      if (method === 'POST') {
        await supabase.from('pairs').delete().eq('user_id', userId);
        const { error } = await supabase.from('pairs').insert({ user_id: userId, data: body.data, updated_at: new Date().toISOString() });
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // ORDERS
    if (path === '/orders') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId);
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
      if (method === 'POST') {
        await supabase.from('orders').delete().eq('user_id', userId);
        const { error } = await supabase.from('orders').insert({ user_id: userId, data: body.data, updated_at: new Date().toISOString() });
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // TRATTE
    if (path === '/tratte') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('tratte').select('*').eq('user_id', userId);
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
      if (method === 'POST') {
        await supabase.from('tratte').delete().eq('user_id', userId);
        const { error } = await supabase.from('tratte').insert({ user_id: userId, data: body.data, updated_at: new Date().toISOString() });
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // ALIAS
    if (path === '/alias') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('alias').select('*').eq('user_id', userId);
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
      if (method === 'POST') {
        await supabase.from('alias').delete().eq('user_id', userId);
        const { error } = await supabase.from('alias').insert({ user_id: userId, data: body.data, updated_at: new Date().toISOString() });
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // TAPPE
    if (path === '/tappe') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('tappe').select('*').eq('user_id', userId);
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify(data.map(r => r.valore)) };
      }
      if (method === 'POST') {
        await supabase.from('tappe').delete().eq('user_id', userId);
        const rows = (body.tappe || []).map(v => ({ user_id: userId, valore: v }));
        if (rows.length) {
          const { error } = await supabase.from('tappe').insert(rows);
          if (error) throw error;
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // TARIFFARIO
    if (path === '/tariffario') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('tariffario').select('*').eq('user_id', userId).order('km');
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
      if (method === 'POST') {
        await supabase.from('tariffario').delete().eq('user_id', userId);
        const rows = (body.tariffario || []).map(r => ({ user_id: userId, km: r.km, c20: r.c20, c40: r.c40 }));
        if (rows.length) {
          const { error } = await supabase.from('tariffario').insert(rows);
          if (error) throw error;
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // CONFIG
    if (path === '/config') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('config').select('*').eq('user_id', userId);
        if (error) throw error;
        const result = {};
        data.forEach(r => { result[r.chiave] = r.valore; });
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      if (method === 'POST') {
        const { error } = await supabase.from('config').upsert({ user_id: userId, chiave: body.chiave, valore: body.valore, updated_at: new Date().toISOString() }, { onConflict: 'user_id,chiave' });
        if (error) throw error;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint non trovato' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
