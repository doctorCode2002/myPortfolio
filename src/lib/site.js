export const SITE_URL = "https://mohammedabutaleb.com";

// Resolved once, at build time, under `output: "export"` — this module runs
// during the static build only, so the value baked into the prerendered HTML
// and the value read by the hydrating client are always the same year.
export const CURRENT_YEAR = new Date().getFullYear();

export const PERSON = {
  name: "Mohammed Ashraf",
  jobTitle: "Full-Stack Developer",
  sameAs: [
    "https://github.com/doctorCode2002",
    "https://www.linkedin.com/in/mohammed2002",
    "https://www.instagram.com/mohammedabu.taleb/",
  ],
  knowsAbout: ["React", "Tailwind CSS", "GSAP", "JavaScript"],
};
