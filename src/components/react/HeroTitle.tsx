import DecryptedText from "./reactbits/DecryptedText";

interface Props {
  first: string;
  second: string;
}

/**
 * The hero headline. Both words are server-rendered; only the accent line
 * decrypts, once, when it scrolls into view. One moving element is enough.
 */
export default function HeroTitle({ first, second }: Props) {
  return (
    <>
      <span className="display__line">{first}</span>
      <br />
      <span className="display__line display__accent">
        <DecryptedText
          text={second}
          animateOn="view"
          preserveInitialText
          sequential
          revealDirection="start"
          speed={34}
          maxIterations={8}
        />
      </span>
    </>
  );
}
