import './globals.css';

export const metadata = {
  title: 'Immersify - Intelligent Audio Companion',
  description:
    'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    url: 'https://immersify.vercel.app/',
    title: 'Immersify - Intelligent Audio Companion',
    description:
      'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
    images: [{ url: 'https://immersify.vercel.app/icon.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Immersify - Intelligent Audio Companion',
    description:
      'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
    images: ['https://immersify.vercel.app/icon.svg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#8a2be2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Howler.js is loaded as an npm package (see engine/Immersify.js) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        {children}
        {/* Toast notification container — rendered at body level so toasts layer over modals */}
        <div id="toastContainer" className="toast-container" aria-live="polite" />
      </body>
    </html>
  );
}
