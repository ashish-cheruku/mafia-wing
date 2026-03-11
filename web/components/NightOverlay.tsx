"use client";

interface Props {
  logs: string[];
}

export function NightOverlay({ logs }: Props) {
  return (
    <div className="bg-indigo-950/80 border border-indigo-800 rounded-xl p-4">
      <h3 className="text-indigo-300 font-semibold mb-3 flex items-center gap-2">
        🌙 Night Activity
      </h3>
      {logs.length === 0 ? (
        <p className="text-indigo-400 text-sm italic">Waiting for night actions…</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {logs.map((log, i) => (
            <li key={i} className="text-indigo-200 text-sm">
              {log}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
