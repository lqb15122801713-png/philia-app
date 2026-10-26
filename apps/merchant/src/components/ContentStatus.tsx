import type { ReactNode } from 'react';
import { QuietButton } from './MainScaffold';

export function LoadingPanel({
  title,
  body,
  onRetry,
  testid,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  testid: string;
}) {
  return (
    <section
      className="u3-panel px-[17px] py-12 text-center"
      role="status"
      aria-busy="true"
      data-testid={testid}
    >
      <h2 className="text-body-sm font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-caption leading-6 text-ink-secondary">{body}</p>
      {onRetry ? (
        <div className="mt-5 flex justify-center">
          <QuietButton testid={`${testid}-retry`} onClick={onRetry}>
            重新加载
          </QuietButton>
        </div>
      ) : null}
    </section>
  );
}

export function LoadingNotice({ children, testid }: { children: ReactNode; testid: string }) {
  return (
    <div
      className="mb-3.5 rounded-control border border-line bg-card px-4 py-3 text-caption text-ink-secondary"
      role="status"
      data-testid={testid}
    >
      {children}
    </div>
  );
}
