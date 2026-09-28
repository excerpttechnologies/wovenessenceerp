'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import ChatBot, { ChatBotProvider } from '@/components/ChatBot';
import { ScopeProvider } from '@/components/ScopeContext';
import { disableSelectScroll } from '@/lib/disableSelectScroll';

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  /* Every <select> in every module - purchase, sales, inventory, contacts,
     transportation, logistics, masters - mounts somewhere under here, so one
     listener at this root covers all of them without touching a single form
     file. See lib/disableSelectScroll.js. */
  useEffect(() => disableSelectScroll(), []);

  return (
    <ScopeProvider>
     <ChatBotProvider>
      <div className="flex min-h-screen">
        <Sidebar collapsed={collapsed} />
        <div className={'min-w-0 flex-1 ' + (collapsed ? 'ml-0' : 'ml-sidebar')}>
          <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
          <main className="px-5 pb-14 pt-4">{children}</main>
        </div>
      </div>

      {/* Signed-in screens only - deliberately not in the root layout, so it
          stays off the marketing landing page and /login. Mounted here rather
          than per-page so its transcript survives navigation between screens. */}
      <ChatBot />
     </ChatBotProvider>
    </ScopeProvider>
  );
}
