/** Routes shown in the header and the mobile menu, in display order. */
export const SITE_ROUTES = [
  { key: "work", path: "/projects" },
  { key: "services", path: "/services" },
  { key: "about", path: "/about" },
  { key: "mentoring", path: "/mentoring" },
] as const;

export type SiteRouteKey = (typeof SITE_ROUTES)[number]["key"];

/** Is `pathname` (e.g. "/ar/projects/x") inside the locale-free `path`? */
export function isActivePath(pathname: string, path: string): boolean {
  const rest = "/" + pathname.split("/").filter(Boolean).slice(1).join("/");
  return rest === path || rest.startsWith(`${path}/`);
}
