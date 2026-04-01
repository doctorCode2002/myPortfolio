import civicMind from "/assets/projects/civicMind.webp";
import eyadDesinger from "/assets/projects/eyadDesinger.webp";
import homeNav from "/assets/navImages/homeNav.webp";
import servicesNav from "/assets/navImages/servicesNav.webp";
import aboutNav from "/assets/navImages/aboutNav.webp";
import workNav from "/assets/navImages/workNav.webp";
import contactNav from "/assets/navImages/contactNav.webp";
export const navLinks = [
  {
    text: "Home",
    link: "#home",
    image: homeNav,
  },
  {
    text: "Services",
    link: "#services",
    image: servicesNav,
  },
  {
    text: "About",
    link: "#about",
    image: aboutNav,
  },
  {
    text: "Work",
    link: "#work",
    image: workNav,
  },
  {
    text: "Contact",
    link: "#contact",
    image: contactNav,
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
      { id: 4, name: "Python" },
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
