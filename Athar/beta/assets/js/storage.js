// assets/js/storage.js  — نسخة مُحسّنة تمنع التكرار و"already been declared"
(function () {
  "use strict";

  // امنعي تحميل الملف أكثر من مرة
  if (window.__ATHAR_STORAGE_LOADED__) return;
  window.__ATHAR_STORAGE_LOADED__ = true;

  // ===== Helpers بسيطة (احتياطي) =====
  if (typeof window.$ === "undefined") {
    window.$ = (sel, root = document) => root.querySelector(sel);
  }

  // ==============================
  // قاعدة بيانات محلية بسيطة للفورمات (Global)
  // ==============================
  if (!window.userDB) {
    function userKey() { return "athar:data"; }
    window.userDB = {
      getAll() {
        try { return JSON.parse(localStorage.getItem(userKey()) || "{}"); }
        catch (_) { return {}; }
      },
      setAll(obj) {
        localStorage.setItem(userKey(), JSON.stringify(obj || {}));
      },
      get(page, fallback = {}) {
        const all = this.getAll();
        return (all && all[page] !== undefined) ? all[page] : fallback;
      },
      set(page, data) {
        const all = this.getAll();
        all[page] = data;
        this.setAll(all);
      },
      merge(page, partial) {
        const cur = this.get(page, {});
        this.set(page, Object.assign({}, cur, partial));
      },
      remove(page) {
        const all = this.getAll();
        delete all[page];
        this.setAll(all);
      },
      clearThisUser() {
        this.setAll({});
      }
    };
  }

  // ==============================
  // أدوات تحقق عامة (Global)
  // ==============================
  if (!window.isValidEmail) window.isValidEmail = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
  if (!window.isValidPhone) window.isValidPhone = (x) => /^05\d{8}$/.test(x);

  // ==============================
  // أوتو-حفظ: قراءة/ملء/ربط (Global)
  // ==============================
  if (!window.readForm) {
    window.readForm = function readForm(container) {
      const data = {};
      const root = (typeof container === "string") ? document.querySelector(container) : container;
      if (!root) return data;

      root.querySelectorAll("input, textarea, select").forEach(el => {
        const key = el.name || el.id;
        if (!key) return;

        if (el.tagName === "SELECT") {
          data[key] = el.multiple
            ? Array.from(el.selectedOptions).map(o => o.value)
            : el.value;
          return;
        }

        if (el.type === "checkbox") {
          const group = root.querySelectorAll(`input[type="checkbox"][name="${el.name}"]`);
          if (group.length > 1) {
            data[key] = Array.from(group).filter(i => i.checked).map(i => i.value || true);
          } else {
            data[key] = !!el.checked;
          }
          return;
        }

        if (el.type === "radio") {
          if (el.checked) data[key] = el.value;
          else if (!(key in data)) data[key] = "";
          return;
        }

        if (el.type === "number") {
          data[key] = (el.value === "" ? "" : +el.value);
          return;
        }

        data[key] = el.value;
      });

      return data;
    };
  }

  if (!window.fillForm) {
    window.fillForm = function fillForm(container, data) {
      const root = (typeof container === "string") ? document.querySelector(container) : container;
      if (!root || !data) return;

      Object.entries(data).forEach(([k, v]) => {
        const els = root.querySelectorAll(`[name="${k}"], #${CSS.escape(k)}`);
        if (!els.length) return;

        els.forEach(el => {
          if (el.tagName === "SELECT") {
            if (el.multiple && Array.isArray(v)) {
              Array.from(el.options).forEach(o => o.selected = v.includes(o.value));
            } else {
              el.value = (v ?? "");
            }
            return;
          }

          if (el.type === "checkbox") {
            const group = root.querySelectorAll(`input[type="checkbox"][name="${el.name}"]`);
            if (group.length > 1 && Array.isArray(v)) {
              el.checked = v.includes(el.value || true);
            } else {
              el.checked = !!v;
            }
            return;
          }

          if (el.type === "radio") {
            el.checked = (el.value == v);
            return;
          }

          el.value = (v == null ? "" : v);
        });
      });
    };
  }

  if (!window.bindAutoSave) {
    window.bindAutoSave = function bindAutoSave(pageKey, container) {
      const root = (typeof container === "string") ? document.querySelector(container) : container;
      if (!root) return;

      window.fillForm(root, window.userDB.get(pageKey, {}));

      let t = null;
      const save = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const data = window.readForm(root);
          window.userDB.set(pageKey, data);
        }, 250);
      };

      root.addEventListener("input", save);
      root.addEventListener("change", save);
    };
  }

  // ==============================
  // Supabase للمتصفح (مع حارس منع تكرار التصريح)
  // ==============================

  // تحضير قيم افتراضية فقط إذا ما كانت مضبوطة من قبل
  if (typeof window.SUPABASE_URL === "undefined") {
    window.SUPABASE_URL = "https://oywqpkzaudmzwvytxaop.supabase.co";
  }
  if (typeof window.SUPABASE_ANON_KEY === "undefined") {
    window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";
  }

  // استخدمي عميل supa الموجود، وإلا أنشئي واحدًا إن توفر كائن supabase
  const supa = window.supa || (window.supabase ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { auth:{ persistSession:false }}) : null);

  // Helpers: قراءة مستخدم Auth0 بأمان
  const auth0SafeGetUser = async () => {
    try {
      if (window.auth?.getUser) return await window.auth.getUser();
      if (window.auth0Client?.getUser) return await window.auth0Client.getUser();
    } catch (_) {}
    return null;
  };

  // **توكن للوصول لوظائف محمية** (احتياطي)
  if (!window.auth0SafeGetToken) {
    window.auth0SafeGetToken = async function auth0SafeGetToken() {
      try {
        const aud = (window.__CFG && window.__CFG.api_audience) || "https://api.n-athar";
        if (window.auth?.getTokenSilently) {
          return await window.auth.getTokenSilently({
            authorizationParams: { audience: aud, scope: "openid profile email offline_access" }
          });
        }
        if (window.auth0Client?.getTokenSilently) {
          return await window.auth0Client.getTokenSilently({
            authorizationParams: { audience: aud, scope: "openid profile email offline_access" }
          });
        }
      } catch (_) {}
      return null;
    };
  }

  // ==============================
  // دوال Supabase إضافية للتوافق مع البروفايل الجديد
  // ==============================

  /**
   * supaEnsureUserProfile
   * يستدعي Function (service role) لتأسيس/تحديث المستخدم في جدول users
   */
  async function supaEnsureUserProfile(profile = {}) {
    if (!profile.sub || !profile.email) {
      const u = await auth0SafeGetUser();
      if (!u) return { ok: false, error: "no auth0 user" };
      profile = {
        sub: u.sub,
        email: String(u.email || "").toLowerCase(),
        name: u.name || u.nickname || null,
        picture: u.picture || null
      };
    }

    try {
      const res = await fetch("/.netlify/functions/upsert-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      const json = await res.json();
      return { ok: true, data: json.user };
    } catch (e) {
      return { ok: false, error: e.message || "network error" };
    }
  }

  /**
   * supaSaveUserPrefs(partial)
   * يحفظ (أو يحدّث) صف تفضيلات المستخدم في جدول user_prefs
   * أمثلة partial:
   *   { display_name: "ندى" }
   *   { avatar_url: "https://..." }
   *   { theme_color: "#f472b6" }
   */
  async function supaSaveUserPrefs(partial = {}) {
    try {
      if (!supa) return { ok:false, error:"supa unavailable" };
      const u = await auth0SafeGetUser();
      if (!u?.sub) return { ok:false, error:"no user" };

      const row = Object.assign({ user_sub: u.sub }, partial);
      const { data, error } = await supa
        .from("user_prefs")
        .upsert(row, { onConflict: "user_sub" })
        .select()
        .maybeSingle();
      if (error) return { ok:false, error };
      return { ok:true, data };
    } catch (e) {
      return { ok:false, error: e.message || e };
    }
  }

  /**
   * supaGetUserPrefs()
   * يرجع صف التفضيلات لهذا المستخدم (إن وُجد)
   */
  async function supaGetUserPrefs() {
    try {
      if (!supa) return { ok:false, error:"supa unavailable" };
      const u = await auth0SafeGetUser();
      if (!u?.sub) return { ok:false, error:"no user" };

      const { data, error } = await supa
        .from("user_prefs")
        .select("*")
        .eq("user_sub", u.sub)
        .maybeSingle();
      if (error) return { ok:false, error };
      return { ok:true, data };
    } catch (e) {
      return { ok:false, error:e.message || e };
    }
  }

  // تسجيل استخدام أداة (كما هو)
  async function supaLogToolUsage(toolName, meta = {}) {
    try {
      const u = await auth0SafeGetUser();
      const payload = {
        tool_name: toolName,
        user_email: u?.email ? String(u.email).toLowerCase() : null,
        user_sub: u?.sub || null,
        meta
      };
      const res = await fetch("/.netlify/functions/log-tool-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      // 204 = تجاهُل بدون خطأ
      if (!res.ok && res.status !== 204) {
        return { ok: false, error: await res.text() };
      }
      return { ok: true, data: res.status === 204 ? null : await res.json() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // قراءة مستخدم عبر الإيميل (اختياري)
  async function supaGetUserByEmail(email) {
    if (!supa) return { ok:false, error:"supa unavailable" };
    const { data, error } = await supa
      .from("users")
      .select("*")
      .eq("email", String(email).toLowerCase())
      .single();
    return { ok: !error, data, error };
  }

  // تعريض الدوال مرة واحدة (بدون كسر تعريفات سابقة)
  window.supaEnsureUserProfile = window.supaEnsureUserProfile || supaEnsureUserProfile;
  window.supaLogToolUsage     = window.supaLogToolUsage     || supaLogToolUsage;
  window.supaGetUserByEmail   = window.supaGetUserByEmail   || supaGetUserByEmail;
  window.supaSaveUserPrefs    = window.supaSaveUserPrefs    || supaSaveUserPrefs;
  window.supaGetUserPrefs     = window.supaGetUserPrefs     || supaGetUserPrefs;
  window.supa                 = window.supa || supa;

  // ==============================
  // الثيم (الوضع الداكن + لون الواجهة)
  // ==============================

  // توحيد "dark" على <html> بدل <body> (لو قديم)
  (function unifyDarkClass() {
    var root = document.documentElement;
    var body = document.body;
    if (!body) return;
    if (body.classList.contains("dark")) {
      body.classList.remove("dark");
      root.classList.add("dark");
    }
  })();

  // تفعيل/تعطيل الوضع الداكن مع حفظ مفتاح "theme"
  (function initDarkMode() {
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (_) {}
    if (saved === "dark") root.classList.add("dark");
    else if (saved === "light") root.classList.remove("dark");
    // إن كان null نتركه حسب النظام/الوضع الحالي
  })();

  if (!window.bindThemeToggle) {
    window.bindThemeToggle = function bindThemeToggle() {
      const root = document.documentElement;
      const btn = document.getElementById("themeToggle");
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const dark = root.classList.toggle("dark");
        try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (_) {}
        if (typeof window.toast === "function") {
          toast(dark ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
        }
      });
    };
  }

  // لون الواجهة الأساسي (CSS var --primary) مفتاح محلي: athar:theme
  (function initPrimaryColor() {
    try {
      var c = localStorage.getItem("athar:theme");
      if (c) document.documentElement.style.setProperty("--primary", c);
    } catch (_){}
  })();

  /**
   * setPrimaryColor(color)
   * يغير لون الواجهة ويخزّنه محليًا ويزامنه مع Supabase (user_prefs.theme_color)
   */
  if (!window.setPrimaryColor) {
    window.setPrimaryColor = async function setPrimaryColor(color) {
      try {
        if (color) {
          document.documentElement.style.setProperty("--primary", color);
          localStorage.setItem("athar:theme", color);
        } else {
          // إعادة اللون الافتراضي (from :root --sea-600)
          const def = getComputedStyle(document.documentElement).getPropertyValue("--sea-600") || "#1e40af";
          document.documentElement.style.setProperty("--primary", def.trim() || "#1e40af");
          localStorage.removeItem("athar:theme");
        }
      } catch (_){}

      // مزامنة مع user_prefs (لا تفشل الصفحة لو supa غير متاح)
      try {
        const u = await auth0SafeGetUser();
        if (u?.sub && supa) {
          await supaSaveUserPrefs({ theme_color: color || null });
        }
      } catch (_){}
    };
  }

  // مودالات + توست (كما هي)
  if (!window.openModal)  window.openModal  = (id) => { const n = $(id); if (n) n.classList.add("show"); };
  if (!window.closeModal) window.closeModal = (id) => { const n = $(id); if (n) n.classList.remove("show"); };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".modal [data-close]");
    if (!btn) return;
    e.preventDefault();
    const m = btn.closest(".modal"); if (m) m.classList.remove("show");
  });

  if (!window.toast) {
    window.toast = (msg) => {
      let t = document.querySelector(".toast");
      if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 1800);
    };
  }
})();
