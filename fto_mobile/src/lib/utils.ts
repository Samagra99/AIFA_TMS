import { colors } from '../theme/colors';

// React Native wrapper for utilities matching web tailwind logic
export const fmt = {
  date: (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },
  
  time: (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  datetime: (dateString: string | null): string => {
    if (!dateString) return '-';
    return `${fmt.date(dateString)} ${fmt.time(dateString)}`;
  },
  
  fromNow: (dateString: string | null): string => {
    if (!dateString) return '-';
    // Simplified version - in production use dayjs or date-fns
    return fmt.date(dateString);
  },
  
  hobbs: (value: number | null): string => {
    if (value === null || value === undefined) return '0.0';
    return value.toFixed(1);
  },
  
  hours: (minutes: number | null): string => {
    if (!minutes) return '0:00';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}:${mins.toString().padStart(2, '0')}`;
  },
  
  inr: (value: number | null): string => {
    if (value === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  }
};

export const flightTypeBadge = (type: string, isDark: boolean = false) => {
  const p = isDark ? colors.dark : colors.light;
  switch(type) {
    case 'training': return { backgroundColor: p.primaryLight, color: p.primaryDark };
    case 'solo': return { backgroundColor: p.successLight, color: p.success };
    case 'ferry': return { backgroundColor: p.warningLight, color: p.ferryDark };
    default: return { backgroundColor: p.surfaceSecondary, color: p.text };
  }
};

export const statusColor = (status: string, isDark: boolean = false) => {
  const p = isDark ? colors.dark : colors.light;
  switch(status) {
    case 'scheduled': return { color: p.primary };
    case 'dispatched': return { color: p.warning };
    case 'completed': return { color: p.success };
    case 'cancelled': return { color: p.danger };
    default: return { color: p.textSecondary };
  }
};

export const aircraftStatusColor = (status: string, isDark: boolean = false) => {
  const p = isDark ? colors.dark : colors.light;
  switch(status) {
    case 'serviceable': return { color: p.success };
    case 'aog': return { color: p.aog };
    case 'maintenance': return { color: p.warning };
    default: return { color: p.textSecondary };
  }
};

export const roleName = (role: string): string => {
  const names: Record<string, string> = {
    'admin': 'Administrator',
    'instructor': 'Flight Instructor',
    'student': 'Student Pilot',
    'dispatch': 'Dispatcher',
    'maintenance': 'Maintenance',
  };
  return names[role] || role;
};
