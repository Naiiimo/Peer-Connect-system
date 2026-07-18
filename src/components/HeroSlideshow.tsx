import { useEffect, useState, type ReactNode } from "react";
import slideLecture from "@/assets/slide-lecture.jpg";
import slideLibrary from "@/assets/slide-library.jpg";
import slidePeers from "@/assets/slide-peers.jpg";

const SLIDES = [
  { src: slideLecture, alt: "Students taking notes in a lecture" },
  { src: slideLibrary, alt: "A student walking through library book stacks" },
  { src: slidePeers, alt: "Two peers studying together at a table" },
];

const INTERVAL = 4000;

export function HeroSlideshow({ children }: { children: ReactNode }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative isolate overflow-hidden">
      {/* Slides */}
      <div className="absolute inset-0" aria-hidden="true">
        {SLIDES.map((s, idx) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              idx === i ? "opacity-100" : "opacity-0"
            }`}
            loading={idx === 0 ? "eager" : "lazy"}
          />
        ))}
        {/* Legibility overlay */}
        <div className="absolute inset-0 gradient-hero opacity-85 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center md:py-28">
        {children}
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Show slide ${idx + 1}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${
              idx === i ? "w-8 bg-accent" : "w-4 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
