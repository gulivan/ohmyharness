import LetterGlitch from "./reactbits/LetterGlitch";

/**
 * Decorative letter field behind the hero. WebGL-backed and fully
 * non-interactive; it freezes under prefers-reduced-motion and stops drawing
 * while offscreen (handled by the component).
 */
export default function HeroGlitch() {
  return (
    <div className="hero__glitch" aria-hidden="true">
      <LetterGlitch
        characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\_+-=<>[]{}#$%&*()"
        baseColor="#8f8b80"
        glitchColors={["#d7ff3f", "#a5a29a", "#43434a"]}
        fontSize={13}
        spacing={0.62}
        density={0.5}
        baseOpacity={0.22}
        glitchAmount={0.3}
        speed={0.55}
        smooth
        interactive={false}
        clickEffect="none"
        flow={0.3}
        edgeFade={0.16}
        centerFade={0.55}
        intro
      />
    </div>
  );
}
