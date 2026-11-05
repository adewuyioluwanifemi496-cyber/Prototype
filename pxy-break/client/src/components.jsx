import React from 'react';

export function Field({ label, error, hint, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}

export const Sev = ({ value }) => (value ? <span className={`badge sev-${value.toLowerCase()}`}>{value}</span> : <span className="muted">-</span>);

export const Result = ({ value }) => <span className={`badge ${value === 'Passed' ? 'res-pass' : 'res-fail'}`}>{value}</span>;

export const Status = ({ value }) => (value ? <span className={`badge st-${value.toLowerCase().replace(' ', '-')}`}>{value}</span> : <span className="muted">-</span>);

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function Wordmark({ light }) {
  return (
    <span className={`wordmark ${light ? 'on-dark' : ''}`} aria-label="PXY-Break">
      PXY<i className="crack" aria-hidden="true" />Break
    </span>
  );
}
