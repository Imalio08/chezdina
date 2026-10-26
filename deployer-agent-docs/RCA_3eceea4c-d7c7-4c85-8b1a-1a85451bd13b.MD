# RCA — Custom domain chezdina.net no longer resolving (Cloudflare Error 1001)

## Problem statement
- Symptom: `chezdina.net` returns Cloudflare **Error 1001 (DNS resolution error)** — "Cloudflare is currently unable to resolve your requested domain" (Ray ID a4cb3cb748b865a1, 2026-10-18 23:14 UTC). Still failing after the latest redeploy.
- User report: domain "n'est plus rattaché" (no longer attached); it no longer appears in the app's Domains section — only the default `https://dina-boutique.emergent.host` is listed.
- Domain was **purchased through Emergent directly** (DNS/routing is Emergent-managed via Cloudflare, not the user's own registrar).

## Evidence
- `describe_deployment_state`: deployment `e920c456-3cec-42d1-9d52-c259705259b5` (dina-boutique), active run `3eceea4c-d7c7-4c85-8b1a-1a85451bd13b`, status **success**, frontend_type **cloudflare**, deployed_url `https://dina-boutique.emergent.host`. App itself is live and healthy on the default URL.
- `list_domains`: **`domains: []`** — there is **no custom domain linked** to this deployment at all. chezdina.net is not present.
- `check_domain_status`: **empty** — no custom domain to run a DNS check against (consistent with nothing attached).
- Run history anomaly:
  - `872a2e16` (2026-10-18 23:52, trigger `user_deploy`) → **failed**: `ensure-environment permanent failure: forbidden (status 403) (EnsureEnvironmentPermanent, retryable:false)`.
  - Latest successful run `3eceea4c` (2026-10-26 15:41) is **type `initial`** — an *initial* deploy running against an already-existing deployment (created 2026-10-07). An initial/re-initialization deploy path does not carry over a previously-attached custom hostname the way an in-place redeploy does.

## Root cause
The Cloudflare custom-hostname binding for `chezdina.net` is **no longer associated with this deployment** — `list_domains` returns an empty set. With no custom hostname / routing record present, Cloudflare has nothing to resolve `chezdina.net` to, which is exactly the Error 1001 the user sees.

The binding being gone correlates with the deployment being re-run as a **type=`initial`** deploy on 2026-10-26 (preceded by the failed 403 `ensure-environment` run on 10-18). A standard in-place redeploy preserves attached domains; an initial/re-initialization path recreates the environment and does not reattach a previously-linked custom hostname. This is the most probable mechanism, but it is **circumstantial** — I can confirm the domain is currently unattached (`list_domains: []`), but I do not have a domain-lifecycle/audit tool to prove the exact deploy action that removed it.

Because the domain was **purchased through Emergent**, its DNS and Cloudflare custom-hostname/SSL records are managed on the Emergent side — the user has no registrar DNS records to set themselves. Re-attaching the Emergent-managed domain to the deployment is a platform operation; there is no deployer-agent tool to add or re-link a domain.

## Fixes
1. **Platform (Emergent) — re-attach the domain.** Re-link the Emergent-purchased custom hostname `chezdina.net` to deployment `dina-boutique` (`e920c456-3cec-42d1-9d52-c259705259b5`) and restore the Cloudflare custom-hostname routing + SSL so it points back at the live app (`https://dina-boutique.emergent.host`). The binding was dropped — most likely during the 2026-10-26 type=`initial` re-deploy (after the 10-18 403 `ensure-environment` failure).
2. **User — initiate re-attach / raise ticket.** In Deployment Panel → Domains, try re-adding `chezdina.net`. Since it is Emergent-purchased (Emergent-managed DNS), if it cannot be re-added/does not re-verify from the panel, file an Emergent support ticket quoting deployment `e920c456-3cec-42d1-9d52-c259705259b5` and job `12fdfefb-353d-478a-b8e7-c8ea28bd93b8` so the platform can re-link it. No registrar DNS change is needed on the user's side because DNS is Emergent-managed.

## Not the cause
- Not a code/source issue (user confirmed, and no domain-related code exists).
- Not an app outage — the app is live and healthy on the default `*.emergent.host` URL; only the custom-domain binding is missing.
