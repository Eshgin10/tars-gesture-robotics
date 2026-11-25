import { useEffect } from 'react';
import { engine } from './core/engine';
import { useBridge } from './state/store';
import { cx } from './ui/kit';
import { LandingPage } from './ui/LandingPage';
import { SystemPage } from './ui/SystemPage';
import { useKeyboard } from './ui/useKeyboard';
import { Workspace } from './ui/Workspace';

export default function App() {
  const view = useBridge((s) => s.view);
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, []);
  useKeyboard();

  if (view === 'landing') {
    return <LandingPage />;
  }

  // Both views stay mounted: the camera stream, 3-D context and safety logic never pause
  // when the operator opens the System page.
  return (
    <div className="relative h-screen overflow-hidden bg-canvas">
      <div className={cx('h-full', view !== 'workspace' && 'hidden')}>
        <Workspace />
      </div>
      {view === 'system' && (
        <div className="absolute inset-0 bg-canvas">
          <SystemPage />
        </div>
      )}
    </div>
  );
}
