export const TEMPLATE_DEFAULT = `
/* ── Default (light) ── */

.nr-page {
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.75;
  letter-spacing: 0.05em;
}

/* Cover */
.nr-cover-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  height: 100%;
}

.nr-cover-content h1 {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.25;
  margin: 0;
  color: #1a1a1a;
}

.nr-cover-content p {
  margin: 8px 0;
  color: #1a1a1a;
}

/* Body */
.nr-page-content p {
  margin: 0 0 1.2em 0;
  text-align: justify;
  word-break: break-all;
}

.nr-page-content blockquote {
  border-left: 6px solid #e0e0e0;
  padding: 8px 0 8px 24px;
  margin: 16px 0;
  color: #555;
  font-style: italic;
}

.nr-page-content ul,
.nr-page-content ol {
  padding-left: 40px;
  margin: 0 0 24px 0;
}

.nr-page-content li { margin-bottom: 8px; }

.nr-page-content code {
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.nr-page-content pre {
  background: #f5f5f5;
  padding: 24px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.nr-page-content img,
.nr-page-content .image-embed.image-embed img:not([width]) {
  max-width: 100% !important;
  max-height: none !important;
  height: auto;
  display: block;
  margin: 16px auto;
  border-radius: 8px;
}

.nr-page-content .image-embed,
.nr-page-content .internal-embed {
  display: block;
  width: 100%;
}

.nr-page-content strong { font-weight: 700; }
.nr-page-content em { font-style: italic; }

.nr-oversized {
  display: flex;
  align-items: center;
  justify-content: center;
}
.nr-oversized img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}
`;
