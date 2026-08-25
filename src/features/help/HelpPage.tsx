import { CircleHelp, Code2, ImageDown, Keyboard, LockKeyhole, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

const topics = [
  {
    title: 'Getting started',
    description:
      'Choose or drop images, review validation results, select an output and process locally.',
    icon: CircleHelp
  },
  {
    title: 'Privacy and security',
    description: 'Understand the local-only processing boundary and browser storage choices.',
    icon: LockKeyhole,
    to: '/privacy'
  },
  {
    title: 'Responsive web assets',
    description: 'Build responsive images, markup, favicons and app icons from a local source.',
    icon: ImageDown,
    to: '/web-assets'
  },
  {
    title: 'Professional utilities',
    description: 'Watermark, extract, encode, hash, package and save utility presets locally.',
    icon: Code2,
    to: '/developer-tools'
  },
  {
    title: 'Offline mode',
    description: 'Previously cached application resources can open without a network connection.',
    icon: WifiOff
  },
  {
    title: 'Keyboard shortcuts',
    description: 'Press Ctrl/Cmd + K to open the command palette. Press Escape to close dialogs.',
    icon: Keyboard
  }
] as const;

export default function HelpPage() {
  return (
    <article className="content-page">
      <h1>Help center</h1>
      <p className="content-page__lead">
        Practical guidance for local image processing and current browser limitations.
      </p>
      <div className="help-topic-list">
        {topics.map((topic) => {
          const Icon = topic.icon;
          const content = (
            <>
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{topic.title}</strong>
                <small>{topic.description}</small>
              </span>
            </>
          );
          return 'to' in topic ? (
            <Link key={topic.title} to={topic.to}>
              {content}
            </Link>
          ) : (
            <section key={topic.title}>{content}</section>
          );
        })}
      </div>
      <div className="notice-panel">
        <strong>Browser limitations</strong>
        <p>
          Native decoding and encoding support varies. Pixavelo reports actual runtime capability
          and does not present an unavailable codec as supported.
        </p>
      </div>
    </article>
  );
}
