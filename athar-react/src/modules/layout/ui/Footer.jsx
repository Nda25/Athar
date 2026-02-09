import { Link } from "react-router-dom";
import { Mail, MessageCircle } from "lucide-react";
import { brand, footerLinks } from "@shared/config/content";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-sea-25 dark:bg-card border-t border-border pt-12 pb-8">
      <div className="container mx-auto px-4 md:px-8">
        {/* Main Content */}
        <div className="text-center mb-10">
          {/* Inspirational Quote */}
          <p className="text-lg text-ink font-medium mb-4 leading-relaxed max-w-xl mx-auto">
            {brand.footerQuote}
          </p>

          {/* Creator Attribution */}
          <p className="text-brand font-bold text-lg mb-8">{brand.creator}</p>

          {/* Brand Logo */}
          <Link to="/" className="inline-block mb-6">
            <span className="text-3xl font-bold text-brand">
              {brand.nameShort}
            </span>
          </Link>
        </div>

        {/* Footer Links */}
        <nav
          className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-sm text-muted mb-8"
          aria-label="Footer navigation"
        >
          <Link to="/privacy" className="hover:text-brand transition-colors">
            {footerLinks.privacy}
          </Link>
          <span className="text-sea-200" aria-hidden="true">
            |
          </span>

          <Link to="/terms" className="hover:text-brand transition-colors">
            {footerLinks.terms}
          </Link>
          <span className="text-sea-200" aria-hidden="true">
            |
          </span>

          <Link to="/refund" className="hover:text-brand transition-colors">
            {footerLinks.refund}
          </Link>
          <span className="text-sea-200" aria-hidden="true">
            |
          </span>

          <a
            href="https://wa.me/966556795993"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand transition-colors flex items-center gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            {footerLinks.whatsapp}
          </a>
          <span className="text-sea-200" aria-hidden="true">
            |
          </span>

          <Link to="/complaints" className="hover:text-brand transition-colors">
            {footerLinks.complaints}
          </Link>
        </nav>

        {/* Copyright */}
        <div className="border-t border-border pt-6 text-center text-sm text-muted font-medium">
          <p>{brand.copyright(year)}</p>
        </div>
      </div>
    </footer>
  );
}
