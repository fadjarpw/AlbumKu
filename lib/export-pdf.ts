import type { PhotoAdjustments } from "./album";
import { createPhotoAdjustmentFilter } from "./album";
import { fitImageBox } from "./image-geometry";

export async function capturePage(element: HTMLElement, width: number, height: number, scale: number, adjustments: PhotoAdjustments, background: string) {
  const { default: html2canvas } = await import("html2canvas");
  const replacements: { image: HTMLImageElement; canvas: HTMLCanvasElement }[] = [];
  const previousStyle = element.getAttribute("style");
  const parent = element.parentNode;
  const next = element.nextSibling;
  try {
    document.body.append(element);
    element.style.setProperty("--capture-width", `${width}px`);
    element.style.setProperty("--capture-height", `${height}px`);
    element.classList.add("pdf-capture");
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    for (const image of element.querySelectorAll<HTMLImageElement>("img[data-photo-url]")) {
      const style = getComputedStyle(image);
      if (style.display === "none" || image.offsetWidth === 0 || image.offsetHeight === 0) continue;
      await image.decode();
      if (!image.naturalWidth) throw new Error(`Foto ${image.alt} tidak dapat dibaca.`);
      const canvas = document.createElement("canvas");
      const boxWidth = image.offsetWidth, boxHeight = image.offsetHeight;
      canvas.width = Math.max(1, Math.round(boxWidth * scale));
      canvas.height = Math.max(1, Math.round(boxHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser tidak dapat merender foto.");
      context.scale(canvas.width / boxWidth, canvas.height / boxHeight);
      context.imageSmoothingQuality = "high";
      context.filter = createPhotoAdjustmentFilter(adjustments);
      const positions = style.objectPosition.split(" ").map(parseFloat);
      const box = fitImageBox(image.naturalWidth, image.naturalHeight, boxWidth, boxHeight, style.objectFit, positions[0] ?? 50, positions[1] ?? 50);
      context.drawImage(image, box.x, box.y, box.width, box.height);
      canvas.className = image.className;
      canvas.style.cssText = image.style.cssText;
      canvas.style.width = `${boxWidth}px`;
      canvas.style.height = `${boxHeight}px`;
      canvas.style.display = "block";
      canvas.style.filter = "none";
      canvas.style.transform = style.transform;
      canvas.style.transformOrigin = style.transformOrigin;
      image.replaceWith(canvas);
      replacements.push({ image, canvas });
    }
    // Kanvas berisi piksel foto SEBELUM DOM disalin, tidak mengganti src pada onclone.
    return await html2canvas(element, {
      scale, logging: false, backgroundColor: background, width, height,
      windowWidth: window.innerWidth, windowHeight: window.innerHeight,
      onclone: (_document, clone) => clone.querySelectorAll(".photo-slot.selected").forEach((slot) => slot.classList.remove("selected")),
    });
  } finally {
    replacements.forEach(({ image, canvas }) => canvas.replaceWith(image));
    element.classList.remove("pdf-capture");
    if (previousStyle === null) element.removeAttribute("style"); else element.setAttribute("style", previousStyle);
    if (parent) parent.insertBefore(element, next);
  }
}
