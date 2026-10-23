import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

// The server adds the Umami tag only where it is set up to count, so the page
// mentions the counting only where it happens.
const countsPageViews = () => document.querySelector("script[data-website-id]") !== null;

function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy" />
      <Card className="max-w-2xl">
        <CardContent className="space-y-4 leading-relaxed">
          <p>
            Reading this site needs no account and stores nothing about you. Signing in is needed only to
            enter orders.
          </p>
          <p>
            When you sign in with GitHub, the app asks GitHub for no permissions. It stores your numeric
            GitHub user ID and the display name you choose, and nothing else: not your email, not your GitHub
            username. Pages show only the display name.
          </p>
          <p>
            A cookie keeps you signed in for 30 days. It holds a random token, and the database holds only a
            hash of it. Signing out deletes the session.
          </p>
          {countsPageViews() ? (
            <p>
              This site counts page views with Umami, on a server of its own. It sets no cookie and keeps no
              IP address. For each visit it records the page without anything typed into a search, the site
              you came from, and your browser, operating system, device type, screen size, language and
              country. The counts cannot be traced to you.
            </p>
          ) : null}
          <p>
            Every night, the orders entered here and all product stock go back to the Northwind data. Your
            account and display name stay. Northwind Traders, its customers and its employees are fictional.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
