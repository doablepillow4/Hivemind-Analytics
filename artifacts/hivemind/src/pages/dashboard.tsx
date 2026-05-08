import React from 'react';
import { MarketOverview } from '../components/dashboard/MarketOverview';
import { QuickActions } from '../components/dashboard/QuickActions';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-up">
      <DashboardHeader />
      <MarketOverview />
      <QuickActions />
    </div>
  );
}
