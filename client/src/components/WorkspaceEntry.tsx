import { ArrowRight } from "lucide-react";
import styles from "./WorkspaceEntry.module.css";

export function WorkspaceEntry({ signInHref }: { signInHref: string }) {
  return (
    <header className={styles.guest}>
      <div className={`${styles.container} ${styles.guestGrid}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>DreamForgeX Creative Studio</p>
          <h1>
            Make it in <em>Workspace</em>
          </h1>
          <p>
            Create images and video with the model and settings you choose. Sign
            in to generate and find your work again in your history.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href={signInHref}>
              Sign in to Workspace <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className={styles.secondary} href="/demo/text-to-image">
              Try the free image demo
            </a>
          </div>
        </div>
        <figure className={styles.artwork}>
          <img
            src="/showcase/forge-image.webp"
            alt="A figure wearing reflective chrome in dramatic studio lighting"
          />
          <figcaption>Studio example</figcaption>
        </figure>
      </div>
    </header>
  );
}

export function WorkspaceMasthead() {
  return (
    <header className={styles.masthead}>
      <div className={`container ${styles.mastheadInner}`}>
        <div>
          <p className={styles.eyebrow}>Image &amp; video studio</p>
          <h1>Workspace</h1>
          <p>Start with a prompt, then choose how to generate.</p>
        </div>
        <nav className={styles.mastheadLinks} aria-label="Creative resources">
          <a href="/gallery">Browse Gallery</a>
          <a href="/tools">Explore AI Tools</a>
        </nav>
      </div>
    </header>
  );
}
