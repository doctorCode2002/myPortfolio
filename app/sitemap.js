export const dynamic = "force-static";

import { SITE_URL } from "../src/lib/site";

export default function sitemap() {
  return [{ url: SITE_URL }];
}
