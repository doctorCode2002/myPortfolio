import { useState, useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Container from "./Container";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { navLinks } from "../constants";

gsap.registerPlugin(ScrollToPlugin);

function MenuItem({
  text,
  image,
  speed,
  textColor,
  marqueeBgColor,
  marqueeTextColor,
  borderColor,
  isFirst,
  onClick,
}) {
  const itemRef = useRef(null);
  const marqueeRef = useRef(null);
  const marqueeInnerRef = useRef(null);
  const animationRef = useRef(null);
  const [repetitions, setRepetitions] = useState(4);

  const animationDefaults = { duration: 0.6, ease: "expo" };

  const findClosestEdge = (mouseX, mouseY, width, height) => {
    const topEdgeDist = (mouseX - width / 2) ** 2 + mouseY ** 2;
    const bottomEdgeDist = (mouseX - width / 2) ** 2 + (mouseY - height) ** 2;
    return topEdgeDist < bottomEdgeDist ? "top" : "bottom";
  };

  useEffect(() => {
    const calculateRepetitions = () => {
      if (!marqueeInnerRef.current) return;
      const marqueeContent =
        marqueeInnerRef.current.querySelector(".marquee-part");
      if (!marqueeContent) return;
      const contentWidth = marqueeContent.offsetWidth;
      const viewportWidth = window.innerWidth;
      const needed = Math.ceil(viewportWidth / contentWidth) + 2;
      setRepetitions(Math.max(4, needed));
    };

    calculateRepetitions();
    window.addEventListener("resize", calculateRepetitions);
    return () => window.removeEventListener("resize", calculateRepetitions);
  }, [text, image]);

  useEffect(() => {
    const setupMarquee = () => {
      if (!marqueeInnerRef.current) return;
      const marqueeContent =
        marqueeInnerRef.current.querySelector(".marquee-part");
      if (!marqueeContent) return;
      const contentWidth = marqueeContent.offsetWidth;
      if (contentWidth === 0) return;

      if (animationRef.current) {
        animationRef.current.kill();
      }

      animationRef.current = gsap.to(marqueeInnerRef.current, {
        x: -contentWidth,
        duration: speed,
        ease: "none",
        repeat: -1,
      });
    };

    const timer = setTimeout(setupMarquee, 50);
    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };
  }, [text, image, repetitions, speed]);

  const handleMouseEnter = (ev) => {
    if (!itemRef.current || !marqueeRef.current || !marqueeInnerRef.current)
      return;
    const rect = itemRef.current.getBoundingClientRect();
    const edge = findClosestEdge(
      ev.clientX - rect.left,
      ev.clientY - rect.top,
      rect.width,
      rect.height,
    );

    gsap
      .timeline({ defaults: animationDefaults })
      .set(marqueeRef.current, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .set(marqueeInnerRef.current, { y: edge === "top" ? "101%" : "-101%" }, 0)
      .to([marqueeRef.current, marqueeInnerRef.current], { y: "0%" }, 0);
  };

  const handleMouseLeave = (ev) => {
    if (!itemRef.current || !marqueeRef.current || !marqueeInnerRef.current)
      return;
    const rect = itemRef.current.getBoundingClientRect();
    const edge = findClosestEdge(
      ev.clientX - rect.left,
      ev.clientY - rect.top,
      rect.width,
      rect.height,
    );

    gsap
      .timeline({ defaults: animationDefaults })
      .to(marqueeRef.current, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .to(marqueeInnerRef.current, { y: edge === "top" ? "101%" : "-101%" }, 0);
  };

  return (
    <div
      className="flex-1 relative overflow-hidden text-center"
      ref={itemRef}
      style={{ borderTop: isFirst ? "none" : `1px solid ${borderColor}` }}
    >
      <button
        className="flex items-center outline-none justify-center w-full h-full relative cursor-pointer uppercase no-underline font-semibold text-[4vh] bg-transparent border-none"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ color: textColor }}
      >
        {text}
      </button>
      <div
        className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none translate-y-[101%]"
        ref={marqueeRef}
        style={{ backgroundColor: marqueeBgColor }}
      >
        <div className="h-full w-fit flex" ref={marqueeInnerRef}>
          {[...Array(repetitions)].map((_, idx) => (
            <div
              className="marquee-part flex items-center shrink-0"
              key={idx}
              style={{ color: marqueeTextColor }}
            >
              <span className="whitespace-nowrap uppercase font-normal text-[4vh] leading-none px-[1vw]">
                {text}
              </span>
              <div
                className="w-50 h-[7vh] my-[2em] mx-[2vw] py-[1em] rounded-[50px] bg-cover bg-center"
                style={{ backgroundImage: `url(${image})` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowingMenu({
  items = [],
  onNavigate,
  speed = 15,
  textColor = "#fff",
  bgColor = "#060010",
  marqueeBgColor = "#fff",
  marqueeTextColor = "#060010",
  borderColor = "#fff",
}) {
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      <nav className="flex flex-col h-full m-0 p-0">
        {items.map((item, idx) => (
          <MenuItem
            key={idx}
            {...item}
            speed={speed}
            textColor={textColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={borderColor}
            isFirst={idx === 0}
            onClick={() => onNavigate(item.link)}
          />
        ))}
      </nav>
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const linksRef = useRef([]);
  const topRef = useRef();
  const midRef = useRef();
  const botRef = useRef();

  const handleScroll = (target) => {
    gsap.to(window, {
      duration: 1,
      scrollTo: target,
      ease: "power3.inOut",
    });

    setOpen(false);
  };

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
        },
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
    <Container className="fixed z-50">
      <nav className="flex top-0 left-0 w-full items-center justify-between py-4 bg-transparent z-60 relative">
        <button
          onClick={() => handleScroll("#home")}
          className="text-white/70 outline-none  hover:text-white transition duration-300 cursor-pointer text-lg font-semibold"
        >
          Mohammed Ashraf
        </button>

        <button
          onClick={() => setOpen(!open)}
          className="w-12 aspect-square outline-none rounded-full border border-white/30 flex items-center justify-center cursor-pointer backdrop-blur-md z-60"
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
        className="fixed inset-0 opacity-0 pointer-events-none backdrop-blur-2xl bg-black flex items-center justify-center z-40"
      >
        <div className="h-150 relative w-full">
          <FlowingMenu
            items={navLinks}
            onNavigate={handleScroll}
            speed={15}
            textColor="#ffffff"
            bgColor="#000000"
            marqueeBgColor="#ffffff"
            marqueeTextColor="#000000"
            borderColor="#ffffff"
          />
        </div>
      </div>
    </Container>
  );
}
