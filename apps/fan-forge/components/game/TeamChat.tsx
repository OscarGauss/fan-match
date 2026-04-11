export default function TeamChat() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Team chat</p>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-400">Messages will appear here</p>
      </div>
    </div>
  );
}
