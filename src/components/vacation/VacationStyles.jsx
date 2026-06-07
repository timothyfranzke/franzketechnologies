// Shared Nifty Fifty styles for the vacation sub-app.
// Mirrors src/components/StatesCapitalsGame.jsx (vintage travel-poster aesthetic).
const VacationStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;0,9..144,900;1,9..144,600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

    :root {
      --cream: #F3E8D2;
      --paper: #EADFC6;
      --ink: #1A2537;
      --deep: #0E1726;
      --rust: #C14A33;
      --rust-dark: #9A3825;
      --gold: #D9A441;
      --sage: #6B8E6F;
      --dusty: #8A7E68;
    }

    * { -webkit-tap-highlight-color: transparent; }

    body {
      font-family: 'Manrope', sans-serif;
      background-color: var(--cream);
      color: var(--ink);
    }

    .font-display { font-family: 'Fraunces', serif; font-variation-settings: "SOFT" 50, "WONK" 1; }
    .font-body { font-family: 'Manrope', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    .paper-texture {
      background-color: var(--cream);
      background-image:
        radial-gradient(at 20% 30%, rgba(193, 74, 51, 0.06) 0px, transparent 50%),
        radial-gradient(at 80% 70%, rgba(217, 164, 65, 0.08) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(26, 37, 55, 0.04) 0px, transparent 50%);
    }

    .stamp {
      border: 2px solid var(--rust);
      color: var(--rust);
      transform: rotate(-4deg);
      letter-spacing: 0.15em;
      display: inline-block;
    }

    .btn-primary {
      background: var(--rust);
      color: var(--cream);
      border: 2px solid var(--ink);
      box-shadow: 3px 3px 0 var(--ink);
      border-radius: 1rem;
      padding: 0.75rem 1.25rem;
      font-family: 'Fraunces', serif;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.01em;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
      cursor: pointer;
    }
    .btn-primary:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--ink); }
    .btn-primary:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary {
      background: var(--cream);
      color: var(--ink);
      border: 2px solid var(--ink);
      box-shadow: 3px 3px 0 var(--ink);
      border-radius: 1rem;
      padding: 0.75rem 1.25rem;
      font-family: 'Fraunces', serif;
      font-weight: 700;
      font-size: 1.05rem;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
      cursor: pointer;
    }
    .btn-secondary:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--ink); }
    .btn-secondary:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }

    .btn-ghost {
      background: transparent;
      color: var(--ink);
      border: 2px solid var(--ink);
      border-radius: 999px;
      padding: 0.4rem 0.9rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-ghost:hover { background: rgba(26,37,55,0.08); }

    .vacation-input {
      width: 100%;
      background: var(--cream);
      border: 2px solid var(--ink);
      border-radius: 1rem;
      padding: 0.75rem 1rem;
      font-family: 'Manrope', sans-serif;
      font-size: 1rem;
      color: var(--ink);
      outline: none;
      transition: box-shadow 0.1s ease;
    }
    .vacation-input:focus { box-shadow: 3px 3px 0 var(--ink); }
    .vacation-input::placeholder { color: var(--dusty); }

    .vacation-card {
      background: var(--paper);
      border: 2px solid var(--ink);
      box-shadow: 4px 4px 0 var(--ink);
      border-radius: 1.25rem;
    }

    .tab-bar {
      display: flex;
      gap: 0;
      border: 2px solid var(--ink);
      border-radius: 999px;
      overflow: hidden;
      background: var(--cream);
    }
    .tab-btn {
      flex: 1;
      padding: 0.6rem 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--ink);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tab-btn[data-active="true"] {
      background: var(--ink);
      color: var(--cream);
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
  `}</style>
);

export default VacationStyles;
