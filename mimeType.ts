export function mimeTypeFromBase64(base64: string) {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("R0lGODlh")) return "image/gif";
  if (base64.startsWith("UklGRg")) return "image/webp";
  throw new Error("Unknown image type");
}

export function extFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  throw new Error("Unknown image type");
}
