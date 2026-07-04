import './globals.css';

export const metadata = {
  title: 'Chai aur Chat — Hitesh & Piyush AI Personas',
  description:
    'Chat with AI personas of Hitesh Choudhary and Piyush Garg, built from their real teaching content.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
