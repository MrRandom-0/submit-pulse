import Link from "next/link";
import type { ReactNode } from "react";
import type { FormDetail } from "@/lib/dashboard-data";

interface FormSubpageShellProps {
  form: FormDetail;
  /** Current section label, e.g. "Fields" — last breadcrumb crumb. */
  section: string;
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * Shared chrome for the per-form subpages (fields, domains, notifications,
 * spam, settings): breadcrumb back through the form detail page, a
 * consistent title block, and the dashboard's standard content column.
 */
export function FormSubpageShell({
  form,
  section,
  title,
  description,
  children,
}: FormSubpageShellProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-sm text-text-muted">
            <li>
              <Link href="/forms" className="hover:text-text-primary">
                Forms
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="min-w-0">
              <Link
                href={`/forms/${form.id}`}
                className="hover:text-text-primary truncate block max-w-[200px]"
              >
                {form.name}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-text-primary font-medium">{section}</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="text-sm text-text-muted mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}
