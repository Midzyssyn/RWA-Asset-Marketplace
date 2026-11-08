import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { Header } from "./components/Header";
import { AdminPage } from "./pages/AdminPage";
import { MarketPage } from "./pages/MarketPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import "./App.css";

/** 投资人前台壳：顶栏 + 内容 */
function MarketShell() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route element={<MarketShell />}>
          <Route path="/" element={<MarketPage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/invest" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
