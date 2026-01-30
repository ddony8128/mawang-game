import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./App.css";

import { GamePage } from "./pages/GamePage";
import { HowToPlayPage } from "./pages/HowToPlayPage";
import { LobbyPage } from "./pages/LobbyPage";
import { MainPage } from "./pages/MainPage";
import { ResultPage } from "./pages/ResultPage";
import { RoomsPage } from "./pages/RoomsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/room/:roomId/lobby" element={<LobbyPage />} />
        <Route path="/room/:roomId/game" element={<GamePage />} />
        <Route path="/room/:roomId/result" element={<ResultPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
