import { useState } from 'react';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import './tokens.css';

// View state machine. Each view is a full screen; `view.name` picks the screen
// and the rest of the object carries its context (e.g. { name: 'entry', txId }).
export default function App() {
  const [view, setView] = useState({ name: 'register' });

  return (
    <div className="ledger-app">
      {view.name === 'register' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
          Checkbook Ledger — coming together
        </div>
      )}
    </div>
  );
}
