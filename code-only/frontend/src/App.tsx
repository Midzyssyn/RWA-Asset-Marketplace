import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { AdminPage } from "./pages/AdminPage";
import { MarketPage } from "./pages/MarketPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main">
          <Routes>
            <Route path="/" element={<MarketPage />} />
            <Route path="/project/:id" element={<ProjectDetailPage />} />
            <Route path="/invest" element={<Navigate to="/" replace />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
