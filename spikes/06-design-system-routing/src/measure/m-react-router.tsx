// Isolated bundle probe — React Router's realistic used surface (React externalized in vite.config).
import { createBrowserRouter, Link, Outlet, RouterProvider, useNavigate, useParams } from "react-router";

function Inner() {
  const p = useParams();
  const n = useNavigate();
  return (
    <Link to="/" onClick={() => n("/")}>
      {p.id}
    </Link>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Outlet />, children: [{ index: true, element: <Inner /> }, { path: "a/:id", element: <Inner /> }] },
]);

export function M() {
  return <RouterProvider router={router} />;
}
