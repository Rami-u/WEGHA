/*
  Sub-domain resolution.

  One SPA serves the main domain (edunova.com) and every teacher sub-domain
  ({slug}.edunova.com). On a sub-domain the app reads the workspace slug from
  the hostname and calls the path-based API (/api/v1/workspaces/{slug}/...).
  On the main domain there is no slug: pages there are the public marketing
  pages and teacher directory.
*/

const BASE_DOMAIN = (import.meta.env.VITE_PLATFORM_BASE_DOMAIN ?? "edunova.com")
  .trim()
  .replace(/^\.+|\.+$/g, "");

export function baseDomain(): string {
  return BASE_DOMAIN;
}

/** Platform home, escaping both demo router basenames and real teacher subdomains. */
export function mainSiteUrl(): string {
  const { hostname, protocol, port } = window.location;
  const portSuffix = port ? `:${port}` : "";
  if (hostname.endsWith(".localhost")) {
    return `${protocol}//localhost${portSuffix}/`;
  }
  if (slugFromHostname(hostname)) {
    return `${protocol}//${BASE_DOMAIN}${portSuffix}/`;
  }
  return "/";
}

/** Extract the workspace slug from a hostname, or null when on the main domain. */
export function slugFromHostname(hostname: string): string | null {
  const host = hostname.trim().toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return null;
  }

  // Local development: drahmed.localhost -> "drahmed"
  if (host.endsWith(".localhost")) {
    return host.slice(0, -".localhost".length) || null;
  }

  // Production: drahmed.edunova.com -> "drahmed" ; edunova.com / www.edunova.com -> null
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
    return null;
  }
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const slug = host.slice(0, -1 - BASE_DOMAIN.length);
    return slug.includes(".") ? null : slug || null;
  }

  return null;
}

export type PageMode = { mode: "main" } | { mode: "workspace"; slug: string };

/** Mode of the page currently loaded. */
export function resolvePageMode(): PageMode {
  const slug = slugFromHostname(window.location.hostname);

  if (slug) {
    return { mode: "workspace", slug };
  }

  /*
    Dev preview: `?workspace=science` on localhost only. The real routing always
    comes from the sub-domain; this exists so the workspace screens can be
    previewed on the main dev origin (automated checks, quick manual review).
  */
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    const override = new URLSearchParams(window.location.search).get("workspace");
    if (override && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(override)) {
      return { mode: "workspace", slug: override };
    }
  }

  return { mode: "main" };
}

/**
 * Absolute URL for a workspace page. Used by the main domain to link students
 * to a teacher's sub-domain (plain links — no tokens or sessions are passed).
 */
export function subdomainUrl(slug: string, path = "/"): string {
  const isLocal =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isLocal) {
    return `${window.location.protocol}//${slug}.localhost:${window.location.port}${path}`;
  }
  return `${window.location.protocol}//${slug}.${BASE_DOMAIN}${path}`;
}
