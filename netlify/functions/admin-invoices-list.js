// /.netlify/functions/admin-invoices-list.js
// إرجاع جميع الفواتير/حركات الدفع لمديري النظام

const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");
const { CORS, preflight } = require("./_cors.js");
const { createPerf } = require("./_perf.js");

// ===== Supabase (Service Role) =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` },
    },
  },
);

const INVOICES_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.INVOICES_CACHE_TTL_MS || 15000),
);
const invoicesCache = new Map();

function getCachedInvoices(key) {
  if (!INVOICES_CACHE_TTL_MS) return null;
  const item = invoicesCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    invoicesCache.delete(key);
    return null;
  }
  return item.value;
}

function setCachedInvoices(key, value) {
  if (!INVOICES_CACHE_TTL_MS) return;
  invoicesCache.set(key, {
    value,
    expiresAt: Date.now() + INVOICES_CACHE_TTL_MS,
  });
}

exports.handler = async (event) => {
  const perf = createPerf("admin-invoices-list", event);

  // CORS preflight
  const pf = preflight(event);
  if (pf) return pf;

  if (event.httpMethod !== "GET") {
    perf.end({ statusCode: 405 });
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  // تحقق صلاحيات الإدارة (JWT Admin Role)
  const gate = await requireAdmin(event);
  perf.mark("auth_done");
  if (!gate.ok) {
    perf.end({ statusCode: gate.status || 403, unauthorized: true });
    return {
      statusCode: gate.status || 403,
      headers: CORS,
      body: JSON.stringify({ error: gate.error || "Admins only" }),
    };
  }

  const cacheKey = "admin_all_invoices";
  const cached = getCachedInvoices(cacheKey);
  if (cached) {
    perf.end({ statusCode: 200, cache: "hit" });
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json; charset=utf-8",
        "X-Athar-Cache": "HIT",
      },
      body: JSON.stringify(cached),
    };
  }

  try {
    // جلب جميع الفواتير دون فلترة مرتبة من الأحدث
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "created_at,amount,amount_sar,status,gateway,invoice_id,provider_event_id,email,user_sub",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    perf.mark("db_done");
    if (error) {
      perf.end({ statusCode: 500, db_error: true });
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: error.message }),
      };
    }

    const responseBody = { ok: true, rows: data || [] };
    setCachedInvoices(cacheKey, responseBody);
    perf.end({ statusCode: 200, cache: "miss", rows: (data || []).length });

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json; charset=utf-8",
        "X-Athar-Cache": "MISS",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (e) {
    perf.end({ statusCode: 500, unhandled: true });
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message || "Server error" }),
    };
  }
};
