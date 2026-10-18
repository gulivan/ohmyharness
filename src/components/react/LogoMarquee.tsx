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
  const items: LogoItem[] = logos.map((logo) => ({
    src: logo.src,
    alt: logo.name,
    href: logo.href,
    title: logo.name,
  }));

  return (
    <LogoLoop
      logos={items}
      speed={46}
      logoHeight={22}
      gap={14}
      pauseOnHover
      scaleOnHover
      fadeOut
      fadeOutWidth={0.08}
      intro={false}
      draggable={false}
      ariaLabel="Tools in the directory"
    />
  );
}
