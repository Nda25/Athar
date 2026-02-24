// /.netlify/functions/invoices-list.js
// إرجاع فواتير/حركات الدفع للمستخدم الحالي (محمي)

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");
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
  }
);

const INVOICES_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.INVOICES_CACHE_TTL_MS || 15000)
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
  const perf = createPerf("invoices-list", event);

  // CORS preflight
  const pf = preflight(event);
  if (pf) return pf;

  if (event.httpMethod !== "GET") {
    perf.end({ statusCode: 405 });
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  // تحقق المستخدم (JWT)
  const gate = await requireUser(event);
  perf.mark("auth_done");
  const userObj = gate?.user || gate;
  const isOk = gate?.ok !== false;
  if (!isOk || !userObj) {
    perf.end({ statusCode: gate?.status || 401, unauthorized: true });
    return {
      statusCode: gate?.status || 401,
      headers: CORS,
      body: JSON.stringify({ error: gate?.error || "Unauthorized" }),
    };
  }

  const email = (userObj.email || userObj.user?.email || "").toLowerCase();
  const sub = userObj.sub || userObj.user?.sub || null;

  if (!email && !sub) {
    perf.end({ statusCode: 400, missing_identity: true });
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "No user identity" }),
    };
  }

  const cacheKey = `${sub || ""}|${email || ""}`;
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
    let q = supabase
      .from("invoices")
      .select(
        "created_at,amount,amount_sar,status,gateway,invoice_id,provider_event_id,email,user_sub"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    // فلترة بحسب الهوية المتوفرة
    if (email && sub) {
      // ملاحظة: Supabase .or تعمل كنص — نبقيها بسيطة بالقيم المباشرة
      q = q.or(`email.eq."${email}",user_sub.eq."${sub}"`);
    } else if (email) {
      q = q.eq("email", email);
    } else if (sub) {
      q = q.eq("user_sub", sub);
    }

    const { data, error } = await q;
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
