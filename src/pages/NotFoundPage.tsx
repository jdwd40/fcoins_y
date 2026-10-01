import { usePageTitle } from '../hooks/usePageTitle.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { ButtonLink } from '../components/ui/Button.tsx';

export function NotFoundPage() {
  usePageTitle('Not found · Crypto Chaos');
  return (
    <div className="game-shell py-16">
      <EmptyState
        title="This page isn't on the board"
        body="The link may be old or mistyped — the market is one tap away."
        action={
          <ButtonLink to="/" variant="primary">Back to the market</ButtonLink>
        }
      />
    </div>
  );
}
