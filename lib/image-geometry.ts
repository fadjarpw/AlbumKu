export function fitImageBox(sourceWidth: number, sourceHeight: number, width: number, height: number, fit: string, x: number, y: number) {
  const scale = fit === "contain" ? Math.min(width / sourceWidth, height / sourceHeight) : Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
  return { x: (width - drawWidth) * x / 100, y: (height - drawHeight) * y / 100, width: drawWidth, height: drawHeight };
}
