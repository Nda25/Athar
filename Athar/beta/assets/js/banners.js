/* ============================
 * banners.js - Banner System
 * ============================ */

const COLORS = [
  "#064e3b",
  "#0ea5e9",
  "#6366f1",
  "#f59e0b",
  "#16a34a",
  "#be123c",
];

class BannerRotator {
  constructor(interval = 5000) {
    this.banners = [];
    this.current = 0;
    this.interval = interval;
    this.container = null;
    this.timer = null;
  }

  init() {
    this.container = document.createElement("div");
    this.container.id = "banner-rotator";
    this.container.dir = "rtl";
    this.container.style.cssText =
      "width:100%;overflow:hidden;min-height:44px;";
    document.body.prepend(this.container);
  }

  add(text, bg, color = "#fff") {
    this.banners.push({ text, bg, color });
  }

  start() {
    if (this.banners.length === 0) return;

    this.show(0);

    if (this.banners.length > 1) {
      this.timer = setInterval(() => {
        this.current = (this.current + 1) % this.banners.length;
        this.show(this.current);
      }, this.interval);
    }
  }

  show(i) {
    const b = this.banners[i];
    const el = document.createElement("div");
    el.style.cssText = `background:${b.bg};color:${b.color};padding:12px 20px;text-align:center;font-weight:700;transition:opacity 0.3s;opacity:0;`;
    el.textContent = b.text;

    if (this.container.firstChild) {
      this.container.firstChild.style.opacity = "0";
      setTimeout(() => {
        this.container.innerHTML = "";
        this.container.appendChild(el);
        requestAnimationFrame(() => (el.style.opacity = "1"));
      }, 300);
    } else {
      this.container.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = "1"));
    }
  }
}

// Helper function to detect current page
function detectCurrentPage() {
  const path = window.location.pathname;
  const filename = path.split("/").pop().replace(".html", "");

  // Map filenames to page identifiers
  const pageMap = {
    mueen: "mueen",
    darsi: "darsi",
    mutasiq: "mutasiq",
    mulham: "mulham",
    miyad: "miyad",
    masar: "masar",
    mithaq: "mithaq",
    ethraa: "ethraa",
    athar: "athar",
    programs: "programs",
    pricing: "pricing",
    profile: "profile",
    admin: "admin",
    index: "athar",
    "": "athar",
  };

  return pageMap[filename] || "all";
}

async function fetchAnnouncements() {
  try {
    const currentPage = detectCurrentPage();
    const res = await fetch(
      `/.netlify/functions/admin-announcement?active=1&page=${encodeURIComponent(
        currentPage
      )}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    return (data.announcements || []).map((a, i) => ({
      text: a.text,
      bg: COLORS[i % COLORS.length],
    }));
  } catch {
    try {
      const currentPage = detectCurrentPage();
      const res = await fetch(
        `/.netlify/functions/admin-announcement?latest=1&page=${encodeURIComponent(
          currentPage
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.latest?.active
        ? [{ text: data.latest.text, bg: COLORS[0] }]
        : [];
    } catch {
      // If both API calls fail, return empty array
      return [];
    }
  }
}

async function getTrialBanner() {
  try {
    if (!(await window.auth?.isAuthenticated?.())) return null;
    const claims = await window.auth.getIdTokenClaims();
    const NS_MAIN = "https://n-athar.co/";
    const NS_ALT = "https://athar.co/";
    const status = claims?.[NS_MAIN + "status"] ?? claims?.[NS_ALT + "status"];
    const expStr =
      claims?.[NS_MAIN + "trial_expires"] ?? claims?.[NS_ALT + "trial_expires"];
    if (status !== "trial" || !expStr) return null;
    const exp = new Date(expStr);
    const days = Math.max(0, Math.ceil((exp - Date.now()) / 864e5));
    return days > 0
      ? {
          text: `أنتِ على الخطة التجريبية — تبقّى ${days} يوم`,
          bg: "#fbbf24",
          color: "#78350f",
        }
      : null;
  } catch {
    return null;
  }
}

async function mountRotatingBanners() {
  const rotator = new BannerRotator(5000);
  rotator.init();

  const [announcements, trial] = await Promise.all([
    fetchAnnouncements(),
    getTrialBanner(),
  ]);

  // Defensive check: ensure announcements is an array
  if (Array.isArray(announcements)) {
    announcements.forEach((a) => rotator.add(a.text, a.bg));
  }

  if (trial) rotator.add(trial.text, trial.bg, trial.color);

  rotator.start();
  window.bannerRotator = rotator;
}

window.mountRotatingBanners = mountRotatingBanners;
