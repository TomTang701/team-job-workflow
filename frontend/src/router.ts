import { useEffect, useState } from "react";

export { parseRoute, routeHash, type Route } from "./routes";
import { parseRoute, type Route } from "./routes";

export function navigate(path: string): void {
  window.location.hash = path.startsWith("#") ? path.slice(1) : path;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash || "#/auth"));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash || "#/auth"));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
