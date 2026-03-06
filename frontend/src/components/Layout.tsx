import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Outlet />
    </main>
  )
}
