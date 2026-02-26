/**
 * ToolLayout — Layout wrapper for individual tool pages.
 * Adds proper spacing below the fixed navbar and embeds the collapsible ToolsSidebar.
 */
import { Layout } from "./Layout";
import { ToolsSidebar } from "./ToolsSidebar";

export function ToolLayout({ children }) {
  return (
    <Layout>
      {/* pt-16 offsets the fixed navbar height */}
      <div className="flex min-h-[calc(100vh-4rem)] pt-16">
        {/* Sidebar — hidden on mobile, visible on large screens */}
        <div className="hidden lg:flex p-4 pr-0 flex-shrink-0">
          <ToolsSidebar />
        </div>

        {/* Main content area */}
        <main className="flex-1 p-6 md:p-10 overflow-auto">{children}</main>
      </div>
    </Layout>
  );
}
