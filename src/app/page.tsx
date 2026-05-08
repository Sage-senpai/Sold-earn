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
        <div className="border-t border-earn-gray-900 pt-6 flex flex-wrap justify-between items-center gap-2 font-mono text-[10px] sm:text-xs uppercase">
          <span>SOLd · Earn</span>
          <span className="text-earn-gray-600">A bounty arm of the SOLd. protocol</span>
          <span>v0.1 · scaffold</span>
        </div>
      </footer>
    </main>
  );
}
