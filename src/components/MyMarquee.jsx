import * as MarqueeModule from "react-fast-marquee";

const resolveMarqueeComponent = (mod) => {
  let current = mod;

  for (let i = 0; i < 3; i += 1) {
    if (!current) break;
    if (typeof current === "function" || current.$$typeof) return current;
    current = current.default;
  }

  return mod?.default?.default ?? mod?.default ?? mod;
};

const Marquee = resolveMarqueeComponent(MarqueeModule);

export default function MyMarquee({ children }) {
  return (
    <Marquee autoFill speed={45} pauseOnHover>
      {children}
    </Marquee>
  );
}
