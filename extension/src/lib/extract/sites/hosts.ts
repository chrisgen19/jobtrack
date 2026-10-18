/**
 * Domains the site adapters cover (subdomains included). Imported by
 * wxt.config.ts for `optional_host_permissions`, so it must stay free of
 * imports. Granting them (the "Auto-detect" toggle) lets the extension see
 * those tabs' URLs for the badge and read them without a click first.
 */
export const JOB_SITE_DOMAINS = [
  "linkedin.com",
  "jobstreet.com",
  "jobsdb.com",
  "seek.com",
  "seek.com.au",
  "seek.co.nz",
  "indeed.com",
  "kalibrr.com",
  "kalibrr.id",
  "onlinejobs.ph",
  "greenhouse.io",
  "ashbyhq.com",
  "lever.co",
  "myworkdayjobs.com",
  "myworkdaysite.com",
];

/** Match patterns for JOB_SITE_DOMAINS ("*." also matches the bare domain). */
export const JOB_SITE_MATCHES = JOB_SITE_DOMAINS.map((domain) => `https://*.${domain}/*`);
