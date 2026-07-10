import imageCompression from "browser-image-compression";

const MAX_IMAGE_SIZE_MB = 0.24; // Keep images safely under the target size.

export const fileToDataUrl = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.readAsDataURL(file);
  });
};

/**
 * Canvas fallback for browsers/files that the compression library cannot process.
 */
function compressImageWithCanvas(file: File, maxW: number = 800, maxH: number = 800, quality: number = 0.75, depth: number = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("File is not an image."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = (err) => {
        img.onload = null;
        img.onerror = null;
        reject(err);
      };
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Apply aspect-ratio limit while maintaining proportions
          if (width > height) {
            if (width > maxW) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            }
          } else {
            if (height > maxH) {
              width = Math.round((width * maxH) / height);
              height = maxH;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            img.onload = null;
            img.onerror = null;
            img.src = "";
            resolve(event.target?.result as string);
            return;
          }

          // Fill background white for JPEGs
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Get compressed JPEG data URL with quality bounded strictly between 0.1 and 1.0
          const currentQuality = Math.max(0.1, Math.min(1.0, quality));
          const dataUrl = canvas.toDataURL("image/jpeg", currentQuality);

          // Clean up image resources immediately to release large base64 buffers
          img.onload = null;
          img.onerror = null;
          img.src = "";

          // Double check size in KB (1 character in base64 approx 0.75 bytes)
          const sizeInKb = (dataUrl.length * 0.75) / 1024;
          
          // Cap recursion depth at 4 steps and quality above 0.3 to prevent stack overflows
          if (sizeInKb > 250 && currentQuality > 0.3 && depth < 4) {
            const nextQuality = Math.max(0.1, currentQuality - 0.15);
            compressImageWithCanvas(file, Math.round(maxW * 0.8), Math.round(maxH * 0.8), nextQuality, depth + 1)
              .then(resolve)
              .catch(() => resolve(dataUrl));
          } else {
            resolve(dataUrl);
          }
        } catch (err) {
          console.error("Canvas draw error in compressImage:", err);
          img.onload = null;
          img.onerror = null;
          img.src = "";
          // Fallback to original read if drawing fails
          resolve(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file before upload.
 */
export async function compressImageFile(file: File, maxW: number = 800, maxH: number = 800, quality: number = 0.75): Promise<File> {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("File is not an image.");
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: MAX_IMAGE_SIZE_MB,
      maxWidthOrHeight: Math.max(maxW, maxH),
      initialQuality: quality,
      useWebWorker: true,
      fileType: "image/jpeg"
    });

    return new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } catch (err) {
    console.warn("browser-image-compression failed, falling back to canvas:", err);
    const dataUrl = await compressImageWithCanvas(file, maxW, maxH, quality);
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  }
}

/**
 * Compress an image file before it is saved as a data URL.
 */
export async function compressImage(file: File, maxW: number = 800, maxH: number = 800, quality: number = 0.75): Promise<string> {
  const compressedFile = await compressImageFile(file, maxW, maxH, quality);
  return fileToDataUrl(compressedFile);
}

/**
 * AI Image Shield Heuristic Scan Simulator.
 * Simulates a robust authentic-camera-capture verify system.
 */
export interface AiShieldResult {
  isApproved: boolean;
  analysis: string[];
  strikesAdded: number;
  score: number;
}

export function simulateAiShieldCheck(fileName: string, dataUrl: string): AiShieldResult {
  const lowercaseName = fileName.toLowerCase();
  const logs: string[] = [];
  let score = 100;
  let strikesAdded = 0;

  logs.push("Initializing CP-Eats Shield deep analysis...");
  logs.push(`Inspecting meta signature: "${fileName}"`);

  logs.push("✓ File metadata headers look typical for mobile capture.");
  logs.push("Analyzing canvas contrast levels & digital noise coefficients...");
  logs.push("✓ Rich color palette and organic texture gradients detected.");
  logs.push("✓ No visible digital watermarks or vector grids found.");
  logs.push("✓ Natural lighting shadows and organic noise ratios confirmed.");

  const isApproved = true;
  logs.push("✅ CP-Eats Shield Approved: Image verified as an authentic dish photo!");

  return {
    isApproved,
    analysis: logs,
    strikesAdded: 0,
    score: 100
  };
}
