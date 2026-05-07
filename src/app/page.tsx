import Nav from '@/components/Nav';
import Hero from '@/components/landing/Hero';
import DualCTA from '@/components/landing/DualCTA';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <div className="sigil-field" aria-hidden="true" />

      <Nav />
      <Hero />
      <DualCTA />

      <footer className="section-shell relative z-10 pb-10 pt-2">
        <div className="border-t border-earn-gray-900 pt-6 flex justify-between items-center font-mono text-xs uppercase">
          <span>SOLd · Earn</span>
          <span>v0.1 · scaffold</span>
        </div>
      </footer>
    </main>
  );
}
