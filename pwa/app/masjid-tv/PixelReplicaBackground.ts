import { GRAND_REF_00 } from "./grand-ref-00";
import { GRAND_REF_00_TAIL } from "./grand-ref-00-tail";
import { GRAND_BG_1 } from "./grand-bg-1";
import { GRAND_REF_PART_04 } from "./grand-ref-part-04";
import { GRAND_BG_3 } from "./grand-bg-3";

// Exact supplied Grand reference artwork, compressed to WebP for the TV/PWA.
// Kept in small source segments so GitHub/API writes do not truncate the asset.
const GRAND_REFERENCE_BASE64 =
  GRAND_REF_00 +
  GRAND_REF_00_TAIL +
  GRAND_BG_1 +
  GRAND_REF_PART_04 +
  GRAND_BG_3;

export const PIXEL_REPLICA_BG = `data:image/webp;base64,${GRAND_REFERENCE_BASE64}`;
export const PIXEL_REPLICA_BASE64_LENGTH = GRAND_REFERENCE_BASE64.length;
