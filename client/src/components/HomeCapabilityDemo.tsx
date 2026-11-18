"use client";

import {
  ArrowUpRight,
  Maximize2,
  MoveHorizontal,
  Palette,
  Scissors,
} from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Link } from "wouter";
import styles from "./HomeCapabilityDemo.module.css";

const examples = [
  {
    id: "restyle",
    name: "Restyle",
    action: "Try Style Transfer",
    description: "Give a photo a different artistic style.",
    href: "/tools/style-transfer",
    icon: Palette,
    before: "/showcase/demo-style-before.jpg",
    beforeAlt: "Photograph of a cobblestone village street",
    after: "/showcase/demo-style-after.jpg",
    afterAlt: "Painted village street beneath a swirling blue and yellow sky",
  },
  {
    id: "background",
    name: "Background",
    action: "Try Background Editor",
    description: "Isolate a subject or replace the scene behind them.",
    href: "/tools/background",
    icon: Scissors,
    before: "/showcase/demo-bg-before.jpg",
    beforeAlt: "Studio portrait of a woman against a gray backdrop",
    after: "/showcase/demo-bg-after.jpg",
    afterAlt: "Portrait of a woman in a glowing forest setting",
  },
  {
    id: "upscale",
    name: "Upscale",
    action: "Try Image Upscaler",
    description: "Bring out texture and detail in low-resolution images.",
    href: "/tools/upscaler",
    icon: Maximize2,
    before: "/showcase/demo-upscale-before.jpg",
    beforeAlt: "Soft, dim image of a wolf howling at the moon",
    after: "/showcase/demo-upscale-after.jpg",
    afterAlt: "Detailed image of a wolf howling in a moonlit snowy landscape",
  },
];

const imageSizes = "(min-width: 1080px) 640px, (min-width: 760px) 60vw, 92vw";

export default function HomeCapabilityDemo() {
  const [selected, setSelected] = useState(0);
  const [position, setPosition] = useState(50);
  const example = examples[selected];

  return (
    <section className={styles.section} aria-labelledby="home-edit-demo-title">
      <div className={styles.controls}>
        <h2 id="home-edit-demo-title">See the difference.</h2>
        <p className={styles.intro}>Compare three ways to edit an image.</p>
        <div
          className={styles.options}
          role="group"
          aria-label="Image editing examples"
        >
          {examples.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={index === selected}
              onClick={() => {
                if (index === selected) return;
                setSelected(index);
                setPosition(50);
              }}
            >
              <item.icon size={16} aria-hidden="true" />
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.preview}>
        <div className={styles.previewBar}>
          <span>Illustrative samples</span>
          <span>Drag to compare</span>
        </div>
        <div
          className={styles.stage}
          style={{ "--comparison-position": `${position}%` } as CSSProperties}
        >
          <Image
            src={example.after}
            alt={example.afterAlt}
            fill
            sizes={imageSizes}
            className={styles.image}
            draggable={false}
          />
          <Image
            src={example.before}
            alt={example.beforeAlt}
            fill
            sizes={imageSizes}
            className={`${styles.image} ${styles.before} ${example.id === "background" ? styles.portrait : ""}`}
            draggable={false}
          />
          <div className={styles.labels} aria-hidden="true">
            <span data-hidden={position < 20}>Before</span>
            <span data-hidden={position > 80}>After</span>
          </div>
          <div className={styles.divider} aria-hidden="true">
            <span>
              <MoveHorizontal size={19} />
            </span>
          </div>
          <input
            className={styles.range}
            type="range"
            min="0"
            max="100"
            aria-label="Before and after comparison"
            aria-valuetext={`${position}% before, ${100 - position}% after`}
            value={position}
            onChange={event => setPosition(event.currentTarget.valueAsNumber)}
          />
        </div>
      </div>

      <div className={styles.detail}>
        <p aria-live="polite">{example.description}</p>
        <Link href={example.href} className={styles.toolLink}>
          {example.action}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
