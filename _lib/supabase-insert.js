function logWriteError(table, status, code = 'unknown') {
  console.error(`[Supabase Error] status=${status} table=${table} code=${code} time=${new Date().toISOString()}`);
}

export async function insertSupabase(table, row) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      logWriteError(table, 'unknown');
      return false;
    }

    const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      let code = 'unknown';
      try {
        const error = await response.json();
        // Only accept an error-code token, never database row details or messages.
        if (typeof error?.code === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(error.code)) {
          code = error.code;
        }
      } catch {
        // A non-JSON error response still uses the same content-free log format.
      }
      logWriteError(table, response.status, code);
      return false;
    }

    return true;
  } catch {
    logWriteError(table, 'unknown');
    return false;
  }
}
