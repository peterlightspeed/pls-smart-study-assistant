// Single source of truth for navigation. Bottom bar shows the `tab` routes plus "More".
export const ROUTES = [
  { path: "home", label: "Home", icon: "house", tab: true, loader: () => import("../features/dashboard/view.js") },
  { path: "goals", label: "Goals", icon: "check2-circle", tab: true, loader: () => import("../features/goals/view.js") },
  { path: "planner", label: "Planner", icon: "calendar-week", tab: true, loader: () => import("../features/planner/view.js") },
  { path: "notes", label: "Notes", icon: "journal-text", tab: true, loader: () => import("../features/notes/view.js") },
  { path: "gallery", label: "Gallery", icon: "images", loader: () => import("../features/gallery/view.js") },
  { path: "analytics", label: "Analytics", icon: "bar-chart", loader: () => import("../features/analytics/view.js") },
  { path: "settings", label: "Settings", icon: "gear", loader: () => import("../features/settings/view.js") },
];

export const MORE = { path: "more", label: "More", icon: "three-dots", loader: () => import("../features/more/view.js") };

export const findRoute = (path) => [...ROUTES, MORE].find((r) => r.path === path);
export const loadView = (route) => route.loader();
