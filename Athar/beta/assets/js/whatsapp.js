// WhatsApp Contact Page Scripts

// Set current year in footer
(function () {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
})();

// Theme toggle functionality
(function () {
  const themeToggle = document.getElementById("themeToggle");
  const htmlElement = document.documentElement;

  // Load theme preference from localStorage
  function loadTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      htmlElement.classList.add("dark");
    } else if (savedTheme === "light") {
      htmlElement.classList.remove("dark");
    } else {
      // Default to system preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        htmlElement.classList.add("dark");
      }
    }
  }

  // Toggle theme
  function toggleTheme() {
    if (htmlElement.classList.contains("dark")) {
      htmlElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      htmlElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Load theme on page load
  loadTheme();
})();
