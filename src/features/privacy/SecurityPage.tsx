import { LockKeyhole } from 'lucide-react';

export default function SecurityPage() {
  return (
    <article className="content-page">
      <div className="content-page__icon" aria-hidden="true">
        <LockKeyhole size={24} />
      </div>
      <h1>Security design</h1>
      <p className="content-page__lead">
        File validation, isolated processing and restrictive hosting headers protect the local
        workflow.
      </p>
      <section className="prose-section">
        <h2>Browser boundary</h2>
        <p>
          Files are validated by signature and decoder behavior instead of extension alone.
          CPU-intensive processing prefers an isolated typed worker protocol. Browsers without the
          required worker encoder use a sequential native-canvas fallback with the same validation
          and no network processing.
        </p>
        <h2>Hosted application</h2>
        <p>
          Cloudflare Pages serves static assets with a restrictive Content Security Policy, disabled
          framing, no-referrer behavior and locked-down browser permissions.
        </p>
        <h2>SVG and metadata</h2>
        <p>
          SVG is parsed as XML before decoding. Scripts, event handlers, external resources, foreign
          HTML, embedded style and animation elements are rejected; accepted SVG is serialized into
          a new local Blob and is never inserted into the document. Metadata removal is shown only
          after the exported container is inspected again and every selected category is confirmed
          absent.
        </p>
        <h2>Resource budgets</h2>
        <p>
          Collection intake, validation concurrency, decoded pixels, frame extraction, retained
          metadata, encoded output and ZIP construction all have explicit limits. Oversized or
          corrupt work is isolated and reported without discarding the rest of a queue.
        </p>
        <h2>Imported local settings</h2>
        <p>
          Utility presets and saved batch recipes are treated as untrusted input. Version, size,
          enum, range, text and color checks run before imported values can change the interface or
          reach a processor.
        </p>
        <h2>Reporting a vulnerability</h2>
        <p>
          Use the repository security policy and avoid attaching private image samples to a public
          issue.
        </p>
      </section>
    </article>
  );
}
