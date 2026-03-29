import React, { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Link } from "react-router-dom";

const navLinks = [
  { name: "Home", to: "#" },
  { name: "About", to: "#" },
  { name: "Services", to: "#" },
  { name: "Contact", to: "#" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const linksRef = useRef([]);
  const topRef = useRef();
  const midRef = useRef();
  const botRef = useRef();

  useGSAP(() => {
    if (open) {
      gsap.to(menuRef.current, {
        autoAlpha: 1,
        pointerEvents: "auto",
        ease: "none",
      });

      gsap.fromTo(
        linksRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: "none",
        }
      );

      gsap.to(midRef.current, { opacity: 0 });
      gsap.to(topRef.current, { rotate: 45, y: 6 });
      gsap.to(botRef.current, { rotate: -45, y: -6 });
    } else {
      gsap.to(menuRef.current, {
        autoAlpha: 0,
        pointerEvents: "none",
      });

      gsap.to(midRef.current, { opacity: 1 });
      gsap.to(topRef.current, { rotate: 0, y: 0 });
      gsap.to(botRef.current, { rotate: 0, y: 0 });
    }
  }, [open]);

  return (
    <div className="fixed top-0 left-0 w-full z-50">
      <nav className="flex items-center justify-between px-6 py-4 bg-transparent relative z-60">
        <div className="text-white/70 hover:text-white transition cursor-pointer text-lg font-semibold">
          Mohammed Ashraf
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="w-12 aspect-square rounded-full border border-white/30 flex items-center justify-center cursor-pointer backdrop-blur-md z-60"
        >
          <div className="flex flex-col gap-1">
            <span ref={topRef} className="block w-5 h-0.5 bg-white/70" />
            <span ref={midRef} className="block w-5 h-0.5 bg-white/70" />
            <span ref={botRef} className="block w-5 h-0.5 bg-white/70" />
          </div>
        </button>
      </nav>

      <div
        ref={menuRef}
        className="fixed inset-0 opacity-0 pointer-events-none backdrop-blur-2xl bg-white/10 flex items-center justify-center z-40"
      >
        <div className="flex flex-col gap-8 text-center">
          {navLinks.map((link, i) => (
            <Link
              key={i}
              to={link.to}
              ref={(el) => (linksRef.current[i] = el)}
              className="text-white/60 hover:text-white text-2xl md:text-4xl transition"
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
