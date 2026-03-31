import React from "react";
import Navbar from "./components/Navbar";
import ScrollSmootherLayout from "./components/ScrollSmootherLayout.jsx";
import Hero from "./components/Hero.jsx";
import About from "./components/About.jsx";
import Services from "./components/Services.jsx";
import Contact from "./components/Contact.jsx";
import Work from "./components/Work.jsx";
import BentoGallery from "./components/BentoGallery.jsx";

export default function App() {
  return (
    <div className="bg-black relative flex justify-center">
      <Navbar />
      <ScrollSmootherLayout>
        <Hero />
        <Services />
        <About />
        <Work/>
        <Contact />
      </ScrollSmootherLayout>
    </div>
  );
}
