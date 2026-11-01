// Requested only by the localhost middleware; never imported by a public route.
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/print.css';
import '../styles/sermons.css';
import './sermon-preview.css';
import { initPreviewControls } from './preview-controls';

const cleanup = initPreviewControls(document);
if (import.meta.hot) import.meta.hot.dispose(cleanup);
