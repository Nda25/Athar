import { useState, createContext, useContext, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@shared/lib/utils";

const AccordionContext = createContext({});

const Accordion = forwardRef(
  (
    {
      className,
      type = "single",
      collapsible = true,
      defaultValue,
      children,
      ...props
    },
    ref,
  ) => {
    // Simple state implementation for 'single' type
    const [openItem, setOpenItem] = useState(defaultValue);

    const handleValueChange = (value) => {
      setOpenItem((prev) => (prev === value && collapsible ? "" : value));
    };

    return (
      <AccordionContext.Provider value={{ openItem, handleValueChange, type }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  },
);
Accordion.displayName = "Accordion";

const AccordionItem = forwardRef(
  ({ className, value, children, ...props }, ref) => {
    const { openItem } = useContext(AccordionContext);
    const isOpen = openItem === value;

    return (
      <div
        ref={ref}
        className={cn(
          "border border-[var(--sea-100)] rounded-[var(--radius)] bg-[var(--sea-25)] overflow-hidden",
          className,
        )}
        data-state={isOpen ? "open" : "closed"}
        {...props}
      >
        {/* Pass value to children via context or cloneElement? 
          Simpler to just context or just assume Trigger/Content are direct children relative to Value (not quite right).
          Actually, I need to pass 'value' down. 
          Let's verify how Radix does it: Item wraps everything. 
      */}
        <AccordionItemContext.Provider value={{ value, isOpen }}>
          {children}
        </AccordionItemContext.Provider>
      </div>
    );
  },
);
AccordionItem.displayName = "AccordionItem";

const AccordionItemContext = createContext({});

const AccordionTrigger = forwardRef(
  ({ className, children, ...props }, ref) => {
    const { value, isOpen } = useContext(AccordionItemContext);
    const { handleValueChange } = useContext(AccordionContext);

    return (
      <button
        ref={ref}
        onClick={() => handleValueChange(value)}
        className={cn(
          "flex flex-1 items-center justify-between py-4 px-6 font-medium transition-all hover:text-[var(--primary)] text-[var(--ink)] w-full text-right",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 text-[var(--muted)]",
            isOpen && "rotate-180 text-[var(--primary)]",
          )}
        />
      </button>
    );
  },
);
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = forwardRef(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = useContext(AccordionItemContext);

    if (!isOpen) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden text-sm transition-all px-6 pb-4 pt-0 text-[var(--muted)] animate-in slide-in-from-top-2 fade-in duration-200",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
