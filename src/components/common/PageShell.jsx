import { cn } from "@/lib/utils";

/**
 * Wspólny szkielet podstron: nagłówek (tytuł + podtytuł + akcje po prawej),
 * opcjonalny pasek kluczowych liczb (kpis) i treść. Nie używać na Dashboardzie i w Dzienniku.
 */
export default function PageShell({ title, subtitle, actions, kpis, className, children }) {
  return (
    <div className={cn("w-full min-h-0 space-y-3 dashboard-surface", className)}>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {kpis}
      {children}
    </div>
  );
}

/** Sam nagłówek szkieletu — dla stron, które przechodzą na PageShell stopniowo. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div className="min-w-0">
        <h1 className="cyber-page-title">{title}</h1>
        {subtitle ? <p className="cyber-page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
