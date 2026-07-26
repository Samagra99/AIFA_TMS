import React from 'react';
import { FlightStatusPill } from './Badge';

export function StatusPill({ status }: { status: string }) {
  return <FlightStatusPill status={status} />;
}
