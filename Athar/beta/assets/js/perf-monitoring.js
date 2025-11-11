/**
 * Performance Monitoring Utility
 * Tracks Core Web Vitals and custom performance metrics
 * Usage: Add this script to your HTML pages
 */

(function initPerformanceMonitoring() {
  "use strict";

  // Only run on browsers that support Web Vitals API
  if (typeof window.PerformanceObserver === "undefined") {
    console.warn("[Perf] PerformanceObserver not supported");
    return;
  }

  // Create a namespace for performance data
  window.__ATHAR_PERF__ = window.__ATHAR_PERF__ || {
    metrics: {},
    marks: {},
    measures: {},
  };

  const perfData = window.__ATHAR_PERF__;

  /**
   * Mark the start of a performance measurement
   * @param {string} name - Unique name for this mark
   */
  function markStart(name) {
    if (!window.performance || !window.performance.mark) return;
    const markName = `${name}-start`;
    window.performance.mark(markName);
    perfData.marks[name] = { start: markName, startTime: performance.now() };
  }

  /**
   * Mark the end of a performance measurement and calculate duration
   * @param {string} name - Unique name for this mark
   * @returns {number} Duration in milliseconds
   */
  function markEnd(name) {
    if (!window.performance || !window.performance.mark) return 0;
    const markName = `${name}-end`;
    window.performance.mark(markName);

    if (!perfData.marks[name]) return 0;

    const duration = performance.now() - perfData.marks[name].startTime;
    perfData.marks[name].end = markName;
    perfData.marks[name].duration = duration;

    return duration;
  }

  /**
   * Log a custom metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {object} options - Additional options (unit, threshold, etc)
   */
  function logMetric(name, value, options = {}) {
    perfData.metrics[name] = {
      value,
      timestamp: new Date().toISOString(),
      ...options,
    };

    // Log to console in development
    if (
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1"
    ) {
      console.log(`[Perf] ${name}: ${value}${options.unit || ""}`);
    }

    // Send to analytics if configured
    if (typeof window.sendPerfMetric === "function") {
      window.sendPerfMetric(name, value, options);
    }
  }

  /**
   * Observe Largest Contentful Paint (LCP)
   * LCP should be < 2.5s for good performance
   */
  function observeLCP() {
    if (
      "PerformanceObserver" in window &&
      "PerformanceLongTaskTiming" in window
    ) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime > 0) {
              logMetric("LCP", Math.round(entry.startTime), {
                unit: "ms",
                threshold: 2500,
                rating:
                  entry.startTime < 2500
                    ? "good"
                    : entry.startTime < 4000
                    ? "needs-improvement"
                    : "poor",
              });
            }
          }
        });
        observer.observe({ entryTypes: ["largest-contentful-paint"] });
      } catch (e) {
        console.warn("[Perf] LCP observer error:", e.message);
      }
    }
  }

  /**
   * Observe First Input Delay (FID) / Interaction to Next Paint (INP)
   * FID should be < 100ms for good performance
   */
  function observeFID() {
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const delay = Math.round(entry.processingStart - entry.startTime);
            logMetric("FID", delay, {
              unit: "ms",
              threshold: 100,
              rating:
                delay < 100
                  ? "good"
                  : delay < 300
                  ? "needs-improvement"
                  : "poor",
            });
          }
        });
        observer.observe({ entryTypes: ["first-input"] });
      } catch (e) {
        console.warn("[Perf] FID observer error:", e.message);
      }
    }
  }

  /**
   * Observe Cumulative Layout Shift (CLS)
   * CLS should be < 0.1 for good performance
   */
  function observeCLS() {
    if ("PerformanceObserver" in window) {
      try {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          logMetric("CLS", parseFloat(clsValue.toFixed(3)), {
            threshold: 0.1,
            rating:
              clsValue < 0.1
                ? "good"
                : clsValue < 0.25
                ? "needs-improvement"
                : "poor",
          });
        });
        observer.observe({ entryTypes: ["layout-shift"] });
      } catch (e) {
        console.warn("[Perf] CLS observer error:", e.message);
      }
    }
  }

  /**
   * Observe First Contentful Paint (FCP)
   * FCP should be < 1.8s for good performance
   */
  function observeFCP() {
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            logMetric("FCP", Math.round(entry.startTime), {
              unit: "ms",
              threshold: 1800,
              rating:
                entry.startTime < 1800
                  ? "good"
                  : entry.startTime < 3000
                  ? "needs-improvement"
                  : "poor",
            });
          }
        });
        observer.observe({ entryTypes: ["paint"] });
      } catch (e) {
        console.warn("[Perf] FCP observer error:", e.message);
      }
    }
  }

  /**
   * Get Navigation Timing metrics
   */
  function getNavigationTiming() {
    if (!window.performance || !window.performance.timing) return null;

    const timing = window.performance.timing;
    const navigation = window.performance.navigation;

    const metrics = {
      "DNS Lookup": timing.domainLookupEnd - timing.domainLookupStart,
      "TCP Connection": timing.connectEnd - timing.connectStart,
      "Request Time": timing.responseStart - timing.requestStart,
      "Response Time": timing.responseEnd - timing.responseStart,
      "DOM Parsing": timing.domInteractive - timing.domLoading,
      "DOM Content Loaded":
        timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      "Page Load": timing.loadEventEnd - timing.loadEventStart,
      "Total Load Time": timing.loadEventEnd - timing.navigationStart,
    };

    Object.entries(metrics).forEach(([name, value]) => {
      if (value > 0) {
        logMetric(name, Math.round(value), { unit: "ms" });
      }
    });

    return metrics;
  }

  /**
   * Initialize all performance observers
   */
  function initializePerformanceMonitoring() {
    // Get initial page load metrics
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", getNavigationTiming);
    } else {
      getNavigationTiming();
    }

    // Set up Web Vitals observers
    observeFCP();
    observeLCP();
    observeFID();
    observeCLS();
  }

  /**
   * Export functions globally
   */
  window.perfMonitoring = {
    markStart,
    markEnd,
    logMetric,
    getMetrics: () => perfData.metrics,
    getMarks: () => perfData.marks,
    reset: () => {
      perfData.metrics = {};
      perfData.marks = {};
    },
  };

  // Start monitoring when the window loads
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePerformanceMonitoring
    );
  } else {
    initializePerformanceMonitoring();
  }
})();
