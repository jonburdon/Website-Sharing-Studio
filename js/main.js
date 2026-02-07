/**
 * Website Sharing Studio - Main JavaScript
 * Phase 1: QR Code Generator
 *
 * Handles:
 * - URL format validation
 * - TLD typo suggestions
 * - QR code generation via api.qrserver.com
 * - Download setup (blob for CORS, fallback to direct link)
 */

/* ==========================================================================
   DOM References
   ========================================================================== */

const form = document.getElementById('qr-form');
const urlInput = document.getElementById('url-input');
const urlFeedback = document.getElementById('url-feedback');
const formatRadios = document.querySelectorAll('input[name="format"]');
const qrOutput = document.getElementById('qr-output');
const qrImage = document.getElementById('qr-image');
const downloadBtn = document.getElementById('download-btn');

/* ==========================================================================
   URL Validation - Format Check
   ========================================================================== */

/**
 * Checks if a string is a valid http(s) URL.
 * Uses the URL constructor for proper parsing.
 * @param {string} string - The URL string to validate
 * @returns {boolean} - True if valid http or https URL
 */
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ==========================================================================
   TLD Typo Suggestions
   ========================================================================== */

// Recognised TLDs - no suggestion needed if user's TLD is in this list
const COMMON_TLDS = [
  'com', 'org', 'net', 'io', 'co', 'uk', 'edu', 'gov',
  'info', 'biz', 'me', 'app', 'dev'
];

// Map of common typos -> suggested correct TLD
// e.g. 'vom' -> 'com' (user typed .vom instead of .com)
const TLD_TYPO_SUGGESTIONS = {
  vom: 'com', ocm: 'com', con: 'com', comn: 'com', oc: 'com', cpm: 'com',
  or: 'org', orgr: 'org', ogr: 'org',
  netw: 'net', nte: 'net',
  oi: 'io',
  coo: 'co',
};

/**
 * Checks if the URL's TLD looks like a typo and suggests a correction.
 * Does not block - suggestions only. User's URL is always used for the QR.
 * @param {string} urlString - The URL to check
 * @returns {string|null} - Suggested TLD (e.g. 'com') or null if no suggestion
 */
function getTldSuggestion(urlString) {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase();
    const parts = hostname.split('.');
    const tld = parts[parts.length - 1];

    // No suggestion if TLD is already recognised
    if (COMMON_TLDS.includes(tld)) return null;

    // Return suggestion if we have one for this typo
    return TLD_TYPO_SUGGESTIONS[tld] || null;
  } catch {
    return null;
  }
}

/* ==========================================================================
   QR Code Generation
   ========================================================================== */

/**
 * Builds the QR Server API URL for a given URL and format.
 * api.qrserver.com supports PNG (raster) and SVG (vector).
 * @param {string} url - The URL to encode in the QR code
 * @param {string} format - 'png' or 'svg'
 * @returns {string} - Full API URL that returns the QR image
 */
function generateQrImageUrl(url, format = 'png') {
  const encoded = encodeURIComponent(url);
  const size = format === 'svg' ? '' : 'size=300x300'; // SVG is scalable, size not needed
  const formatParam = format === 'svg' ? 'format=svg' : '';
  const params = [size, formatParam].filter(Boolean).join('&');
  return `https://api.qrserver.com/v1/create-qr-code/?${params}&data=${encoded}`;
}

/**
 * Sets up the download button to save the QR image.
 * Tries blob + object URL first (works when CORS allows).
 * Falls back to direct link if fetch fails.
 * @param {string} qrUrl - The QR image URL
 * @param {string} filename - Suggested download filename
 */
async function setupDownload(qrUrl, filename) {
  // Reset any previous setup
  downloadBtn.removeAttribute('target');
  downloadBtn.onclick = null;

  try {
    const res = await fetch(qrUrl, { mode: 'cors' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    downloadBtn.href = blobUrl;
    downloadBtn.download = filename;
    downloadBtn.onclick = () => setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch {
    // Fallback: direct link (may open in new tab if CORS blocks download)
    downloadBtn.href = qrUrl;
    downloadBtn.download = filename;
  }
}

/* ==========================================================================
   UI Helpers
   ========================================================================== */

/**
 * Updates the feedback message below the URL input.
 * @param {string} message - The message to show
 * @param {boolean} isError - If true, uses error styling (red)
 */
function setFeedback(message, isError = false) {
  urlFeedback.textContent = message;
  urlFeedback.className = 'mt-2 text-sm min-h-[1.25rem] ' + (isError ? 'text-red-600' : 'text-forest-light');
}

/**
 * Builds a safe filename for the QR download based on the URL hostname and format.
 * e.g. google.com, png -> qrcode-google-com.png
 * @param {string} url - The URL (used for hostname)
 * @param {string} format - 'png' or 'svg' (determines extension)
 */
function getDownloadFilename(url, format = 'png') {
  const hostname = new URL(url).hostname.replace(/\./g, '-');
  const ext = format === 'svg' ? 'svg' : 'png';
  return `qrcode-${hostname}.${ext}`;
}

/**
 * Returns the currently selected format (png or svg).
 */
function getSelectedFormat() {
  const selected = document.querySelector('input[name="format"]:checked');
  return selected ? selected.value : 'png';
}

/* ==========================================================================
   Form Submit Handler
   ========================================================================== */

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = urlInput.value.trim();

  // Empty check
  if (!url) {
    setFeedback('Please enter a URL.', true);
    return;
  }

  // Format validation - must be valid http(s) URL
  if (!isValidUrl(url)) {
    setFeedback('Please enter a valid URL (e.g. https://example.com)', true);
    return;
  }

  // Show TLD suggestion if we think they made a typo (does not block)
  const tldSuggestion = getTldSuggestion(url);
  if (tldSuggestion) {
    setFeedback(`URL format valid. Did you mean .${tldSuggestion} instead? (QR will use what you entered.)`);
  } else {
    setFeedback('URL format valid ✓');
  }

  // Generate and display QR code (use selected format: PNG or SVG)
  const format = getSelectedFormat();
  const qrUrl = generateQrImageUrl(url, format);
  qrImage.src = qrUrl;
  qrImage.alt = `QR code for ${url}`;

  await setupDownload(qrUrl, getDownloadFilename(url, format));
  downloadBtn.textContent = `Download ${format.toUpperCase()}`;

  qrOutput.classList.remove('hidden');
  qrOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* ==========================================================================
   Format change: regenerate QR if one is already displayed
   ========================================================================== */

formatRadios.forEach((radio) => {
  radio.addEventListener('change', async () => {
    // Only regenerate if a QR is already displayed
    if (qrOutput.classList.contains('hidden')) return;

    const url = urlInput.value.trim();
    if (!url || !isValidUrl(url)) return;

    const format = getSelectedFormat();
    const qrUrl = generateQrImageUrl(url, format);
    qrImage.src = qrUrl;
    await setupDownload(qrUrl, getDownloadFilename(url, format));
    downloadBtn.textContent = `Download ${format.toUpperCase()}`;
  });
});
