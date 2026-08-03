import "./globals.css";

export const metadata = {
  title: "Constellation — Smartcat onboarding",
  description: "Customer-facing onboarding journeys, in the platform instead of a spreadsheet.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
