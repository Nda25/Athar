// Refund Policy Page Scripts

// Set current year in footer
(function () {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
})();
