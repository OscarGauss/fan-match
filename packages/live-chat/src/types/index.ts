export interface ChatUser {
  id: string;
  username: string | null;
  walletAddress: string;
  avatarColor: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  user: ChatUser;
  roomId: string;
  createdAt: string;
  isDeleted?: boolean;
}

export interface GiftDefinition {
  slug: string;
  emoji: string;
  label: string;
  priceAmount: string;
  priceAsset: string;
}

export interface GiftEvent {
  id: string;
  giftSlug: string;
  emoji: string;
  label: string;
  quantity: number;
  user: ChatUser;
  createdAt: string;
}

export type RoomRole = "OWNER" | "MODERATOR" | "VIEWER";

export interface LiveChatProps {
  /** Room identifier */
  roomId: string;
  /** Pollar wallet address of the current user */
  walletAddress: string;
  /** Display name shown in the chat */
  username?: string;
  /** Role of the current user in this room */
  role?: RoomRole;
  /** Base URL for API routes, e.g. "/api" or "https://myapp.com/api" */
  apiBaseUrl?: string;
  /** Height of the chat container in pixels */
  height?: number;
  /** Additional CSS class names */
  className?: string;
  /**
   * Called before sending a gift. Implement here the Pollar payment flow.
   * Return `{ txHash }` on success, or `false` to cancel the gift.
   */
  onBeforeGift?: (
    giftSlug: string,
    quantity: number,
    priceAmount: string,
    priceAsset: string
  ) => Promise<{ txHash?: string } | false>;
}

export interface GiftOverlayProps {
  /** Room identifier — used to subscribe to the correct Ably channel */
  roomId: string;
  /** Base URL for API routes */
  apiBaseUrl?: string;
  /** Wallet address of the current user (needed for Ably token auth) */
  walletAddress: string;
}

export type AblyEvent =
  | { name: "message.new"; data: ChatMessage }
  | { name: "message.deleted"; data: { messageId: string } }
  | { name: "gift.sent"; data: GiftEvent }
  | { name: "user.banned"; data: { userId: string } }
  | { name: "room.updated"; data: { slowModeSeconds: number } };
