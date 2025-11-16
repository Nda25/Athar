/**
 * Component Loader Helper
 * Loads HTML components from the components folder
 */

const ComponentLoader = {
  /**
   * Load a single component
   */
  load: async function (id, file) {
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Failed to load ${file}`);
      const text = await res.text();
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = text;
      }
      return text;
    } catch (error) {
      console.error(`Error loading component ${id}:`, error);
      return "";
    }
  },

  /**
   * Load multiple components at once
   */
  loadAll: async function (components) {
    const promises = components.map((comp) => this.load(comp.id, comp.file));
    return Promise.all(promises);
  },

  /**
   * Load with callback (for event handling after load)
   */
  loadWithCallback: async function (id, file, callback) {
    const html = await this.load(id, file);
    if (callback && typeof callback === "function") {
      callback();
    }
    return html;
  },
};

// Auto-load on DOM ready if data attribute is set
document.addEventListener("DOMContentLoaded", () => {
  const componentsToLoad = document.querySelectorAll("[data-component]");
  componentsToLoad.forEach((el) => {
    const file = el.getAttribute("data-component");
    ComponentLoader.load(el.id, file);
  });
});
