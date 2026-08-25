import { ArrowLeft, Construction } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ToolStatusPageProps {
  readonly tool: string;
  readonly phase: string;
}

export default function ToolStatusPage({ tool, phase }: ToolStatusPageProps) {
  return (
    <article className="content-page tool-status-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} aria-hidden="true" /> Dashboard
      </Link>
      <div className="content-page__icon" aria-hidden="true">
        <Construction size={24} />
      </div>
      <p className="content-page__phase">{phase}</p>
      <h1>{tool}</h1>
      <p className="content-page__lead">
        This tool is intentionally unavailable until its shared engine dependencies are implemented
        and verified. Pixavelo does not expose placeholder controls as finished functionality.
      </p>
      <div className="notice-panel">
        <strong>Why this is staged</strong>
        <p>
          Each tool will reuse the central validation, codec, worker, memory and export pipeline.
          That prevents format behavior from drifting between screens.
        </p>
      </div>
    </article>
  );
}
