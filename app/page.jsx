import PageShell from "../src/components/PageShell";
import Navbar from "../src/components/Navbar";
import Hero from "../src/components/Hero";
import Services from "../src/components/Services";
import About from "../src/components/About";
import Work from "../src/components/Work";
import Feedback from "../src/components/Feedback";
import MentorProfile from "../src/components/MentorProfile";
import StudentReviews from "../src/components/StudentReviews";
import Contact from "../src/components/Contact";

export default function Home() {
  return (
    <PageShell>
      <Navbar />
      <Hero />
      <Services />
      <About />
      <Work />
      <Feedback />
      <MentorProfile />
      <StudentReviews />
      <Contact />
    </PageShell>
  );
}
