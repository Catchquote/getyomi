export function getChartTheme(theme) {
  const dark = theme === 'dark';
  return {
    grid:    dark ? '#2A2D3A' : '#E5E7EB',
    axis:    dark ? '#475569' : '#9CA3AF',
    tooltip: {
      background: dark ? '#1A1D27' : '#FFFFFF',
      border:     dark ? '#2A2D3A' : '#E5E7EB',
      color:      dark ? '#F1F5F9' : '#0F172A',
    },
    win:     '#1D9E75',
    loss:    '#E24B4A',
    warn:    '#BA7517',
    blue:    '#6366F1',
    purple:  '#A78BFA',
  };
}
