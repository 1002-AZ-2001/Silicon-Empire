import { createWorld } from '@silicon-empire/simulation';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';
import { createSaveId } from './persistence/save-data';
import { MainMenu } from './ui/MainMenu';
import { Workshop } from './ui/Workshop';
import type { GameMode } from '@silicon-empire/simulation';
import type { WorkshopSession } from './ui/Workshop';

function App() {
  const [session, setSession] = useState<WorkshopSession | null>(null);

  function startWorkshop(name: string, mode: GameMode) {
    const id = createSaveId();
    setSession({ id, name, createdAt: Date.now(), savedAt: null, world: createWorld(mode, { utilities: true }) });
  }

  return session
    ? <Workshop session={session} onMenu={() => setSession(null)} />
    : <MainMenu onNewGame={startWorkshop} onResume={setSession} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Point de montage de Silicon Empire introuvable.');
createRoot(root).render(<App />);
