// netlify/functions/gist-sync.js
// Funzione schedulata: legge il Gist del collega e aggiorna il DB Supabase
// Viene chiamata ogni 10 minuti da Netlify Scheduled Functions

const { createClient } = require('@supabase/supabase-js');

const COLLEGA_GIST_ID = '486d0c474acacd810696b6f28542681f';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// User ID del collega — da aggiornare quando crei il suo account
const COLLEGA_USER_ID = process.env.COLLEGA_USER_ID || 'collega-placeholder';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchGist(gistId) {
  const r = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'SRC-GistSync/1.0'
    }
  });
  if (!r.ok) throw new Error(`GitHub API error: ${r.status}`);
  return r.json();
}

function parseGistFile(gistData, filename) {
  const file = gistData.files[filename];
  if (!file) return null;
  try { return JSON.parse(file.content); } catch(e) { return null; }
}

async function upsertData(table, userId, data) {
  // Prima cancella i dati esistenti del collega, poi reinserisce
  await supabase.from(table).delete().eq('user_id', userId);
  if (!data || !data.length) return;
  const { error } = await supabase.from(table).insert({
    user_id: userId,
    data: data,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Errore upsert ${table}: ${error.message}`);
}

async function upsertTappe(userId, tappe) {
  await supabase.from('tappe').delete().eq('user_id', userId);
  if (!tappe || !tappe.length) return;
  const rows = tappe.map(v => ({ user_id: userId, valore: v }));
  const { error } = await supabase.from('tappe').insert(rows);
  if (error) throw new Error(`Errore upsert tappe: ${error.message}`);
}

async function logSync(status, details) {
  try {
    await supabase.from('config').upsert({
      user_id: COLLEGA_USER_ID,
      chiave: 'last_gist_sync',
      valore: { status, details, timestamp: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,chiave' });
  } catch(e) {
    // non bloccare per un errore di log
  }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  // Permetti anche chiamata manuale via GET (per test)
  const isManual = event.httpMethod === 'GET' || event.httpMethod === 'POST';

  try {
    if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN non configurato');
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL non configurato');

    console.log(`[gist-sync] Avvio sync Gist collega: ${COLLEGA_GIST_ID}`);

    const gistData = await fetchGist(COLLEGA_GIST_ID);
    const results = {};

    // Sync PAIRS
    const pairsData = parseGistFile(gistData, 'tcp_pairs.json');
    if (pairsData && pairsData.pairs) {
      await upsertData('pairs', COLLEGA_USER_ID, pairsData.pairs);
      results.pairs = pairsData.pairs.length;
      console.log(`[gist-sync] Pairs: ${pairsData.pairs.length}`);
    }

    // Sync TRATTE
    const tratteData = parseGistFile(gistData, 'tcp_tratte.json');
    if (tratteData && tratteData.tratte) {
      await upsertData('tratte', COLLEGA_USER_ID, tratteData.tratte);
      results.tratte = tratteData.tratte.length;
      console.log(`[gist-sync] Tratte: ${tratteData.tratte.length}`);
    }

    // Sync ALIAS
    const aliasData = parseGistFile(gistData, 'tcp_alias.json');
    if (aliasData && aliasData.alias) {
      await upsertData('alias', COLLEGA_USER_ID, aliasData.alias);
      results.alias = aliasData.alias.length;
      console.log(`[gist-sync] Alias: ${aliasData.alias.length}`);
    }

    // Sync TAPPE
    const tappeData = parseGistFile(gistData, 'tcp_tappe.json');
    if (tappeData && tappeData.tappe) {
      await upsertTappe(COLLEGA_USER_ID, tappeData.tappe);
      results.tappe = tappeData.tappe.length;
      console.log(`[gist-sync] Tappe: ${tappeData.tappe.length}`);
    }

    await logSync('ok', results);
    console.log('[gist-sync] Sync completato:', results);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, synced: results, timestamp: new Date().toISOString() })
    };

  } catch(err) {
    console.error('[gist-sync] Errore:', err.message);
    await logSync('error', { message: err.message });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
