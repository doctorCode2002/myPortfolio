import img1 from "/assets/projects/img1.png"
import img2 from "/assets/projects/img2.png"
import img3 from "/assets/projects/img3.png"
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
    name: "Mobile Accessories E-commerce",
    description:
      "An online store specializing in phone accessories including cases, chargers, cables, and power banks with MagSafe compatibility.",
    href: "",
    image: img1,
    bgImage: img2,
    frameworks: [
      { id: 1, name: "React" },
      { id: 2, name: "Next.js" },
      { id: 3, name: "Node.js" },
      { id: 4, name: "MongoDB" },
      { id: 5, name: "Tailwind CSS" },
    ],
  },
  {
    id: 2,
    name: "Plant Shop E-commerce",
    description:
      "An online store specializing in rare and decorative plants with a clean, user-friendly interface.",
    href: "",
    image: "https://picsum.photos/600/400?random=2",
    bgImage: "https://picsum.photos/1900/1080?random=12",
    frameworks: [
      { id: 1, name: "React" },
      { id: 2, name: "Next.js" },
      { id: 3, name: "Stripe API" },
      { id: 4, name: "Tailwind CSS" },
    ],
  },
  {
    id: 3,
    name: "Apple Tech Marketplace",
    description:
      "An e-commerce platform for Apple products and accessories with deals and category filtering.",
    href: "",
    image: "https://picsum.photos/600/400?random=3",
    bgImage: "https://picsum.photos/1900/1080?random=13",
    frameworks: [
      { id: 1, name: "Blazor" },
      { id: 2, name: "ASP.NET Core" },
      { id: 3, name: "SQL Server" },
      { id: 4, name: "Bootstrap" },
    ],
  },
  {
    id: 4,
    name: "Electronics & Gadgets Store",
    description:
      "A multi-category online shop featuring electronics, home appliances, and gaming gear with special offers.",
    href: "",
    image: "https://picsum.photos/600/400?random=4",
    bgImage: "https://picsum.photos/1900/1080?random=14",
    frameworks: [
      { id: 1, name: "Vue.js" },
      { id: 2, name: "Laravel" },
      { id: 3, name: "MySQL" },
      { id: 4, name: "SCSS" },
    ],
  },
];
