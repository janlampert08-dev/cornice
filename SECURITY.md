# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.
Public issues are visible to everyone, including anyone who might exploit
the problem before it can be fixed.

Instead, use GitHub's private vulnerability reporting for this repository:

1. Go to the repository's **Security** tab.
2. Select **Report a vulnerability** to open a private advisory.

This reaches the repository owner directly and keeps the details
confidential while a fix is developed.

If private vulnerability reporting is not enabled for this repository yet,
enable it under **Settings → Code security and analysis → Private
vulnerability reporting** before relying on it, or contact the repository
owner (`@janlampert08-dev`) directly through GitHub.

## What Counts as Security-Sensitive

Please report privately (rather than as a normal bug) anything involving:

- Authentication or session handling (`proxy.ts`, `lib/supabase/*`,
  `lib/actions/auth.ts`)
- Authorization, Row Level Security (RLS), or moderation logic
  (`supabase/migrations/**`, `lib/actions/moderation.ts`, `lib/moderation.ts`)
- Stripe billing and webhooks (`app/api/stripe/**`, `lib/stripe*`,
  `lib/actions/billing.ts`) — including signature verification and
  subscription state handling
- Any API route (`app/api/**`) that could leak, modify, or delete another
  user's data
- Exposure of secrets, credentials, or personal user data

## Credential Handling

- Credentials, API keys, and secrets must never be committed to this
  repository, in code, configuration, migrations, comments, or test
  fixtures. Use `.env.local` (git-ignored) locally, and the hosting
  platform's secret store in deployed environments.
- If a credential is ever found committed to the repository — in the
  current tree or in Git history — treat it as **compromised**
  immediately: rotate/revoke it at the provider (Supabase, Stripe,
  Mapbox, etc.) regardless of whether the commit is still reachable from
  a branch, since it may already be cached, mirrored, or scraped.
  Removing the file or a later commit does not undo the exposure.
- Cleaning a leaked credential out of Git history (e.g. via
  `git filter-repo` or GitHub's secret purge tooling) is a separate,
  deliberate operation from rotation and should only be done with the
  repository owner's explicit sign-off, since it rewrites history for
  everyone with a clone.
