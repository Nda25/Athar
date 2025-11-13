// مودالات
window.openModal = (id) => {
  const n = $(id);
  if (n) n.classList.add("show");
};
window.closeModal = (id) => {
  const n = $(id);
  if (n) n.classList.remove("show");
};
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".modal [data-close]");
  if (!btn) return;
  e.preventDefault();
  const m = btn.closest(".modal");
  if (m) m.classList.remove("show");
});

// توست محسّن
window.toast = (msg, type = "info", duration = 4000) => {
  // الرموز
  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }

  // إزالة الأنواع السابقة
  t.classList.remove("success", "error", "warning", "info", "show");

  // تحديد النوع
  const finalType = ["success", "error", "warning", "info"].includes(type)
    ? type
    : "info";
  t.classList.add(finalType);

  // بناء محتوى التوست
  const icon = icons[finalType] || "ℹ";
  t.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icon}</span>
      <div class="toast-message">
        <span class="toast-text">${msg}</span>
      </div>
      <button class="toast-close" aria-label="إغلاق">×</button>
      <div class="toast-progress"></div>
    </div>
  `;

  // معالج الإغلاق
  const closeBtn = t.querySelector(".toast-close");
  const hideToast = () => t.classList.remove("show");
  closeBtn.addEventListener("click", hideToast);

  // عرض التوست
  t.classList.add("show");

  // إغلاق تلقائي
  if (duration > 0) {
    setTimeout(hideToast, duration);
  }

  return t;
};
