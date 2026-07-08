import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Link, NavLink, Outlet, useLocation, useMatches } from "react-router";
import * as RadixDialog from "@radix-ui/react-dialog";
import { exportUrl } from "./api";
import { useApi } from "./api-context";
import {
  AccountsIcon,
  BrandIcon,
  CloseIcon,
  DownloadIcon,
  EnvelopesIcon,
  HomeIcon,
  type IconProps,
  InsightsIcon,
  ManageIcon,
  MenuIcon,
  NeedsIcon,
  PanelLeftIcon,
  PayPeriodsIcon,
  PlusIcon,
  RecurringIcon,
  TemplatesIcon,
} from "./ui/icons";
import styles from "./AppShell.module.css";

/**
 * FEAT-UXR1 — the sidebar app shell (supersedes the UX3 top-banner chrome). The reference layout:
 * a grouped left `<nav aria-label="Primary">` (Budget · Ledgers · Planning · Administration, with
 * the global Add-transaction as its footer action), a top bar carrying the collapse toggle + the
 * page's single `<h1>` (+ a compact "+ Add" at ≤ 640px), and the route as the content canvas.
 *
 * NO route/data/API/domain change (ADR-0006 routing unchanged) — the same URLs behind new chrome.
 *
 * Three layout modes: expanded (default ≥ 640px) · rail (icon-only, persisted user choice) ·
 * drawer (≤ 640px, off-canvas, on the Radix `Dialog` machinery — focus trap / Esc / scrim /
 * focus-restore, never hand-rolled). The needs-allocation count badge (R2) is carried verbatim
 * from UX3: refetched per path change, a failed fetch leaves it absent (auxiliary, never breaks
 * the chrome).
 *
 * Page title (Q3): the shell OWNS the single `<h1>`. Static routes carry `handle: { title }` in
 * routes.tsx (read via `useMatches`); dynamic routes (account register · envelope ledger) publish
 * their resolved name through `PageTitleContext` (`useSetPageTitle`), falling back to the handle's
 * kind label until their data arrives. `document.title` follows.
 */

const SIDEBAR_KEY = "budgeteer.sidebar"; // "expanded" | "rail" — client UI state only, never API state.

/** The shell exposes a setter so a dynamic route can publish its resolved page title. A no-op
 *  default keeps view unit tests (rendered without the shell) working — the hook is inert there. */
const PageTitleContext = createContext<(title: string | null) => void>(() => {});

/** Publish the current view's page title to the shell's `<h1>` (dynamic routes). Passing
 *  null/undefined (e.g. before the name has loaded) leaves the shell on its route-handle fallback;
 *  the title is cleared on unmount so the next route falls back cleanly. */
export function useSetPageTitle(title: string | null | undefined): void {
  const setTitle = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [setTitle, title]);
}

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  /** NavLink `end` — exact-match only (Home). Omitted items match by path prefix so
   *  a detail route (/accounts/:id) lights its parent (Accounts). */
  end?: boolean;
  /** The needs-allocation count surfaces on this item. */
  badge?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Budget",
    items: [
      { to: "/", label: "Home", icon: HomeIcon, end: true },
      { to: "/insights", label: "Insights", icon: InsightsIcon },
    ],
  },
  {
    heading: "Ledgers",
    items: [
      { to: "/accounts", label: "Accounts", icon: AccountsIcon },
      { to: "/envelopes", label: "Envelopes", icon: EnvelopesIcon },
      { to: "/needs-allocation", label: "Needs allocation", icon: NeedsIcon, badge: true },
    ],
  },
  {
    heading: "Planning",
    items: [
      { to: "/templates", label: "Templates", icon: TemplatesIcon },
      { to: "/recurring", label: "Recurring", icon: RecurringIcon },
      // FEAT-UXR2 — Pay periods is now a first-class route (was a deep-link into Insights).
      { to: "/pay-periods", label: "Pay periods", icon: PayPeriodsIcon },
    ],
  },
  {
    heading: "Administration",
    items: [{ to: "/manage", label: "Manage", icon: ManageIcon }],
  },
];

function readSidebarState(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "rail";
  } catch {
    return false; // localStorage unavailable (privacy mode) — default to expanded.
  }
}

function writeSidebarState(rail: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, rail ? "rail" : "expanded");
  } catch {
    /* persistence is best-effort — a failure just means the choice doesn't survive reload. */
  }
}

/** The grouped nav + footer action, shared by the persistent sidebar and the drawer. In the rail
 *  (`rail`), labels/group headings hide and the badge becomes a count-dot; accessible names stay
 *  intact. `onNavigate` closes the drawer after a choice (a no-op for the persistent sidebar). */
function SidebarNav({
  rail,
  needsCount,
  onNavigate,
}: {
  rail: boolean;
  needsCount: number | null;
  onNavigate?: () => void;
}) {
  const hasNeeds = needsCount !== null && needsCount > 0;
  const badgeText = needsCount !== null && needsCount >= 100 ? "99+" : String(needsCount);

  return (
    <nav aria-label="Primary" className={styles.nav}>
      <div className={styles.groups}>
        {NAV_GROUPS.map((group) => {
          const headingId = `nav-group-${group.heading.toLowerCase()}`;
          return (
            <div key={group.heading} className={styles.group}>
              <p id={headingId} className={styles.groupHeading} aria-hidden={rail || undefined}>
                {group.heading}
              </p>
              <ul aria-labelledby={headingId} className={styles.groupList}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const showBadge = item.badge === true && hasNeeds;
                  const label =
                    showBadge && needsCount !== null ? `${item.label} (${needsCount})` : item.label;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        className={styles.navLink}
                        // In the rail (labels hidden) or for the badge item (count must be in the
                        // name), set the accessible name explicitly; otherwise let the visible label
                        // BE the name — so it isn't a stray aria-label a getByLabel("…") could match.
                        aria-label={rail || showBadge ? label : undefined}
                        title={rail ? label : undefined}
                      >
                        <span className={styles.navIcon}>
                          <Icon />
                          {showBadge && rail ? (
                            <span className={styles.dot} aria-hidden="true" />
                          ) : null}
                        </span>
                        <span className={styles.navLabel}>{item.label}</span>
                        {showBadge && !rail ? (
                          <span className={styles.badge} aria-hidden="true">
                            {badgeText}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  );
                })}
                {/* Download backup is a real file link (GET /export), not a route — it lives under
                    Administration but can't be a NavLink. */}
                {group.heading === "Administration" ? (
                  <li>
                    <a
                      href={exportUrl}
                      onClick={onNavigate}
                      className={styles.navLink}
                      aria-label={rail ? "Download backup" : undefined}
                      title={rail ? "Download backup" : undefined}
                    >
                      <span className={styles.navIcon}>
                        <DownloadIcon />
                      </span>
                      <span className={styles.navLabel}>Download backup</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Q2 — the nav's primary action. Full button expanded/in-drawer, icon-only in the rail. */}
      <div className={styles.footer}>
        <Link
          to="/transactions/new"
          onClick={onNavigate}
          className={styles.addTxn}
          aria-label={rail ? "Add transaction" : undefined}
          title={rail ? "Add transaction" : undefined}
        >
          <span className={styles.navIcon}>
            <PlusIcon />
          </span>
          <span className={styles.navLabel}>Add transaction</span>
        </Link>
      </div>
    </nav>
  );
}

export function AppShell() {
  const api = useApi();
  const location = useLocation();
  const matches = useMatches();
  const [needsCount, setNeedsCount] = useState<number | null>(null);
  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);
  const [rail, setRail] = useState<boolean>(readSidebarState);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Needs-allocation badge — refetched per path change so completing an allocation refreshes it;
  // auxiliary, so a failure leaves the badge absent (carried verbatim from UX3).
  useEffect(() => {
    let active = true;
    api
      .listNeedsAllocation()
      .then((txns) => {
        if (active) setNeedsCount(txns.length);
      })
      .catch(() => {
        /* badge is auxiliary — leave it absent on error */
      });
    return () => {
      active = false;
    };
  }, [api, location.pathname]);

  // Navigating always closes the off-canvas drawer (the item click also fires onNavigate; this
  // covers programmatic navigation and back/forward).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const handleTitle = useMemo(() => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const handle = matches[i]?.handle as { title?: string } | undefined;
      if (handle?.title) return handle.title;
    }
    return "Budgeteer";
  }, [matches]);
  const title = dynamicTitle ?? handleTitle;

  useEffect(() => {
    document.title = `${title} — Budgeteer`;
  }, [title]);

  const setPageTitle = useCallback((next: string | null) => setDynamicTitle(next), []);

  const toggleRail = () =>
    setRail((current) => {
      const next = !current;
      writeSidebarState(next);
      return next;
    });

  return (
    <PageTitleContext.Provider value={setPageTitle}>
      <div className={`${styles.shell} ${rail ? styles.railMode : ""}`}>
        {/* Persistent sidebar (≥ 640px). Off-canvas at ≤ 640px, where the drawer takes over. */}
        <aside className={styles.sidebar}>
          <div className={styles.brandRow}>
            <Link to="/" className={styles.brand} aria-label="Budgeteer — home">
              <span className={styles.brandIcon}>
                <BrandIcon />
              </span>
              <span className={styles.brandName}>Budgeteer</span>
            </Link>
          </div>
          <SidebarNav rail={rail} needsCount={needsCount} />
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            {/* ≥ 640px: the collapse/expand toggle. */}
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={!rail}
              aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleRail}
            >
              <PanelLeftIcon />
            </button>
            {/* ≤ 640px: the hamburger opening the drawer (the persistent sidebar is off-canvas). */}
            <button
              ref={hamburgerRef}
              type="button"
              className={styles.hamburger}
              aria-expanded={drawerOpen}
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </button>

            <h1 className={styles.pageTitle} title={title}>
              {title}
            </h1>

            {/* ≤ 640px only: the footer Add is off-canvas, so keep the daily action one tap away. */}
            <Link to="/transactions/new" className={styles.compactAdd} aria-label="Add transaction">
              <PlusIcon />
              <span className={styles.compactAddLabel}>Add</span>
            </Link>
          </header>

          {/* Keyed by pathname so each route mounts fresh (data re-fetches on navigation) and the
              reduced-motion-gated fade replays on change (unchanged from UX3). */}
          <div key={location.pathname} className={styles.content}>
            <Outlet />
          </div>
        </div>

        {/* ≤ 640px off-canvas drawer — the expanded sidebar as a modal side-sheet on the Radix
            Dialog machinery (focus trap, Esc, scrim-click close, focus RESTORE to the hamburger).
            Content lives outside the `main`/`aside` so it's a single primary nav at a time. */}
        <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <RadixDialog.Portal>
            <RadixDialog.Overlay className={styles.scrim} />
            <RadixDialog.Content
              className={styles.drawer}
              aria-describedby={undefined}
              // The drawer is opened by a plain button (controlled open), not a Dialog.Trigger, so
              // restore focus to the hamburger explicitly on close (Esc / scrim / navigate).
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                hamburgerRef.current?.focus();
              }}
            >
              {/* The visually-hidden title is the drawer's accessible name (Radix wires
                  aria-labelledby); no visible duplicate of the brand row below. */}
              <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
              <div className={styles.brandRow}>
                <Link
                  to="/"
                  className={styles.brand}
                  aria-label="Budgeteer — home"
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className={styles.brandIcon}>
                    <BrandIcon />
                  </span>
                  <span className={styles.brandName}>Budgeteer</span>
                </Link>
                <RadixDialog.Close asChild>
                  <button
                    type="button"
                    className={styles.drawerClose}
                    aria-label="Close navigation"
                  >
                    <CloseIcon />
                  </button>
                </RadixDialog.Close>
              </div>
              <SidebarNav
                rail={false}
                needsCount={needsCount}
                onNavigate={() => setDrawerOpen(false)}
              />
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      </div>
    </PageTitleContext.Provider>
  );
}
