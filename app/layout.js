import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'Plan My Wardrobe — Design Your Perfect Wardrobe',
  description: 'Sri Lanka\'s first 3D wardrobe configurator. Design custom wardrobes with real-time 3D preview and instant pricing.',
  openGraph: {
    title: 'Plan My Wardrobe',
    description: 'Design your perfect wardrobe in 3D. Get instant pricing.',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  )
}
