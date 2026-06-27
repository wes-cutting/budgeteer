// Axis B, option 2 — the register styled with Tailwind utilities (representative subset),
// including dark: variants (Tailwind 'media' dark mode == prefers-color-scheme, same as our tokens).
// Used only to measure Tailwind's purged-CSS cost for this screen; not wired into the app.
import { formatCents, TXNS } from "../data";

export function RegisterTW() {
  return (
    <main className="mx-auto max-w-3xl p-6 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex flex-wrap items-baseline gap-4 border-b border-gray-200 pb-3 dark:border-gray-700">
        <h1 className="text-2xl font-semibold">Joint Checking</h1>
        <p className="text-gray-500 dark:text-gray-400">Balance: $4,823.10</p>
        <span className="flex-1" />
        <a className="text-blue-700 hover:underline dark:text-blue-300" href="/">
          ← Accounts
        </a>
      </header>
      <form className="my-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
          From date
          <input
            type="date"
            className="rounded border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <input
          type="search"
          placeholder="Search…"
          className="rounded border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </form>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
            <th className="border-b border-gray-200 p-2 dark:border-gray-700">Date</th>
            <th className="border-b border-gray-200 p-2 dark:border-gray-700">Payee</th>
            <th className="border-b border-gray-200 p-2 text-right dark:border-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody>
          {TXNS.map((t) => (
            <tr key={t.id}>
              <td className="border-b border-gray-100 p-2 dark:border-gray-800">{t.occurredOn}</td>
              <td className="border-b border-gray-100 p-2 dark:border-gray-800">{t.payee}</td>
              <td
                className={`border-b border-gray-100 p-2 text-right font-mono dark:border-gray-800 ${
                  t.amountCents < 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"
                }`}
              >
                {formatCents(t.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end gap-2">
        <button className="rounded border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
          Cancel
        </button>
        <button className="rounded bg-blue-700 px-3 py-2 text-white">Save split</button>
      </div>
    </main>
  );
}
