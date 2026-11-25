import { createWorld } from '@silicon-empire/simulation';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';
import { MainMenu } from './ui/MainMenu';
import { Workshop } from './ui/Workshop';
import type { WorkshopSession } from './ui/Workshop';

function App() {
  const [session, setSession] = useState<WorkshopSession | null>(null);

  function startWorkshop(name: string, sandbox: boolean) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    setSession({ id, name, createdAt: Date.now(), savedAt: null, world: createWorld(sandbox ? 'sandbox' : 'progression') });
  }

  return session
    ? <Workshop session={session} onMenu={() => setSession(null)} />
    : <MainMenu onNewGame={startWorkshop} onResume={setSession} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Point de montage de Silicon Empire introuvable.');
createRoot(root).render(<App />);
