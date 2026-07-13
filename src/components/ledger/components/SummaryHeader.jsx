import { formatCents, formatSigned } from '../money.js';
import { ChevronDownIcon, SearchIcon } from './icons.jsx';
import FlagDot from './FlagDot.jsx';

/**
 * The always-visible account header: Balance large, Cleared/Outstanding right.
 * In flag mode (`flagSummary` set) it becomes Net large, In/Out right.
 */
export default function SummaryHeader({ account, totals, onAccountTap, onSearchTap, searchOpen, search, onSearch, menuSlot, flagSummary }) {
  const empty = totals.balance === 0 && totals.cleared === account.startingBalance && totals.outstanding === 0;
  return (
    <div className="reg-header">
      <div className="reg-header-top">
        <button type="button" className="reg-account-btn" onClick={onAccountTap} aria-label={`Account: ${account.name}. Switch account`}>
          {account.name}
          <span style={{ color: 'var(--ink-2)' }}>
            <ChevronDownIcon />
          </span>
        </button>
        <div className="reg-actions">
          <button type="button" className="icon-btn" onClick={onSearchTap} aria-label="Search payees" aria-expanded={searchOpen}>
            <SearchIcon />
          </button>
          {menuSlot}
        </div>
      </div>
      {flagSummary ? (
        <div className="reg-balances">
          <div>
            <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlagDot color={flagSummary.color} />
              {flagSummary.name}
            </div>
            <div className="balance-big money">{formatSigned(flagSummary.net)}</div>
          </div>
          <div className="reg-substats">
            {(flagSummary.seed ?? 0) !== 0 && (
              <div>
                <div className="stat-label stat-label--sub">Seed</div>
                <div className="stat-value money">{formatSigned(flagSummary.seed)}</div>
              </div>
            )}
            <div>
              <div className="stat-label stat-label--sub">In</div>
              <div className="stat-value money">{formatCents(flagSummary.inflow)}</div>
            </div>
            <div>
              <div className="stat-label stat-label--sub">Out</div>
              <div className="stat-value money">{formatCents(flagSummary.outflow)}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="reg-balances">
          <div>
            <div className="stat-label">Balance</div>
            <div className={`balance-big money${empty ? ' balance-big--zero' : ''}`}>{formatCents(totals.balance)}</div>
          </div>
          <div className="reg-substats">
            <div>
              <div className="stat-label stat-label--sub">Cleared</div>
              <div className="stat-value money">{formatCents(totals.cleared)}</div>
            </div>
            <div>
              <div className="stat-label stat-label--sub">Outstanding</div>
              <div className={`stat-value money${totals.outstanding !== 0 ? ' stat-value--dashed' : ''}`}>
                {formatCents(totals.outstanding)}
              </div>
            </div>
          </div>
        </div>
      )}
      {searchOpen && (
        <div className="reg-search">
          <input
            type="search"
            placeholder="Search payees"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            autoFocus
            aria-label="Search payees"
          />
        </div>
      )}
    </div>
  );
}
