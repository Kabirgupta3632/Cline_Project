// Layout wrapper for all /donor/* routes: mobile-first max-w-md container
// with the red/white medical theme background. Feature: Donor UI (Person 3).
export default function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-raksha-50">{children}</div>;
}
