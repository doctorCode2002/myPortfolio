export default function TestimonialCard({
  quote = "I worked with Mohammed on a project for a startup and they did an amazing job. They were always responsive and helpful. I would definitely recommend them to anyone looking for a front-end developer.",
  name = "mohammed",
  role = "Front-End Developer",
  company = "Startup",
  rating = 5,
  index,
}) {
  return (
    <article
      className="mx-4 sm:mx-5 group relative border border-black bg-white transition-colors duration-300 ease-in-out hover:bg-black 
                 w-[85vw] sm:w-100 lg:w-105 max-w-105 shrink-0 flex flex-col justify-between
                 p-5 sm:p-6 lg:p-7 cursor-default select-none overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4 sm:mb-6">
        {index && (
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-black/30 group-hover:text-white/30 transition-colors duration-300">
            {index}
          </span>
        )}
        <div className="flex gap-0.75 ml-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full border border-black transition-colors duration-300
                ${
                  i < rating
                    ? "bg-black group-hover:bg-white group-hover:border-white"
                    : "bg-transparent group-hover:border-white"
                }`}
            />
          ))}
        </div>
      </div>

      {/* Quote decoration */}
      <span
        className="absolute -top-4 left-5 text-[80px] sm:text-[100px] lg:text-[120px] leading-none font-bold text-black/4
                   group-hover:text-white/[0.07] transition-colors duration-300 pointer-events-none select-none"
        style={{ fontFamily: "'DM Serif Display', serif" }}
        aria-hidden="true"
      >
        "
      </span>

      {/* Quote */}
      <p
        className="text-sm sm:text-[15px] lg:text-base leading-relaxed text-black group-hover:text-white
                   transition-colors duration-300 mb-6 sm:mb-8 relative z-10"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        "{quote}"
      </p>

      {/* Divider */}
      <div className="w-full border-t border-black/20 group-hover:border-white/20 transition-colors duration-300 mb-4 sm:mb-5" />

      {/* Footer */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm sm:text-base font-semibold tracking-tight text-black group-hover:text-white transition-colors duration-300 leading-tight">
            {name}
          </p>
          <p className="text-xs sm:text-sm text-black/50 group-hover:text-white/50 transition-colors duration-300 mt-0.5">
            {role}
            {company && (
              <>
                <span className="mx-1 opacity-40">·</span>
                {company}
              </>
            )}
          </p>
        </div>
        {/* Arrow badge */}
        {/* <div
//           className="shrink-0 w-8 h-8 border border-black group-hover:border-white flex items-center justify-center
//                      transition-colors duration-300"
//         >
//           <svg
//             className="w-3 h-3 text-black group-hover:text-white transition-colors duration-300"
//             viewBox="0 0 12 12"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="1.5"
//           >
//             <path d="M2 10L10 2M10 2H4M10 2V8" />
//           </svg>
//         </div> */}
      </div>
    </article>
  );
}
