'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import SetupView from '@/components/SetupView';
import GamingView from '@/components/GamingView';

export default function HomePage() {
  const { state } = useGame();

  return (
    <main className="min-h-screen bg-[#1a1a1a] text-white">
      {state.phase === 'setup' ? <SetupView /> : <GamingView />}
    </main>
  );
}
