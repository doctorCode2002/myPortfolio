import civicMind from "/assets/projects/civicMind.webp";
import eyadDesinger from "/assets/projects/eyadDesinger.webp";
import salehWebsitePreview from "/assets/projects/saleh-website-previeew.webp";
import onyx from "/assets/projects/onyx.webp";
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
  {
    id: 3,
    name: "Saleh Portfolio",
    description:
      "A modern portfolio for a graphic designer showcasing their work and services.",
    href: "https://salehaburayya.com",
    image: salehWebsitePreview,
    frameworks: [
      { id: 1, name: "React" },
      { id: 2, name: "Tailwind CSS" },
      { id: 3, name: "GSAP" },
    ],
  },
  {
    id: 4,
    name: "ONYX E-commerce",
    description:
      "A modern e-commerce platform for a store showcasing their products.",
    href: "https://e-commerce-pink-iota.vercel.app/",
    image: onyx,
    frameworks: [
      { id: 1, name: "React" },
      { id: 2, name: "Tailwind CSS" },
      { id: 3, name: "GSAP" },
      { id: 4, name: "Motion" },
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
export const TESTIMONIALS = [
  {
    quote:
      "Mohammed delivered exceptional work on our startup project. Communication was smooth and deadlines were always met every time.",
    name: "Ahmad Khalil",
    role: "Product Manager",
    company: "TechFlow",
    rating: 5,
  },
  {
    quote:
      "Very professional and detail oriented. The UI quality exceeded expectations and the process was smooth from start to finish always.",
    name: "Sara Ali",
    role: "UI/UX Designer",
    company: "Creative Studio",
    rating: 4,
  },
  {
    quote:
      "Very professional and detail oriented. The website quality exceeded expectations, and the whole process was smooth, efficient, and easy from beginning to end.",
    name: "Saleh Abu Rayya",
    role: "Graphic Designer",
    company: "Freelance",
    rating: 5,
  },
  {
    quote:
      "Fast reliable and highly skilled in front end development. Delivered clean code and great performance. Would definitely work again.",
    name: "Omar Hassan",
    role: "CTO",
    company: "Startup Inc.",
    rating: 5,
  },
  {
    quote:
      "Mohammed built my portfolio with a clean modern style that reflects my work perfectly. Smooth process and great attention to detail.",
    name: "Eyad Alzayan",
    role: "Graphic Designer",
    company: "Freelance",
    rating: 5,
  },
];
