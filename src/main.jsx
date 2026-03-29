import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ScrollSmootherLayout from "./components/ScrollSmootherLayout.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ScrollSmootherLayout>
      <App />
    </ScrollSmootherLayout>
  </StrictMode>,
);
