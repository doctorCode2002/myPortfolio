import React from "react";
import Navbar from "./components/Navbar";
import ScrollSmootherLayout from "./components/ScrollSmootherLayout.jsx";
import Hero from "./components/Hero.jsx";
import Spacer from "./components/Spacer.jsx";

export default function App() {
  return (
    <div className="bg-black relative flex justify-center">
      <Navbar />
      <ScrollSmootherLayout>
        <Hero />
        <Spacer />
        <Spacer />
      </ScrollSmootherLayout>
    </div>
  );
}
