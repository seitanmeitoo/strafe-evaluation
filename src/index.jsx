/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import OverlayApp from "./components/OverlayApp";

const isOverlay =
  window.location.search.includes("overlay=true") ||
  window.location.hash.includes("overlay");

render(() => (isOverlay ? <OverlayApp /> : <App />), document.getElementById("root"));
