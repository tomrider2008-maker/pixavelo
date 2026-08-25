import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <article className="content-page tool-status-page">
      <p className="content-page__phase">404</p>
      <h1>That workspace does not exist</h1>
      <p className="content-page__lead">
        The address may be outdated or the tool has not been introduced.
      </p>
      <Link className="button button--primary button--inline" to="/">
        <ArrowLeft size={16} aria-hidden="true" /> Go to dashboard
      </Link>
    </article>
  );
}
