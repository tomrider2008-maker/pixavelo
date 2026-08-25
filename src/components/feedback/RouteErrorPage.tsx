import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function RouteErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'This workspace view could not be opened.';

  return (
    <main className="fatal-error">
      <TriangleAlert size={32} aria-hidden="true" />
      <h1>Unable to open this view</h1>
      <p>{detail}</p>
      <Link className="button button--primary" to="/">
        Go to dashboard
      </Link>
    </main>
  );
}
