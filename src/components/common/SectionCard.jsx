import { cn } from "@/lib/utils";

/** Karta sekcji podstrony: 16px, --ds-s2, --ds-line; nagłówek z tytułem, opisem i akcją po prawej. */
export default function SectionCard({ title, description, action, className, bodyClassName, children, ...props }) {
  return (
    <section className={cn("min-w-0 rounded-[16px] border border-ds-line bg-ds-s2", className)} {...props}>
      {title || action ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold text-ds-text">{title}</h2> : null}
            {description ? <p className="mt-1 text-[12.5px] text-ds-text2">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
