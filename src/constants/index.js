import civicMind from "/assets/projects/civicMind.webp";
import eyadDesinger from "/assets/projects/eyadDesinger.webp";
export const navLinks = [
  {
    text: "Home",
    link: "#home",
    image: "https://picsum.photos/600/400?random=1",
  },
  {
    text: "Services",
    link: "#services",
    image: "https://picsum.photos/600/400?random=2",
  },
  {
    text: "About",
    link: "#about",
    image: "https://picsum.photos/600/400?random=3",
  },
  {
    text: "Work",
    link: "#work",
    image: "https://picsum.photos/600/400?random=4",
  },
  {
    text: "Contact",
    link: "#contact",
    image: "https://picsum.photos/600/400?random=5",
  },
];

export const projects = [
  {
    id: 1,
    name: "Eyad Portfolio",
    description:
      "A portfolio website for a professional designer showcasing their work and services.",
    href: "https://olive-weasel-365141.hostingersite.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQPtgZleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAacLliCrRBSkvCsIXXcFAUuzu4SSJKREPMkB9hV_0ZGWKz2cwCXH_5WLjdumkg_aem_ukSeECOSOr11qozmYtpIwg",
    image: eyadDesinger,
    // bgImage: "https://picsum.photos/1900/1080?random=12",
    frameworks: [
      { id: 1, name: "React" },
      { id: 2, name: "Tailwind CSS" },
      { id: 3, name: "GSAP" },
    ],
  },
  {
    id: 2,
    name: "CivicMind",
    description:
      "A web application for civic engagement and advocacy, connecting citizens with government officials.",
    href: "https://municipal-ai-system2.vercel.app/",
    image: civicMind,
    // bgImage: "https://picsum.photos/1900/1080?random=12",
    frameworks: [
      { id: 1, name: "React" },
      { id: 2, name: "Tailwind CSS" },
      { id: 3, name: "GSAP" },
      { id: 4, name: "Fast API" },
      { id: 5, name: "Python" },
    ],
  },
];

export const CONTACT_DATA = [
  {
    text: "mohammeda.abutaleb@gmail.com",
    link: "mailto:mohammeda.abutaleb@gmail.com",
  },
  {
    text: "LinkedIn",
    link: "https://www.linkedin.com/in/mohammed2002",
  },

  {
    text: "Instagram",
    link: "https://www.instagram.com/mohammedabu.taleb/",
  },
  {
    text: "GitHub",
    link: "https://github.com/doctorCode2002",
  },
];
