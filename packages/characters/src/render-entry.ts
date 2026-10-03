/* Browser entry for scripts/render-characters.mjs: renders the 12 base characters. */
import { CHARACTERS } from "@orbis/shared";
import { renderThumbnail } from "./thumbnail";

export interface RenderedCharacter {
  id: string;
  portrait: string;
  full: string;
}

declare global {
  interface Window {
    __renderAll?: () => RenderedCharacter[];
  }
}

window.__renderAll = () =>
  CHARACTERS.map((c) => ({
    id: c.id,
    portrait: renderThumbnail(c.config, { type: "image/webp", quality: 0.92 }),
    full: renderThumbnail(c.config, { full: true, type: "image/webp", quality: 0.92 }),
  }));
