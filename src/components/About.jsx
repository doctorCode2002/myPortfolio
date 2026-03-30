import React from "react";
import Section from "./Section";
import MaskText from "./MaskText";

export default function About() {
  return (
    <Section id="about">
      <MaskText
        ogText="Writing beautiful code means thinking like an artist and debugging like a detective. Every function is a story, every variable a character. Master your craft through practice, patience, and endless curiosity."
        ogSpan="beautiful code"
        maskText="Building great software requires seeing beyond syntax into architecture and design. Test early, refactor often, document clearly. Success comes from collaboration and caring deeply about user experience."
        maskSpan="great software"
        bgColor="#000000"
      />
    </Section>
  );
}
