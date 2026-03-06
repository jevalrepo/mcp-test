import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Layout from "./components/Layout";
import Proyectos from "./pages/Proyectos";
import DetalleProyecto from "./pages/DetalleProyecto";
import Etapas from "./pages/Etapas";
import SqlPage from "./pages/Sql";
import { ToastProvider } from "./components/Toast";
import { ConfirmProvider } from "./components/ConfirmDialog";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

const theme = createTheme({
  typography: { fontFamily: "'Inter', system-ui, sans-serif" },
  components: {
    MuiTableCell: {
      styleOverrides: { root: { fontFamily: "'Inter', system-ui, sans-serif" } },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/ppm" element={<Layout />}>
                  <Route index element={<Proyectos />} />
                  <Route path="proyectos/:folio" element={<DetalleProyecto />} />
                  <Route path="etapas" element={<Etapas />} />
                  <Route path="sql" element={<SqlPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
