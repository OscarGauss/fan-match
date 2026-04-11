// Components
export { LiveChat } from "./components/LiveChat";
export { GiftOverlay } from "./components/GiftOverlay";

// Hooks (for custom integrations)
export { useLiveChat } from "./hooks/useLiveChat";
export { useSlowMode } from "./hooks/useSlowMode";
export { useGiftOverlay } from "./hooks/useGiftOverlay";

// Types
export type {
  LiveChatProps,
  GiftOverlayProps,
  ChatMessage,
  ChatUser,
  GiftDefinition,
  GiftEvent,
  RoomRole,
  AblyEvent,
} from "./types";
