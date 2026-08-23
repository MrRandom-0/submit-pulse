/**
 * Logout page.
 *
 * Server Component: calls the sign-out API route on mount (via the client
 * component below) and redirects to /login.
 *
 * Why a page and not just an API route?
 * - Allows the user to land here from a link or button without JavaScript.
 * - The server component renders the client shell which triggers the API call.
 * - Direct navigation to /api/auth/logout (POST) from a link is not possible
 *   without JS; having a page covers the no-JS case with a form.
 */

import type { Metadata } from "next";

import LogoutClient from "./logout-client";

export const metadata: Metadata = {
  title: "Signing out",
  robots: { index: false },
};

export default function LogoutPage() {
  return <LogoutClient />;
}
