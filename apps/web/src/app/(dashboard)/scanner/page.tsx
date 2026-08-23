import { ScannerClient } from "./ScannerClient";

export const metadata = {
  title: "Form Scanner — SubmitPulse",
  description: "Analyse your live form for structural, security, and accessibility issues.",
};

export default function ScannerPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Form scanner</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Analyse a live page for form issues: method, endpoint, accessibility, leaked secrets, and more.
        </p>
      </div>

      <ScannerClient />
    </div>
  );
}
