export default function Section({ children, className = "", id = "" }) {
  return <section id={id} className={`w-full py-12 ${className}`}>{children}</section>;
}
