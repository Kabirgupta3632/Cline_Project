// Landing page: "Login as" role switcher entry point (no real auth system).
// Shared infra - links into /hospital, /donor, /demo feature areas.
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-raksha-50 to-white flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-raksha-600 text-3xl text-white shadow-card">
          🩸
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-raksha-700">
          RakshaRakt
        </h1>
        <p className="mt-2 text-base text-gray-600">
          Emergency blood donation network — hospitals broadcast, nearby
          donors respond in minutes.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <RoleCard
            href="/hospital"
            emoji="🏥"
            title="Hospital"
            desc="Raise an SOS, check inventory mesh, track donors."
          />
          <RoleCard
            href="/donor"
            emoji="🦸"
            title="Donor"
            desc="Respond to SOS alerts, earn Hero Points."
          />
          <RoleCard
            href="/demo"
            emoji="🎬"
            title="Demo Panel"
            desc="Judge / operator controls for the live demo."
          />
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Hackathon MVP — no real authentication. Choose a role above to
          continue as a seeded hospital or donor.
        </p>
      </div>
    </main>
  );
}

function RoleCard({
  href,
  emoji,
  title,
  desc,
}: {
  href: string;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-xl border border-raksha-100 bg-white p-6 shadow-card transition hover:border-raksha-400 hover:shadow-lg"
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-lg font-semibold text-raksha-700 group-hover:text-raksha-800">
        {title}
      </span>
      <span className="text-sm text-gray-500">{desc}</span>
    </Link>
  );
}
