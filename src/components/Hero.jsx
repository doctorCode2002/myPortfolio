import React from "react";
import bg from "/bg.png";
import Container from "./Container";

export default function Hero() {
  return (
    <div className="relative h-screen" id="home">
      <div className="absolute inset-0 -z-1 pointer-events-none">
        <img src={bg} alt="" className=" w-full object-cover" />
      </div>
      <Container className="h-screen flex justify-center items-center text-white">
        <main>this is a test</main>
      </Container>
    </div>
  );
}
