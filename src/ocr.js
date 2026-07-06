import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Use CDN for the worker to avoid Vite build configuration issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract text from an image data URL using Tesseract.js
 */
export async function extractTextFromImage(dataUrl) {
  try {
    // Tesseract handles data URLs natively
    const result = await Tesseract.recognize(dataUrl, 'eng');
    return result.data.text;
  } catch (error) {
    console.error("OCR Error:", error);
    return "";
  }
}

/**
 * Extract embedded text from a PDF ArrayBuffer
 */
export async function extractTextFromPdf(arrayBuffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";
    
    // Extract from first 3 pages max for speed
    const numPages = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    return "";
  }
}
