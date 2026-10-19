import { useEffect, useState } from "preact/hooks";
import LogoLoop, { type LogoItem } from "./reactbits/LogoLoop";

export interface MarqueeLogo {
  name: string;
  src: string;
  href: string;
}

interface Props {
  logos: MarqueeLogo[];
}

/** A quiet, continuously looping strip of directory logos. */
export default function LogoMarquee({ logos }: Props) {
  const [staticMode, setStaticMode] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 559px)");
    const update = () => setStaticMode(motion.matches || narrow.matches);

    update();
    motion.addEventListener("change", update);
    narrow.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
    };
  }, []);

  const items: LogoItem[] = logos.map((logo) => ({
    src: logo.src,
    alt: logo.name,
    href: logo.href,
    title: logo.name,
  }));

  if (staticMode) {
    return (
      <ul className="logos-grid" aria-label="Tools in the directory">
        {logos.map((logo) => (
          <li key={logo.href}>
            <a
              className="logos-grid__item"
              href={logo.href}
              title={logo.name}
            >
              <img
                src={logo.src}
                alt={logo.name}
                width={22}
                height={22}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <LogoLoop
      logos={items}
      speed={30}
      logoHeight={20}
      gap={0}
      pauseOnHover
      scaleOnHover
      fadeOut={false}
      intro={false}
      draggable={false}
      ariaLabel="Tools in the directory"
    />
  );
}
