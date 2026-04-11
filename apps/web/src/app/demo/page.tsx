"use client";

import { useEffect, useState, useCallback } from "react";
import { usePollar, WalletButton } from "@pollar/react";
import { LiveChat, GiftOverlay } from "@fan-match/live-chat";
import '@pollar/react/styles.css';

type RoomRole = "OWNER" | "MODERATOR" | "VIEWER";

interface RoomMember {
  role: "OWNER" | "MODERATOR";
  user: { id: string; username: string | null; walletAddress: string };
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  recipientWallet: string | null;
  members: RoomMember[];
  _count: { messages: number };
}

// USDC issuer per network — update if needed
const USDC_ISSUER: Record<string, string> = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

export default function DemoPage() {
  const { walletAddress, isAuthenticated, login, getClient, network } = usePollar();
  const [username, setUsername] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [inputName, setInputName] = useState("");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<RoomRole>("VIEWER");
  const [showModPanel, setShowModPanel] = useState(false);
  const [modWallet, setModWallet] = useState("");
  const [addingMod, setAddingMod] = useState(false);
  const [modError, setModError] = useState<string | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Sync user to DB when wallet connects
  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;

    fetch("/api/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    })
      .then((r) => r.json())
      .then((user) => {
        if (user.username) setUsername(user.username);
        else setEditingName(true);
      })
      .catch(console.error);
  }, [isAuthenticated, walletAddress]);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // Load rooms after auth
  useEffect(() => {
    if (!isAuthenticated || !walletAddress || editingName) return;
    void fetchRooms();
  }, [isAuthenticated, walletAddress, editingName, fetchRooms]);

  const handleSaveName = async () => {
    if (!walletAddress || !inputName.trim()) return;
    await fetch("/api/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, username: inputName.trim() }),
    });
    setUsername(inputName.trim());
    setEditingName(false);
  };

  const handleCreateRoom = async () => {
    if (!walletAddress) return;
    setCreatingRoom(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Demo — Partido de Fútbol",
          description: "Sala de demo",
          walletAddress,
        }),
      });
      const room = await res.json();
      await fetchRooms();
      enterRoom(room, "OWNER");
    } finally {
      setCreatingRoom(false);
    }
  };

  const enterRoom = (room: Room, overrideRole?: RoomRole) => {
    let role: RoomRole = "VIEWER";
    if (overrideRole) {
      role = overrideRole;
    } else {
      const membership = room.members.find((m) => m.user.walletAddress === walletAddress);
      if (membership) role = membership.role;
    }
    setActiveRole(role);
    setActiveRoomId(room.id);
    setShowModPanel(false);
    setModError(null);
    // Load members for mod management
    if (role === "OWNER") {
      fetch(`/api/rooms/${room.id}/members`)
        .then((r) => r.json())
        .then(setRoomMembers)
        .catch(console.error);
    }
  };

  const handleAddMod = async () => {
    if (!modWallet.trim() || !walletAddress || !activeRoomId) return;
    setAddingMod(true);
    setModError(null);
    try {
      const res = await fetch(`/api/rooms/${activeRoomId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerWallet: walletAddress, targetWallet: modWallet.trim(), role: "MODERATOR" }),
      });
      const data = await res.json();
      if (!res.ok) { setModError(data.error ?? "Error al agregar moderador"); return; }
      setRoomMembers((prev) => {
        const exists = prev.find((m) => m.user.id === data.user.id);
        return exists ? prev.map((m) => m.user.id === data.user.id ? data : m) : [...prev, data];
      });
      setModWallet("");
    } finally {
      setAddingMod(false);
    }
  };

  const handleRemoveMod = async (memberId: string, userId: string) => {
    if (!walletAddress || !activeRoomId) return;
    const res = await fetch(`/api/rooms/${activeRoomId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerWallet: walletAddress, targetUserId: userId }),
    });
    if (res.ok) setRoomMembers((prev) => prev.filter((m) => m.user.id !== userId));
  };

  const handleBeforeGift = async (
    _giftSlug: string,
    quantity: number,
    priceAmount: string,
    _priceAsset: string
  ): Promise<{ txHash?: string } | false> => {
    const room = rooms.find((r) => r.id === activeRoomId);
    const recipientWallet =
      room?.recipientWallet ??
      room?.members.find((m) => m.role === "OWNER")?.user.walletAddress;

    if (!recipientWallet) {
      console.error("No recipient wallet found for this room");
      return false;
    }

    const amount = (parseFloat(priceAmount) * quantity).toFixed(7);
    const issuer = USDC_ISSUER[network] ?? USDC_ISSUER.testnet;
    const client = getClient();

    try {
      await client.buildTx(
        "payment",
        {
          destination: recipientWallet,
          amount,
          asset: { type: "credit_alphanum4", code: "USDC", issuer },
        },
      );

      const built = client.getTransactionState();
      if (!built || built.step !== "built") return false;

      await client.signAndSubmitTx(built.buildData.unsignedXdr);

      const final = client.getTransactionState();
      if (!final || final.step !== "success") return false;

      return { txHash: final.hash };
    } catch (err) {
      console.error("Payment failed", err);
      return false;
    }
  };

  if (!hydrated) return null;

  // ----- Not connected -----
  if (!isAuthenticated) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fan Match Chat</h1>
          <p className="text-gray-500">Conecta tu wallet para participar</p>
        </div>
        <WalletButton />
        <div className="flex flex-col gap-2">
          <button
            onClick={() => login({ provider: "google" })}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            Conectar con Google
          </button>
          <button
            onClick={() => login({ provider: "github" })}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            Conectar con GitHub
          </button>
        </div>
      </main>
    );
  }

  // ----- Username setup -----
  if (editingName) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-xl font-bold text-gray-900">¿Cómo te llamas?</h2>
        <p className="text-sm text-gray-500">
          Este nombre aparecerá en el chat.{" "}
          <span className="font-mono text-xs text-gray-400">{walletAddress.slice(0, 8)}...</span>
        </p>
        <div className="flex gap-2">
          <input
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            placeholder="Tu alias..."
            maxLength={32}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={handleSaveName}
            disabled={!inputName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
          >
            Guardar
          </button>
        </div>
      </main>
    );
  }

  // ----- Active room / chat -----
  if (activeRoomId) {
    const room = rooms.find((r) => r.id === activeRoomId);
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button
                onClick={() => setActiveRoomId(null)}
                className="text-xs text-indigo-600 hover:underline mb-1 flex items-center gap-1"
              >
                ← Volver a salas
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                ⚽ {room?.name ?? activeRoomId}
              </h1>
              <p className="text-xs text-gray-400 font-mono">Sala: {activeRoomId}</p>
            </div>
            <div className="flex items-center gap-2">
              {activeRole !== "VIEWER" && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  activeRole === "OWNER"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {activeRole === "OWNER" ? "Dueño" : "Moderador"}
                </span>
              )}
              {activeRole === "OWNER" && (
                <button
                  onClick={() => setShowModPanel((v) => !v)}
                  className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-2 py-1 transition-colors"
                  title="Gestionar moderadores"
                >
                  ⚙ Mods
                </button>
              )}
              <span className="text-xs text-gray-500">
                {username || walletAddress.slice(0, 8)}
              </span>
            </div>
          </div>

          {/* Mod management panel — OWNER only */}
          {activeRole === "OWNER" && showModPanel && (
            <div className="mb-3 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">Gestionar moderadores</p>
              <div className="flex gap-2 mb-2">
                <input
                  value={modWallet}
                  onChange={(e) => setModWallet(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMod()}
                  placeholder="Wallet address del moderador"
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={handleAddMod}
                  disabled={addingMod || !modWallet.trim()}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {addingMod ? "…" : "Añadir"}
                </button>
              </div>
              {modError && <p className="text-xs text-red-500 mb-2">{modError}</p>}
              {roomMembers.filter((m) => m.role === "MODERATOR").length > 0 && (
                <ul className="flex flex-col gap-1">
                  {roomMembers.filter((m) => m.role === "MODERATOR").map((m) => (
                    <li key={m.user.id} className="flex items-center justify-between text-xs text-gray-600">
                      <span>{m.user.username ?? m.user.walletAddress.slice(0, 12)}…</span>
                      <button
                        onClick={() => handleRemoveMod(m.user.id, m.user.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {roomMembers.filter((m) => m.role === "MODERATOR").length === 0 && (
                <p className="text-xs text-gray-400">Sin moderadores asignados.</p>
              )}
            </div>
          )}

          <div className="relative">
            <GiftOverlay roomId={activeRoomId} walletAddress={walletAddress} apiBaseUrl="/api" />
            <LiveChat
              roomId={activeRoomId}
              walletAddress={walletAddress}
              username={username}
              role={activeRole}
              apiBaseUrl="/api"
              height={560}
              onBeforeGift={handleBeforeGift}
            />
          </div>
        </div>
      </main>
    );
  }

  // ----- Room list -----
  const myRooms = rooms.filter((r) =>
    r.members.some((m) => m.user.walletAddress === walletAddress)
  );
  const otherRooms = rooms.filter(
    (r) => !r.members.some((m) => m.user.walletAddress === walletAddress)
  );

  return (
    <main className="flex flex-col items-center min-h-screen p-6 gap-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fan Match Chat</h1>
            <p className="text-sm text-gray-500">{username || walletAddress.slice(0, 8)}</p>
          </div>
          <button
            onClick={handleCreateRoom}
            disabled={creatingRoom}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {creatingRoom ? "Creando…" : "+ Nueva sala"}
          </button>
        </div>

        {loadingRooms ? (
          <p className="text-sm text-gray-400 text-center py-12">Cargando salas…</p>
        ) : (
          <>
            {myRooms.length > 0 && (
              <section className="mb-6">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Mis salas
                </h2>
                <div className="flex flex-col gap-2">
                  {myRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      walletAddress={walletAddress}
                      onEnter={() => enterRoom(room)}
                    />
                  ))}
                </div>
              </section>
            )}

            {otherRooms.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Otras salas activas
                </h2>
                <div className="flex flex-col gap-2">
                  {otherRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      walletAddress={walletAddress}
                      onEnter={() => enterRoom(room)}
                    />
                  ))}
                </div>
              </section>
            )}

            {rooms.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm mb-4">No hay salas activas.</p>
                <button
                  onClick={handleCreateRoom}
                  disabled={creatingRoom}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {creatingRoom ? "Creando…" : "Crear sala de demo"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function RoomCard({
  room,
  walletAddress,
  onEnter,
}: {
  room: Room;
  walletAddress: string;
  onEnter: () => void;
}) {
  const membership = room.members.find((m) => m.user.walletAddress === walletAddress);
  const roleLabel = membership?.role === "OWNER"
    ? "Dueño"
    : membership?.role === "MODERATOR"
    ? "Moderador"
    : "Visitante";

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{room.name}</p>
        <p className="text-xs text-gray-400">
          {room._count.messages} mensajes · {roleLabel}
        </p>
      </div>
      <button
        onClick={onEnter}
        className="ml-4 shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
      >
        Entrar
      </button>
    </div>
  );
}
