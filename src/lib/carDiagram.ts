import sharp from "sharp";

const SLATE = { r: 100, g: 116, b: 139 }; // #64748B

/** Recolor line-art diagram to slate strokes on a white background. */
export async function processCarDiagramPng(bytes: Uint8Array): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = (r + g + b) / 3;

    if (luminance < 235) {
      const strength = Math.min(1, (255 - luminance) / 120);
      data[i] = Math.round(255 - (255 - SLATE.r) * strength);
      data[i + 1] = Math.round(255 - (255 - SLATE.g) * strength);
      data[i + 2] = Math.round(255 - (255 - SLATE.b) * strength);
      if (info.channels === 4) {
        data[i + 3] = Math.round(255 * strength);
      }
    } else {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      if (info.channels === 4) {
        data[i + 3] = 255;
      }
    }
  }

  return new Uint8Array(
    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .rotate(90)
      .png()
      .toBuffer()
  );
}

export function fitImageDimensions(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspect = imageWidth / imageHeight;
  let drawWidth = maxWidth;
  let drawHeight = drawWidth / aspect;

  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * aspect;
  }

  return { width: drawWidth, height: drawHeight };
}
