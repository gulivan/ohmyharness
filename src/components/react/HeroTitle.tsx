import DecryptedText from "./reactbits/DecryptedText";

interface Props {
  first: string;
  second: string;
}

/**
 * The hero headline. The real words are server-rendered, then each line
 * decrypts once when it scrolls into view.
 */
export default function HeroTitle({ first, second }: Props) {
  return (
    <>
      <span className="display__line">
        <DecryptedText
          text={first}
          animateOn="view"
          preserveInitialText
          sequential
          revealDirection="start"
          speed={38}
          maxIterations={7}
        />
      </span>
      <br />
      <span className="display__line display__accent">
        <DecryptedText
          text={second}
          animateOn="view"
          preserveInitialText
          sequential
          revealDirection="end"
          speed={34}
          maxIterations={9}
        />
      </span>
    </>
  );
}
