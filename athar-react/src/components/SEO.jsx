import { useEffect } from "react";
import { seo } from "@/content";

/**
 * Custom SEO hook for React 19 (react-helmet-async not compatible)
 * Sets document title and meta tags dynamically
 *
 * Usage: useSEO("home") or useSEO("programs")
 */
export function useSEO(page = "home", { customTitle, customDescription } = {}) {
  const pageData = seo[page] || seo.home;
  const title = customTitle || pageData.title;
  const description = customDescription || pageData.description;

  useEffect(() => {
    // Set document title
    document.title = title;

    // Set/update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", description);

    // Set/update OG tags
    updateMetaTag("og:title", title);
    updateMetaTag("og:description", description);
    if (pageData.ogImage) {
      updateMetaTag("og:image", pageData.ogImage);
    }

    // Set/update Twitter tags
    updateMetaTag("twitter:title", title);
    updateMetaTag("twitter:description", description);
    if (pageData.ogImage) {
      updateMetaTag("twitter:image", pageData.ogImage);
    }
  }, [title, description, pageData.ogImage]);
}

function updateMetaTag(property, content) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

/**
 * SEO Component wrapper for declarative usage
 * Usage: <SEO page="home" />
 */
export function SEO({ page = "home", customTitle, customDescription }) {
  useSEO(page, { customTitle, customDescription });
  return null;
}
