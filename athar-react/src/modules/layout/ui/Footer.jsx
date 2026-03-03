import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { brand, footerLinks } from "@shared/config/content";

export function Footer() {
  const year = new Date().getFullYear();
  const footerLinkClass =
    "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3.5 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <footer className="border-t border-border/60 bg-card/95 pt-10 pb-8">
      <div className="container mx-auto px-4 md:px-8">
        <div className="mx-auto mb-6 h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="mx-auto max-w-5xl rounded-2xl   p-6  md:p-8">
          <div className="text-center">
            <p className="mx-auto mb-4 max-w-2xl text-base leading-relaxed text-foreground/90 md:text-lg">
              {brand.footerQuote}
            </p>
            <p className="mb-6 text-lg font-bold text-primary">
              {brand.creator}
            </p>

            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary/5 px-4 py-2 text-3xl font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/10"
            >
              {brand.nameShort}
            </Link>
          </div>

          <nav
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
            aria-label="Footer navigation"
          >
            <Link to="/privacy" className={footerLinkClass}>
              {footerLinks.privacy}
            </Link>

            <Link to="/terms" className={footerLinkClass}>
              {footerLinks.terms}
            </Link>

            <Link to="/refund" className={footerLinkClass}>
              {footerLinks.refund}
            </Link>

            <a
              href="https://wa.me/966556795993"
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClass}
            >
              <MessageCircle className="h-4 w-4" />
              {footerLinks.whatsapp}
            </a>

            <Link to="/complaints" className={footerLinkClass}>
              {footerLinks.complaints}
            </Link>
          </nav>

          <div className="mt-8 border-t border-border/60 pt-5 text-center text-sm font-medium text-muted-foreground">
            <p>{brand.copyright(year)}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
