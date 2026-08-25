export const en = {
  app: {
    name: 'Pixavelo',
    descriptor: 'Private Image Processing Studio',
    tagline: 'Powerful image tools. Completely private.',
    introduction: 'Convert, compress, resize and batch-process images directly in your browser.',
    privacyLine: 'No uploads • No account • Local processing'
  },
  actions: {
    chooseImages: 'Choose Images',
    dropAnywhere: 'Drop files anywhere',
    search: 'Search tools and actions',
    close: 'Close',
    tryAgain: 'Try again',
    goHome: 'Go to dashboard'
  },
  status: {
    localProcessing: 'Local processing',
    ready: 'Ready',
    offlineCapable: 'Offline capable',
    filesQueued: '0 files queued'
  },
  dashboard: {
    dropTitle: 'Drop images here',
    dropHint: 'or click Choose Images to get started',
    mobileDropHint: 'or tap Choose Images to get started',
    workflowTitle: 'Start a workflow',
    quickActionsTitle: 'Quick actions',
    recentTitle: 'Recent jobs (local)',
    recentEmpty: 'No recent jobs on this device',
    recentNote: 'Job history stays on your device and never leaves your browser.'
  }
} as const;

export type AppMessages = typeof en;
