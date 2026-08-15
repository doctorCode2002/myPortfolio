export default function Section({ children, className = "", id }) {
  return (
    <section id={id || undefined} className={`w-full py-12 ${className}`}>
      {children}
    </section>
  );
}
