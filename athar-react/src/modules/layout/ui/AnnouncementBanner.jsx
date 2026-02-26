import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Megaphone, Loader2 } from "lucide-react";
import { getAnnouncements } from "@shared/api";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { useScrollDirection } from "@shared/lib/hooks/useScrollDirection";

// Map routes to the IDs used in the admin panel
const getPageIdForRoute = (pathname) => {
  if (pathname === "/" || pathname === "/athar") return "athar";
  if (pathname === "/programs") return "programs";
  if (pathname === "/pricing") return "pricing";
  if (pathname === "/profile") return "profile";

  if (pathname.startsWith("/programs/mueen")) return "mueen";
  if (pathname.startsWith("/programs/murtakiz")) return "darsi";
  if (pathname.startsWith("/programs/miaad")) return "miyad";
  if (pathname.startsWith("/programs/mithaq")) return "mithaq";
  if (pathname.startsWith("/programs/ethraa")) return "ethraa";
  if (pathname.startsWith("/programs/mulham")) return "mulham";
  if (pathname.startsWith("/programs/mutasiq")) return "mutasiq";
  if (pathname.startsWith("/programs/masar")) return "masar";

  return null;
};

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const scrollDirection = useScrollDirection();

  useEffect(() => {
    let mounted = true;

    const fetchAnnouncement = async () => {
      try {
        const data = await getAnnouncements();
        if (mounted && data?.latest) {
          setAnnouncement(data.latest);
        }
      } catch (error) {
        console.error("Failed to fetch announcements:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchAnnouncement();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!announcement) {
      setIsVisible(false);
      return;
    }

    // Check target pages
    const targetPages = announcement.target_pages || ["all"];
    if (targetPages.includes("all")) {
      setIsVisible(true);
      return;
    }

    const currentPageId = getPageIdForRoute(location.pathname);
    if (currentPageId && targetPages.includes(currentPageId)) {
      // It includes this page specifically
      setIsVisible(true);
      return;
    }

    // Doesn't apply to this page
    setIsVisible(false);
  }, [announcement, location.pathname]);

  if (isLoading) {
    return (
      <div className="w-full bg-brand/10 text-brand py-2 px-4 flex justify-center items-center text-sm border-b border-brand/20 min-h-[40px]">
        <Loader2 className="h-4 w-4 animate-spin opacity-50" />
      </div>
    );
  }

  if (!isVisible || !announcement) return null;

  return (
    <div
      className={`fixed top-0 left-0 w-full bg-card text-foreground shadow-sm border-b border-border z-60 overflow-hidden transition-transform duration-300 ${
        scrollDirection === "down" ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-3 relative">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <div className="bg-primary/10 p-1.5 rounded-md shrink-0 mt-0.5 sm:mt-0">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">
                {announcement.text}
              </p>

              {announcement.expires_at && (
                <span className="text-[10px] sm:text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap self-start sm:self-auto border border-border/50">
                  ينتهي:{" "}
                  {format(new Date(announcement.expires_at), "dd MMM", {
                    locale: arSA,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
