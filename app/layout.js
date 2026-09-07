import "./globals.css";

export const metadata = {
  title: "Last One Standing",
  description: "Survivor pool for the group",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
