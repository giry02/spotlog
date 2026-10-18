import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import { createPreviewAdminAdapter } from './previewAdapter';
import { activatePreviewDraftStorage } from './previewDraftStorage';
import './admin.css';

activatePreviewDraftStorage();
const adapter = createPreviewAdminAdapter(undefined, import.meta.env.BASE_URL);
createRoot(document.getElementById('admin-root')!).render(<StrictMode><AdminApp previewAdapter={adapter}/></StrictMode>);
